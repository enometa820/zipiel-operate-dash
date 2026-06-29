# ETL: 온에어 시트(B) 국가 탭(KR/CN/JP/TW/SG) + 드랍/홀드 → collaborations(onair_2026)·creators·content_pieces.
# 읽기 = enometa OAuth(vault, readonly·자동갱신). 쓰기 = Supabase service key(.env.local).
# 손실0 계약(D-16) 유지: DELETE/TRUNCATE 0, status_history append-only, 인앱편집(이력보유) status 미기재.
# legacy 승격 dedup: (handle,platform) 일치 legacy 행을 onair_2026으로 승격(이중계상 0), 미일치는 insert.
# 멱등: external_ref='onair:{gid}:{row}' ON CONFLICT. 재실행 시 신규분 외 ±0.
# 컬럼 = 헤더 이름 매핑(탭별 위치 상이). 1/3/7일차는 raw 텍스트 보존. 에러문자열·#REF!·"-"는 null.
import csv, json, re, sys, io, os, time, socket, urllib.request, urllib.parse as up, urllib.error
from collections import Counter, defaultdict

socket.setdefaulttimeout(60)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = "C:/Projects/zipiel-operate-dash"
# effie "우리의 실제 데이터"(슬랙 06-26): B=2026 논의/온에어(국가탭) · C=the frameless seeding operation
# (On-air 단일탭, Campaign 컬럼=진짜 캠페인명 brand_country_mode). 옛 컨택 리스트(legacy)는 실제 데이터 아님.
SID_ONAIR = "10ymVkhZTXEaCHHqQbv8ZZf21gEufW20pvo3cMOAr-P0"
SID_SEEDOP = "1wQ9LqcnIhKRhhJMEssJIhEDFRvostsTlXA8huXMMG0U"
TOKEN = "C:/Users/sickkiya/.vault/zipiel/oauth-enometa-token.json"

# --- Supabase (write) ---
env = {}
for line in open(f"{ROOT}/.env.local", encoding="utf-8"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); env[k] = v
URL, SVC = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_KEY"]

def sb(method, path, body=None, prefer=None):
    h = {"apikey": SVC, "Authorization": f"Bearer {SVC}", "Content-Type": "application/json"}
    if prefer: h["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + "/rest/v1" + path, data=data, headers=h, method=method)
    try:
        r = urllib.request.urlopen(req); raw = r.read().decode()
        return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:400]); raise

def sb_paged(path):
    out, step, i = [], 1000, 0
    while True:
        sep = "&" if "?" in path else "?"
        chunk = sb("GET", f"{path}{sep}limit={step}&offset={i}")
        if not chunk: break
        out.extend(chunk)
        if len(chunk) < step: break
        i += step
    return out

# --- Google Sheets (read, enometa OAuth) ---
_t = json.load(open(TOKEN))
_body = up.urlencode({"client_id": _t["client_id"], "client_secret": _t["client_secret"], "refresh_token": _t["refresh_token"], "grant_type": "refresh_token"}).encode()
AT = json.loads(urllib.request.urlopen(urllib.request.Request(_t["token_uri"], data=_body, method="POST")).read().decode())["access_token"]

def sheet_values(title, sid):
    rng = "'" + title.replace("'", "''") + "'!1:5000"
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{sid}/values/" + up.quote(rng, safe="")
    for attempt in range(5):
        try:
            r = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={"Authorization": f"Bearer {AT}"})).read().decode())
            time.sleep(0.4); return r.get("values", [])
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503) and attempt < 4: time.sleep(2 ** attempt + 1); continue
            raise

# --- mappings (etl_seeding 정합) ---
def map_platform(s):
    s = (s or "").strip().lower()
    if s in ("ig", "instagram", "인스타그램", "insta"): return "instagram"
    if s in ("tt", "tiktok", "틱톡"): return "tiktok"
    if s in ("x", "twitter"): return "x"
    if s in ("xhs", "red", "小红书", "샤오홍슈", "rednote", "xiaohongshu"): return "xiaohongshu"
    if s in ("yt", "youtube", "유튜브"): return "youtube"
    if s in ("tr", "threads", "스레드"): return "threads"
    if s in ("douyin", "도우인", "抖音"): return "douyin"
    return None

TIERS = {"Nano", "Micro", "Mid", "Macro", "Mega"}
COUNTRY_OK = {"CN", "TW", "KR", "JP", "MY", "SG", "HK", "US"}

