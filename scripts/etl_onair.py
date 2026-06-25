# ETL: On-Air Sheet (real seeding data) -> normalized 6-table Supabase.
# Replaces mock seed data. Reads .env.local for URL + service key.
import csv, json, re, os, sys, io, urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = "C:/Projects/zipiel-operate-dash"
SNAP = f"{ROOT}/research/sheet-snapshot/08_On-Air_Sheet.csv"

# --- load env ---
env = {}
for line in open(f"{ROOT}/.env.local", encoding="utf-8"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        env[k] = v
URL = env["NEXT_PUBLIC_SUPABASE_URL"]
SVC = env["SUPABASE_SERVICE_KEY"]

def api(method, path, body=None, prefer=None):
    h = {"apikey": SVC, "Authorization": f"Bearer {SVC}", "Content-Type": "application/json"}
    if prefer: h["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + "/rest/v1" + path, data=data, headers=h, method=method)
    try:
        r = urllib.request.urlopen(req)
        raw = r.read().decode()
        return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:300]); raise

# --- mappings ---
PLATFORM = {"IG": "instagram", "xhs": "xiaohongshu", "TT": "tiktok", "X": "x", "YT": "youtube", "TR": "threads"}
TIERS = {"Nano", "Micro", "Mid", "Macro", "Mega"}
COUNTRY_OK = {"CN", "TW", "KR", "JP", "MY", "SG", "HK", "US"}
def map_status(s):
    s = (s or "").strip().lower()
    if s == "completed": return "Completed"
    if "delivery" in s: return "Shipping"
    if s in ("dropped", "drop"): return "Dropped"
    return "In Discussion"  # in-progress default for blank
def map_campaign(c):
    c = (c or "").strip().lower()
    if c == "paid": return "Paid"
    if c == "affiliate": return "Affiliate"
    return "Gifted"
def to_int(x):
    x = re.sub(r"[^\d]", "", (x or ""))
    return int(x) if x else None
def to_num(x):
    x = re.sub(r"[^\d.]", "", (x or ""))
    try: return float(x) if x else None
    except: return None
def handle_from(url, name):
    if url:
        m = re.search(r"(?:instagram|tiktok|xiaohongshu|x|twitter|youtube|threads)\.com/@?([\w.\-]+)", url)
        if m: return m.group(1)[:60]
    return (name or "").strip()[:60] or None

# --- parse On-Air ---
rows = list(csv.reader(open(SNAP, encoding="utf-8")))
hdr = rows[3]
data = [r for r in rows[4:] if any(c.strip() for c in r)]

C = dict(country=0, manager=1, platform=2, name=9, url=10, followers=11, tier=12,
         email=14, avgviews=15, lastcontact=16, status=17, campaign=18, fee=20, cpv=22)

records = []
for r in data:
    def g(k): return r[C[k]].strip() if len(r) > C[k] else ""
    plat = PLATFORM.get(g("platform"))
    country = g("country").upper()
    if country == "TW/KR": country = "TW"
    tier = g("tier") if g("tier") in TIERS else None
    h = handle_from(g("url"), g("name"))
    # skip header-residue / unusable rows
    if not plat or country not in COUNTRY_OK or not tier or not h:
        continue
    records.append({
        "handle": h, "name": g("name") or None, "platform": plat, "country": country,
        "followers": to_int(g("followers")) or 0, "tier": tier,
        "email": g("email") or None, "manager": (g("manager") or "unknown")[:40],
        "avg_views": to_int(g("avgviews")),
        "status": map_status(g("status")), "campaign_type": map_campaign(g("campaign")),
        "fee": to_int(g("fee")), "cpv": to_num(g("cpv")),
        "last_contact": None,
    })

print(f"파싱된 유효 레코드: {len(records)} / 원본 {len(data)}행 (잔재·불완전 제외)")

# --- wipe mock data (cascade handles payments/history) ---
for t in ["collaborations", "creators", "campaigns"]:
    api("DELETE", f"/{t}?id=not.is.null", prefer="return=minimal")
print("기존 목 데이터 삭제 완료")

# --- campaigns (one per type present) ---
types = sorted({r["campaign_type"] for r in records})
camp_rows = api("POST", "/campaigns", [{"name": f"On-Air {t}", "type": t, "brand": "zipiel"} for t in types], prefer="return=representation")
camp_id = {c["type"]: c["id"] for c in camp_rows}
print(f"캠페인 생성: {list(camp_id)}")

# --- creators (dedup by handle+platform) ---
seen = {}
cre_payload = []
for r in records:
    key = (r["handle"], r["platform"])
    if key in seen: continue
    seen[key] = True
    cre_payload.append({k: r[k] for k in ["handle", "name", "platform", "country", "followers", "tier", "email", "manager", "avg_views"]})
cre_rows = api("POST", "/creators", cre_payload, prefer="return=representation")
cre_id = {(c["handle"], c["platform"]): c["id"] for c in cre_rows}
print(f"크리에이터 생성: {len(cre_rows)}")

# --- collaborations ---
col_payload = []
for r in records:
    cid = cre_id.get((r["handle"], r["platform"]))
    if not cid: continue
    col_payload.append({
        "creator_id": cid, "campaign_id": camp_id[r["campaign_type"]],
        "status": r["status"], "manager": r["manager"],
        "content_fee_krw": r["fee"], "cpv": r["cpv"], "last_contact": r["last_contact"],
    })
col_rows = api("POST", "/collaborations", col_payload, prefer="return=representation")
print(f"협업 생성: {len(col_rows)}")

# --- summary ---
from collections import Counter
print("\n상태 분포:", dict(Counter(r["status"] for r in records)))
print("국가 분포:", dict(Counter(r["country"] for r in records)))
print("캠페인 분포:", dict(Counter(r["campaign_type"] for r in records)))
print("\nETL 완료")
