# ETL: ALL list tabs (On-Air + country [List] tabs) -> normalized tables.
# SAFE SYNC (additive·idempotent·no wipe — see "SAFE SYNC" block below).
# Reads .env.local. Real creators from gitignored snapshot (PII).
import csv, json, re, glob, sys, io, urllib.request, urllib.error
from collections import Counter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = "C:/Projects/zipiel-operate-dash"
SNAP = f"{ROOT}/research/sheet-snapshot"

env = {}
for line in open(f"{ROOT}/.env.local", encoding="utf-8"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); env[k] = v
URL, SVC = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_KEY"]

def api(method, path, body=None, prefer=None):
    h = {"apikey": SVC, "Authorization": f"Bearer {SVC}", "Content-Type": "application/json"}
    if prefer: h["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + "/rest/v1" + path, data=data, headers=h, method=method)
    try:
        r = urllib.request.urlopen(req); raw = r.read().decode()
        return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:400]); raise

def insert_batched(table, rows, size=500, returning=False):
    out = []
    prefer = "return=representation" if returning else "return=minimal"
    for i in range(0, len(rows), size):
        chunk = rows[i:i+size]
        res = api("POST", f"/{table}", chunk, prefer=prefer)
        if returning and res: out.extend(res)
    return out

# --- mappings ---
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
    # maps sheet's bilingual labels -> effie's canonical 15-stage enum.
    # order matters: longer/specific keys before substrings (e.g. 'request
    # shipping' before 'shipping', 'production' before bare 'pr').
    s = (s or "").strip().lower()
    table = [
        (("request shipping information", "배송 정보 요청", "배송정보"), "Request Shipping Information"),
        (("creator listing", "리스트업", "listing"), "Listing"),
        (("guideline sent", "guidelines sent", "가이드라인 전달", "가이드라인"), "Guideline Sent"),
        (("content in production", "콘텐츠 제작 중", "제작 중", "제작중"), "Content in Production"),
        (("content uploaded", "content published", "콘텐츠 업로드 완료", "업로드 완료", "업로드완료"), "Content Uploaded"),
        (("on hold", "payment pending", "지급 대기", "지급대기", "payment", "지급"), "Payment Pending"),
        (("negotiating", "협업 조건 조율", "in discussion", "협의"), "Negotiating"),
        (("rate inquiry", "rate", "단가"), "Rate Inquiry"),
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
    return "Listing"  # country list default = sourced

def map_campaign(c):
    c = (c or "").strip().lower()
    if "paid" in c: return "Paid"
    if "affiliate" in c or "어필리" in c: return "Affiliate"
    return "Gifted"

# 매니저 표기 정규화: 시트의 대소문자·한글 약칭·합동표기를 canonical로.
# 미상은 원문 보존(날조 금지). 근거 = scripts/diagnose_fees.py distinct 출력.
MANAGER_CANON = {
    "sol": "Sol", "anna": "Anna", "jane": "Jane", "nhi": "Nhi",
    "natalie": "Natalie", "nat": "Natalie",
    "tsss": "TSSS", "lyra": "Lyra", "effie": "effie", "unknown": "unknown",
    "정채민": "정채민", "채민": "정채민", "조준상": "조준상", "준상": "조준상",
    "김예지": "김예지", "예지": "김예지", "조아인": "조아인", "아인": "조아인",
    "김정연": "김정연", "정연": "김정연", "나은": "나은", "카이토": "카이토", "차스": "차스",
}
def normalize_manager(s):
    s = (s or "").strip()
    if not s: return "unknown"
    if "," in s:  # 합동 표기 → 각 파트 정규화 후 순서 보존 dedup
        seen = []
        for p in (normalize_manager(p) for p in s.split(",")):
            if p and p != "unknown" and p not in seen: seen.append(p)
        return ", ".join(seen) if seen else "unknown"
    return MANAGER_CANON.get(s.lower(), s)

def to_int(x):
    x = re.sub(r"[^\d]", "", (x or ""))
    if not x: return None
    n = int(x)
    return n if n < 100_000_000 else None  # 1억 상한(병합 오염 거름; followers·fee 현실 상한)
def to_num(x):
    x = re.sub(r"[^\d.]", "", (x or ""))
    try: n = float(x) if x else None
    except: return None
    return n if (n is not None and n < 1_000_000) else None  # CPV 100만 상한
def to_date(x):
    # sheet uses '2026.04.08' / '2026. 5. 25' / '2026-04-08' -> ISO
    m = re.search(r"(20\d{2})\D{1,3}(\d{1,2})\D{1,3}(\d{1,2})", (x or ""))
    if not m: return None
    y, mo, d = m.groups()
    try:
        if not (1 <= int(mo) <= 12 and 1 <= int(d) <= 31): return None
        return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
    except: return None
def handle_from(url, name):
    if url:
        m = re.search(r"(?:instagram|tiktok|xiaohongshu|xhslink|youtube|threads|x|twitter)\.com/@?([\w.\-]+)", url)
        if m: return m.group(1)[:60]
    n = (name or "").strip()
    return n[:60] if n else None

def find_col(hdr, *names, exclude=()):
    for i, h in enumerate(hdr):
        hl = h.strip().lower()
        if any(e.lower() in hl for e in exclude):
            continue
        for n in names:
            if n.lower() in hl: return i
    return -1

def detect_header(rows):
    return max(range(min(7, len(rows))), key=lambda i: sum(1 for c in rows[i] if c.strip()))

# tab -> default country (None = read from a Country column)
SOURCES = [
    ("08_On-Air_Sheet.csv", None),
    ("07_KR*.csv", "KR"), ("09_CN*.csv", "CN"), ("10_JP.csv", "JP"),
    ("11_TW*.csv", "TW"), ("12_SGP*.csv", "SG"), ("13_US*.csv", "US"),
]

records = []
for pattern, default_country in SOURCES:
    files = glob.glob(f"{SNAP}/{pattern}")
    if not files:
        print(f"  (없음: {pattern})"); continue
    fp = files[0]
    rows = list(csv.reader(open(fp, encoding="utf-8")))
    if not rows: continue
    hi = detect_header(rows)
    hdr = rows[hi]
    data = [r for r in rows[hi+1:] if any(c.strip() for c in r)]
    ci = dict(
        country=find_col(hdr, "country", "국가"),
        manager=find_col(hdr, "manager", "담당자"),
        platform=find_col(hdr, "platform", "플랫폼"),
        url=find_col(hdr, "account url", "계정 url", "url"),
        name=find_col(hdr, "name", "계정", "인플루언서", "account"),
        followers=find_col(hdr, "followers", "팔로워", exclude=("demographic", "구성", "top 3", "top3")),
        tier=find_col(hdr, "tier", "티어"),
        email=find_col(hdr, "email", "이메일"),
        status=find_col(hdr, "진행 현황", "진행현황", "status"),
        campaign=find_col(hdr, "campaign", "캠페인"),
        fee=find_col(hdr, "content cost", "content fee", "콘텐츠 비용"),
        fee_rate=find_col(hdr, "rate", exclude=("engagement", "참여율")),
        cpv=find_col(hdr, "cpv"),
        avgviews=find_col(hdr, "average views", "avg views", "평균조회수", "평균 조회수"),
        listed=find_col(hdr, "listing date", "리스트업 날짜", "리스트업 일자", "리스트업\n일자", "리스트업"),
        last_contact=find_col(hdr, "last contact", "최근 소통", "소통 일자", "소통일자"),
        scheduled=find_col(hdr, "scheduled upload", "scheduled post", "업로드 예정", "업로드예정", "업로드\n예정일", "예정일"),
        post_url=find_col(hdr, "upload link", "업로드 링크", "post url", "original video"),
    )
    cnt = 0
    for r in data:
        def g(key):
            i = ci[key]
            return r[i].strip() if i >= 0 and len(r) > i else ""
        plat = map_platform(g("platform"))
        country = (g("country") or default_country or "").upper()
        country = {"SGP": "SG", "SINGAPORE": "SG", "TAIWAN": "TW", "JAPAN": "JP",
                   "KOREA": "KR", "MALAYSIA": "MY", "CHINA": "CN", "HONGKONG": "HK",
                   "HONG KONG": "HK", "TW/KR": "TW"}.get(country, country)
        if country not in COUNTRY_OK and default_country in COUNTRY_OK:
            country = default_country
        tier = g("tier") if g("tier") in TIERS else None
        h = handle_from(g("url"), g("name"))
        if not plat or country not in COUNTRY_OK or not h:
            continue
        # fee 출처 분기: Content Cost (KRW) 우선 신뢰 → 없으면 Rate(엔게이지먼트 제외).
        # SGP Rate = KRW 확정, TW/HK/US Rate = 통화 미확인(unverified), JP = fee 컬럼 부재(None).
        if ci["fee"] >= 0 and g("fee"):
            fee, fee_src = to_int(g("fee")), "sheet_krw"
        elif ci["fee_rate"] >= 0 and g("fee_rate"):
            fee = to_int(g("fee_rate"))
            fee_src = "sheet_krw" if country == "SG" else "unverified"
        else:
            fee, fee_src = None, None
        if fee is None:
            fee_src = None
        records.append({
            "handle": h, "name": (g("name") or None), "platform": plat, "country": country,
            "followers": to_int(g("followers")) or 0, "tier": tier or "Nano",
            "email": g("email") or None, "manager": normalize_manager(g("manager"))[:40],
            "avg_views": to_int(g("avgviews")),
            "status": map_status(g("status")), "campaign_type": map_campaign(g("campaign")),
            "fee": fee, "fee_source": fee_src, "cpv": to_num(g("cpv")),
            "listed_date": to_date(g("listed")), "last_contact": to_date(g("last_contact")),
            "scheduled_post_date": to_date(g("scheduled")),
            "post_url": (g("post_url") if g("post_url").startswith("http") else None),
        })
        cnt += 1
    print(f"  {pattern}: {cnt}건 (헤더 {hi+1}행)")

print(f"\n총 파싱: {len(records)}건")

# ============================================================================
# SAFE SYNC — additive·idempotent·provenance-tagged. NO wipe. (AC-3)
# Contract: legacy contact-list rows are FROZEN — imported once, never deleted or
# re-inserted. Re-runs only (a) upsert creator meta by (handle,platform),
# (b) tag provenance on still-untagged rows, (c) leave collaborations untouched
# when they already exist. status & collaboration_status_history are NEVER written
# here, so in-app (manager) edits survive every re-run (AC-3.4, stronger than the
# conditional skip rule: we simply never put `status` in any write payload).
# external_ref backfill = 'legacy:'||id (stable, unique). products seed lives in
# migration 0008. No DELETE/TRUNCATE is issued anywhere in this script.
# ============================================================================
LEGACY = "legacy_contact_list"

def paged_get(path):
    out, step, i = [], 1000, 0
    while True:
        sep = "&" if "?" in path else "?"
        chunk = api("GET", f"{path}{sep}limit={step}&offset={i}")
        if not chunk:
            break
        out.extend(chunk)
        if len(chunk) < step:
            break
        i += step
    return out

def upsert(table, rows, on_conflict, size=500):
    for i in range(0, len(rows), size):
        api("POST", f"/{table}?on_conflict={on_conflict}", rows[i:i+size],
            prefer="resolution=merge-duplicates,return=minimal")

# (1) campaigns — idempotent: reuse existing by type, create only missing.
types = sorted({r["campaign_type"] for r in records})
camp_existing = paged_get("/campaigns?select=id,type")
camp_id = {c["type"]: c["id"] for c in camp_existing}
missing = [t for t in types if t not in camp_id]
if missing:
    created = api("POST", "/campaigns",
                  [{"name": f"Seeding {t}", "type": t, "brand": "zipiel"} for t in missing],
                  prefer="return=representation")
    camp_id.update({c["type"]: c["id"] for c in (created or [])})
print(f"캠페인: {len(camp_id)} (신규 {len(missing)})")

# (2) creators — upsert by (handle,platform). frozen legacy: tag source + legacy flag.
seen, cre_payload = {}, []
for r in records:
    key = (r["handle"], r["platform"])
    if key in seen:
        continue
    seen[key] = True
    row = {k: r[k] for k in ["handle", "name", "platform", "country", "followers", "tier", "email", "manager", "avg_views"]}
    row["source_system"] = LEGACY
    row["in_legacy_list"] = True
    cre_payload.append(row)
upsert("creators", cre_payload, on_conflict="handle,platform")
cre_id = {(c["handle"], c["platform"]): c["id"] for c in paged_get("/creators?select=id,handle,platform")}
print(f"크리에이터: {len(cre_id)} (upsert merge, 중복 0)")

# (3) collaborations — frozen import guard: insert the full legacy set ONLY when the
# table is empty (first load). If rows already exist, do NOT re-insert (no dup, no
# status overwrite). Existing live DB (14k) takes the skip branch.
existing_collab = api("GET", "/collaborations?select=id&limit=1")
if not existing_collab:
    col_payload, ordinal = [], {}
    for r in records:
        cid = cre_id.get((r["handle"], r["platform"]))
        if not cid:
            continue
        key = (r["handle"], r["platform"])
        n = ordinal.get(key, 0); ordinal[key] = n + 1
        col_payload.append({
            "creator_id": cid, "campaign_id": camp_id[r["campaign_type"]],
            "status": r["status"], "manager": r["manager"],
            "content_fee_krw": r["fee"], "fee_source": r["fee_source"], "cpv": r["cpv"],
            "listed_date": r["listed_date"], "last_contact": r["last_contact"],
            "scheduled_post_date": r["scheduled_post_date"], "post_url": r["post_url"],
            "source_system": LEGACY,
            "external_ref": f"legacy:{r['handle']}:{r['platform']}:{n}",  # stable natural key
        })
    insert_batched("collaborations", col_payload)
    print(f"협업: {len(col_payload)} (최초 적재, external_ref 인라인)")
else:
    print("협업: 기존 데이터 존재 → 재삽입 생략(frozen, 손실 0)")

# (4) provenance backfill (source_system) — PATCH constant, one statement, idempotent.
# status is NEVER in any write payload here, so manager edits & status_history survive
# every re-run (AC-3.4, stronger than a conditional skip). external_ref for pre-existing
# rows is a column-expression backfill (PostgREST PATCH can't do col=expr) → handled
# once by migration 0010_legacy_backfill.sql ('legacy:'||id). 2nd run touches 0 rows.
protected = paged_get("/collaboration_status_history?select=collaboration_id&changed_by=neq.system")
print(f"보존 대상(인앱 편집 이력): {len({h['collaboration_id'] for h in protected})}건 — ETL이 status 미기록 → 전수 보존")
api("PATCH", "/collaborations?source_system=is.null", {"source_system": LEGACY}, prefer="return=minimal")
api("PATCH", "/creators?source_system=is.null", {"source_system": LEGACY, "in_legacy_list": True}, prefer="return=minimal")
print("출처 태깅 백필(source_system) 완료 — external_ref는 migration 0010이 1회 적용")

print("\n상태 분포(파싱):", dict(Counter(r["status"] for r in records).most_common()))
print("국가 분포(파싱):", dict(Counter(r["country"] for r in records).most_common()))
print("SAFE SYNC 완료 — DELETE/TRUNCATE 0, status_history 무변경")