def map_status(s):
    s = (s or "").strip().lower()
    table = [
        (("request shipping information", "배송 정보 요청", "배송정보"), "Request Shipping Information"),
        (("creator listing", "리스트업", "listing"), "Listing"),
        (("guideline sent", "guidelines sent", "가이드라인 전달", "가이드라인"), "Guideline Sent"),
        (("content in production", "콘텐츠 제작 중", "제작 중", "제작중"), "Content in Production"),
        (("content uploaded", "content published", "콘텐츠 업로드 완료", "업로드 완료", "업로드완료"), "Content Uploaded"),
        (("on hold", "payment pending", "지급 대기", "지급대기", "payment", "지급"), "Payment Pending"),
        (("negotiating", "협업 조건 조율", "in discussion", "협의", "협상"), "Negotiating"),
        (("rate inquiry", "단가"), "Rate Inquiry"),
        (("confirmed to proceed", "진행 확정", "진행확정", "confirmed"), "Confirmed to Proceed"),
        (("계약서", "contract"), "Contract"),
        (("shipping", "배송 중", "배송중", "배송"), "Shipping"),
        (("simple seeding", "단순시딩", "시딩"), "Simple Seeding/PR"),
        (("completed", "협업 완료", "협업완료"), "Completed"),
        (("dropped", "드랍", "drop"), "Drop"),
        (("contact completed", "컨택 완료", "컨택완료", "email sent", "dm", "컨택"), "Contact Completed"),
    ]
    for keys, val in table:
        for k in keys:
            if k in s: return val
    return None  # 매칭 없으면 None(드랍/홀드 자유텍스트 블롭 → status 미변경)

def map_campaign(c):
    c = (c or "").strip().lower()
    if "paid" in c or "유가" in c: return "Paid"
    if "affiliate" in c or "어필리" in c: return "Affiliate"
    return "Gifted"

MANAGER_CANON = {"sol": "Sol", "anna": "Anna", "jane": "Jane", "nhi": "Nhi", "natalie": "Natalie", "nat": "Natalie",
    "tsss": "TSSS", "lyra": "Lyra", "effie": "effie", "unknown": "unknown", "chole": "Chole", "chloe": "Chloe"}
def normalize_manager(s):
    s = (s or "").strip()
    if not s: return "unknown"
    if "," in s:
        seen = []
        for p in (normalize_manager(p) for p in s.split(",")):
            if p and p != "unknown" and p not in seen: seen.append(p)
        return ", ".join(seen) if seen else "unknown"
    return MANAGER_CANON.get(s.lower(), s)[:40]

def to_int(x):
    x = re.sub(r"[^\d]", "", (x or ""))
    if not x: return None
    n = int(x); return n if n < 100_000_000 else None
def to_num(x):
    x = re.sub(r"[^\d.]", "", (x or ""))
    try: n = float(x) if x else None
    except: return None
    return n if (n is not None and n < 1_000_000) else None
def to_date(x):
    m = re.search(r"(20\d{2})\D{1,3}(\d{1,2})\D{1,3}(\d{1,2})", (x or ""))
    if not m: return None
    y, mo, d = m.groups()
    if not (1 <= int(mo) <= 12 and 1 <= int(d) <= 31): return None
    return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
def handle_from(url, name):
    if url:
        m = re.search(r"(?:instagram|tiktok|xiaohongshu|xhslink|youtube|threads|x|twitter)\.com/@?([\w.\-]+)", url)
        if m: return m.group(1)[:60]
    n = (name or "").strip()
    return n[:60] if n else None

DIRTY = ("error", "#ref", "#n/a", "bright data")  # 값 어디에든 있으면 오염(부분일치)
def clean_txt(x):
    x = (x or "").strip()
    if not x or x == "-": return None
    low = x.lower()
    if any(d in low for d in DIRTY): return None
    return x
def clean_int(x):
    return to_int(clean_txt(x) or "")

# --- 헤더 이름 기반 컬럼 해소 ---
def find_col(labels, terms, exclude=()):
    for i, lab in enumerate(labels):
        if any(e in lab for e in exclude): continue
        if any(term in lab for term in terms): return i
    return -1

def detect_header(rows):
    hi = max(range(min(8, len(rows))), key=lambda i: sum(1 for c in rows[i] if str(c).strip()))
    return hi

# 소스 = (sid, tabs, source_system, eref_prefix). 탭 = (title, gid, default_country).
# 드랍/홀드·seedop On-air는 country=None — country 컬럼/handle 매칭으로 분류, status는 map_status 키워드로.
SOURCES = [
    (SID_ONAIR, [
        ("KR_온에어", 1526933782, "KR"), ("CN_온에어", 1593164077, "CN"),
        ("JP_온에어", 268882564, "JP"), ("TW_온에어", 1121208463, "TW"),
        ("SG_온에어", 1985580167, "SG"), ("드랍/홀드", 1638811644, None),
    ], "onair_2026", "onair"),
    (SID_SEEDOP, [("On-air", 99916092, None)], "seeding_op_2026", "seedop"),
]
SHEET_TABS = [(t, g, c, sid, src, pfx) for sid, tabs, src, pfx in SOURCES for t, g, c in tabs]

