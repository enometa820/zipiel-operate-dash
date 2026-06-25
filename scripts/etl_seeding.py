# ETL: ALL list tabs (On-Air + country [List] tabs) -> normalized 6 tables.
# Full rebuild. Reads .env.local. FICTIONAL/real creators from gitignored snapshot.
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
        (("on hold", "지급 대기", "지급대기", "payment", "지급"), "On Hold"),
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
        fee=find_col(hdr, "content cost", "content fee", "콘텐츠 비용", "rate"),
        cpv=find_col(hdr, "cpv"),
        avgviews=find_col(hdr, "average views", "avg views", "평균조회수", "평균 조회수"),
        listed=find_col(hdr, "listing date", "리스트업 날짜", "리스트업 일자", "리스트업\n일자", "리스트업"),
        last_contact=find_col(hdr, "last contact", "최근 소통", "소통 일자", "소통일자"),
        scheduled=find_col(hdr, "scheduled upload", "scheduled post", "업로드 예정", "업로드예정", "업로드\n예정일", "예정일"),
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
        records.append({
            "handle": h, "name": (g("name") or None), "platform": plat, "country": country,
            "followers": to_int(g("followers")) or 0, "tier": tier or "Nano",
            "email": g("email") or None, "manager": (g("manager") or "unknown")[:40],
            "avg_views": to_int(g("avgviews")),
            "status": map_status(g("status")), "campaign_type": map_campaign(g("campaign")),
            "fee": to_int(g("fee")), "cpv": to_num(g("cpv")),
            "listed_date": to_date(g("listed")), "last_contact": to_date(g("last_contact")),
            "scheduled_post_date": to_date(g("scheduled")),
        })
        cnt += 1
    print(f"  {pattern}: {cnt}건 (헤더 {hi+1}행)")

print(f"\n총 파싱: {len(records)}건")

# wipe
for t in ["collaborations", "creators", "campaigns"]:
    api("DELETE", f"/{t}?id=not.is.null", prefer="return=minimal")
print("기존 데이터 삭제")

# campaigns
types = sorted({r["campaign_type"] for r in records})
camp = api("POST", "/campaigns", [{"name": f"Seeding {t}", "type": t, "brand": "zipiel"} for t in types], prefer="return=representation")
camp_id = {c["type"]: c["id"] for c in camp}

# creators dedup by (handle, platform)
seen, cre_payload = {}, []
for r in records:
    key = (r["handle"], r["platform"])
    if key in seen: continue
    seen[key] = True
    cre_payload.append({k: r[k] for k in ["handle", "name", "platform", "country", "followers", "tier", "email", "manager", "avg_views"]})
cre = insert_batched("creators", cre_payload, returning=True)
cre_id = {(c["handle"], c["platform"]): c["id"] for c in cre}
print(f"크리에이터: {len(cre)} (중복 제거 후)")

# collaborations (all rows)
col_payload = []
for r in records:
    cid = cre_id.get((r["handle"], r["platform"]))
    if not cid: continue
    col_payload.append({
        "creator_id": cid, "campaign_id": camp_id[r["campaign_type"]],
        "status": r["status"], "manager": r["manager"],
        "content_fee_krw": r["fee"], "cpv": r["cpv"],
        "listed_date": r["listed_date"], "last_contact": r["last_contact"],
        "scheduled_post_date": r["scheduled_post_date"],
    })
insert_batched("collaborations", col_payload)
print(f"협업: {len(col_payload)}")

print("\n상태 분포:", dict(Counter(r["status"] for r in records).most_common()))
print("국가 분포:", dict(Counter(r["country"] for r in records).most_common()))
print("ETL 완료")