records, cp_records = [], []
for title, gid, dflt_country, SID_CUR, SRC, PFX in SHEET_TABS:
    rows = sheet_values(title, SID_CUR)
    if not rows:
        print(f"  ({title}: 빈 탭)"); continue
    hi = detect_header(rows)
    # 헤더 = 탐지행 + 바로 위행(EN) 결합으로 EN/KO 모두 커버
    above = rows[hi - 1] if hi > 0 else []
    ncol = max(len(rows[hi]), len(above))
    labels = []
    for i in range(ncol):
        a = above[i].strip() if i < len(above) else ""
        b = rows[hi][i].strip() if i < len(rows[hi]) else ""
        labels.append((a + " " + b).lower().replace("\n", " "))
    ci = dict(
        country=find_col(labels, ("국가", "country")),
        manager=find_col(labels, ("담당자", "manager", "person in charge")),
        platform=find_col(labels, ("플랫폼", "platform")),
        name=find_col(labels, ("name", "인플루언서"), exclude=("url", "계정", "브랜드", "account")),
        url=find_col(labels, ("계정 url", "account url", "url")),
        followers=find_col(labels, ("팔로워", "followers"), exclude=("구성", "top", "composition")),
        tier=find_col(labels, ("티어", "tier")),
        listed=find_col(labels, ("리스트업", "listed date", "listed")),
        email=find_col(labels, ("email", "이메일")),
        avg_views=find_col(labels, ("평균조회", "average views", "avg view", "6개 게시물", "6 posts")),
        last_contact=find_col(labels, ("최근 소통", "last engagement", "소통 일자")),
        status=find_col(labels, ("진행 현황", "진행현황", "status")),
        campaign=find_col(labels, ("캠페인", "campaign")),
        fee=find_col(labels, ("콘텐츠 비용", "content cost", "content fee")),
        cpv=find_col(labels, ("cpv",)),
        tracking=find_col(labels, ("송장", "tracking")),
        prod_up=find_col(labels, ("업로드/제품", "업로드 제품", "product uploaded")),
        prod_sent=find_col(labels, ("발송/제품", "발송 제품", "product sent"), exclude=("업로드",)),
        scheduled=find_col(labels, ("예정일", "scheduled")),
        completed=find_col(labels, ("완료일", "upload completed", "completed date")),
        post_url=find_col(labels, ("업로드 링크", "업로드링크", "upload link"), exclude=("예정", "완료")),
        original=find_col(labels, ("원본", "드라이브", "original")),
        partnership=find_col(labels, ("파트너십", "partnership")),
        content_type=find_col(labels, ("콘텐츠 유형", "content type")),
        concept=find_col(labels, ("분류",)),
        d1=find_col(labels, ("1일차",)), d3=find_col(labels, ("3일차",)), d7=find_col(labels, ("7일차",)),
        views=find_col(labels, ("조회수", "views"), exclude=("평균", "average", "6개", "avg")),
        likes=find_col(labels, ("좋아요", "likes")),
        comments=find_col(labels, ("댓글", "comments")),
        reposts=find_col(labels, ("리포스트", "repost")),
        saves=find_col(labels, ("북마크", "saves", "bookmark")),
        shares=find_col(labels, ("공유", "shares")),
    )
    data = rows[hi + 1:]
    cnt = 0
    for ri, r in enumerate(data):
        def g(key):
            i = ci[key]
            return r[i].strip() if i >= 0 and len(r) > i else ""
        plat = map_platform(g("platform"))
        country = (g("country") or dflt_country or "").upper()
        country = {"SGP": "SG", "SINGAPORE": "SG", "TAIWAN": "TW", "JAPAN": "JP", "KOREA": "KR", "CHINA": "CN", "HONGKONG": "HK", "HONG KONG": "HK"}.get(country, country)
        if country not in COUNTRY_OK and dflt_country in COUNTRY_OK: country = dflt_country
        h = handle_from(g("url"), g("name"))
        if not plat or country not in COUNTRY_OK or not h: continue
        tier = g("tier") if g("tier") in TIERS else None
        eref = f"{PFX}:{gid}:{hi + 1 + ri}"
        rec = {
            "handle": h, "name": (g("name") or None), "platform": plat, "country": country,
            "followers": to_int(g("followers")) or 0, "tier": tier or "Nano",
            "email": g("email") or None, "manager": normalize_manager(g("manager")),
            "avg_views": to_int(g("avg_views")),
            "status": map_status(g("status")), "campaign_type": map_campaign(g("campaign")),
            "campaign_label": (g("campaign") or None), "partnership_code": (g("partnership") or None),
            "fee": to_int(g("fee")), "cpv": to_num(g("cpv")), "tracking": (g("tracking") or None),
            "listed_date": to_date(g("listed")), "last_contact": to_date(g("last_contact")),
            "scheduled_post_date": to_date(g("scheduled")),
            "post_url": (g("post_url") if g("post_url").startswith("http") else None),
            "eref": eref, "gid": gid, "tab": title, "row": hi + 1 + ri,
            "source_system": SRC, "source_sheet_id": SID_CUR,
        }
        records.append(rec)
        # content_piece — 업로드 링크 또는 예정일 있으면 생성(달성률 분모 위해 예정도)
        post = rec["post_url"]; sched = rec["scheduled_post_date"]
        if post or sched:
            cp_records.append({
                "eref": eref + ":c", "rec_eref": eref, "source_system": SRC,
                "post_url": post, "original_url": (g("original") if g("original").startswith("http") else None),
                "posted_at": to_date(g("completed")), "scheduled_post_date": sched,
                "category": clean_txt(g("prod_up")) or clean_txt(g("prod_sent")),
                "content_type": clean_txt(g("content_type")), "concept": clean_txt(g("concept")),
                "views": clean_int(g("views")), "likes": clean_int(g("likes")), "comments": clean_int(g("comments")),
                "reposts": clean_int(g("reposts")), "saves": clean_int(g("saves")), "shares": clean_int(g("shares")),
                "metrics_d1": clean_txt(g("d1")), "metrics_d3": clean_txt(g("d3")), "metrics_d7": clean_txt(g("d7")),
            })
        cnt += 1
    print(f"  {title}: {cnt}건 파싱 (헤더 row{hi+1}, {ncol}컬럼)")

print(f"\n총 파싱: {len(records)}건 (content 후보 {len(cp_records)})")

# --- campaigns (type→id, 기존 재사용·누락만 생성) ---
camp = {c["type"]: c["id"] for c in sb_paged("/campaigns?select=id,type")}
for t in sorted({r["campaign_type"] for r in records}):
    if t not in camp:
        created = sb("POST", "/campaigns", [{"name": f"Seeding {t}", "type": t, "brand": "zipiel"}], prefer="return=representation")
        camp[t] = created[0]["id"]

# --- creators upsert (handle,platform). in_legacy_list은 미포함(legacy 표시 보존) ---
seen, cre_payload = {}, []
for r in records:
    key = (r["handle"], r["platform"])
    if key in seen: continue
    seen[key] = True
    cre_payload.append({k: r[k] for k in ["handle", "name", "platform", "country", "followers", "tier", "email", "manager", "avg_views"]} | {"source_system": r["source_system"]})
for i in range(0, len(cre_payload), 500):
    sb("POST", "/creators?on_conflict=handle,platform", cre_payload[i:i+500], prefer="resolution=merge-duplicates,return=minimal")
cre_id = {(c["handle"], c["platform"]): c["id"] for c in sb_paged("/creators?select=id,handle,platform")}
print(f"크리에이터: {len(cre_id)} (upsert merge)")

# --- 기존 collaborations·protected 프리로드 ---
existing = sb_paged("/collaborations?select=id,creator_id,external_ref,source_system")
eref_to_id = {c["external_ref"]: c["id"] for c in existing if c.get("external_ref")}
legacy_by_creator = defaultdict(list)
for c in existing:
    if c.get("source_system") == "legacy_contact_list" or (c.get("external_ref") or "").startswith("legacy:"):
        legacy_by_creator[c["creator_id"]].append(c["id"])
protected = {h["collaboration_id"] for h in sb_paged("/collaboration_status_history?select=collaboration_id&changed_by=neq.system")}
print(f"기존 협업 {len(existing)} · 인앱편집(이력보유) {len(protected)}건 보존 · legacy 보유 크리에이터 {len(legacy_by_creator)}")

# --- collaborations 승격/insert/update (손실0) ---
promoted = inserted = updated = skipped_status = 0
eref_to_collab = {}  # content_pieces 연결용
for r in records:
    cid = cre_id.get((r["handle"], r["platform"]))
    if not cid: continue
    base = {
        "creator_id": cid, "campaign_id": camp[r["campaign_type"]], "manager": r["manager"],
        "content_fee_krw": r["fee"], "cpv": r["cpv"], "tracking_number": r["tracking"],
        "listed_date": r["listed_date"], "last_contact": r["last_contact"],
        "scheduled_post_date": r["scheduled_post_date"], "post_url": r["post_url"],
        "source_system": r["source_system"], "external_ref": r["eref"],
        "source_sheet_id": r["source_sheet_id"], "source_tab": r["gid"], "source_row": r["row"],  # provenance discrete(spec §3-2)
        "campaign_label": r["campaign_label"], "partnership_code": r["partnership_code"],
    }
    target = eref_to_id.get(r["eref"])
    if target is None and legacy_by_creator.get(cid):
        target = legacy_by_creator[cid].pop()  # legacy 승격(이중계상 0)
        mode = "promote"
    elif target is not None:
        mode = "update"
    else:
        mode = "insert"
    if mode in ("promote", "update"):
        # 빈 온에어 값(None)은 PATCH에서 제외 → 기존(legacy) fee/date 등 보존(손실0 > AC-4 갱신).
        # creator_id·source_system·external_ref·provenance는 항상 non-None이라 유지·승격 전환 보장.
        p = {k: v for k, v in base.items() if v is not None}
        if r["status"] and target not in protected:
            p["status"] = r["status"]
        elif target in protected:
            skipped_status += 1
        sb("PATCH", f"/collaborations?id=eq.{target}", p, prefer="return=minimal")
        eref_to_collab[r["eref"]] = target
        promoted += (mode == "promote"); updated += (mode == "update")
    else:
        p = dict(base)
        p["status"] = r["status"] or "Listing"
        new = sb("POST", "/collaborations", [p], prefer="return=representation")
        eref_to_collab[r["eref"]] = new[0]["id"]
        inserted += 1
print(f"협업: 승격 {promoted} · 신규 {inserted} · 갱신(재실행) {updated} · 인앱편집 status 보존 {skipped_status}")

# --- content_pieces upsert (external_ref 멱등) ---
# 1/3/7일차 raw 블롭("재생: N\n좋아요: N\n댓글: N") 파서 — lib/metrics.ts LABEL_MAP 동일(정본=TS). 파싱 실패=부재(날조 0).
MLABEL = {"재생": "views", "조회": "views", "조회수": "views", "좋아요": "likes", "댓글": "comments",
          "북마크": "saves", "저장": "saves", "리포스트": "reposts", "공유": "shares", "인용": "quotes", "팔로우": "follows", "팔로워": "follows"}
def parse_metrics(blob):
    out = {}
    for m in re.finditer(r"([^\n:]+):\s*([\d,]+)", blob or ""):
        f = MLABEL.get(m.group(1).strip())
        digits = m.group(2).replace(",", "")
        if f and digits: out[f] = int(digits)  # 콤마-only 등 빈 숫자 가드(TS Number.isNaN 파리티)
    return out

cp_payload = []
for cp in cp_records:
    collab = eref_to_collab.get(cp["rec_eref"])
    if not collab: continue
    row = {k: cp[k] for k in ("post_url", "original_url", "posted_at", "scheduled_post_date", "category",
            "content_type", "concept", "views", "likes", "comments", "reposts", "saves", "shares",
            "metrics_d1", "metrics_d3", "metrics_d7")}
    row |= {"collaboration_id": collab, "external_ref": cp["eref"], "source_system": cp["source_system"]}
    md1, md3, md7 = parse_metrics(cp["metrics_d1"]), parse_metrics(cp["metrics_d3"]), parse_metrics(cp["metrics_d7"])
    row |= {"views_d1": md1.get("views"), "views_d3": md3.get("views"), "views_d7": md7.get("views"),
            "likes_d1": md1.get("likes"), "likes_d3": md3.get("likes"), "likes_d7": md7.get("likes"),
            "comments_d1": md1.get("comments"), "comments_d3": md3.get("comments"), "comments_d7": md7.get("comments")}
    cp_payload.append(row)
for i in range(0, len(cp_payload), 500):
    sb("POST", "/content_pieces?on_conflict=external_ref", cp_payload[i:i+500], prefer="resolution=merge-duplicates,return=minimal")
print(f"콘텐츠: {len(cp_payload)} (upsert by external_ref)")

print("\n상태 분포(파싱):", dict(Counter(r["status"] for r in records if r["status"]).most_common()))
print("국가 분포:", dict(Counter(r["country"] for r in records).most_common()))
print("온에어 적재 완료 — DELETE/TRUNCATE 0, 승격 dedup, status_history 보존")
