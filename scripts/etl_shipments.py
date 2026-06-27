# ETL: shipping waybill sheet -> shipments table. (AC-5)
# Source = EMS waybill CSV export (gitignored scratchpad; PII, repo 미포함).
# Idempotent upsert by invoice_no. Dedup multi-product rows of one waybill.
# carrier label normalization. 'H&H' in country column -> brand_tag (non-country).
# PII NEVER loaded: 발송인명·수취인명·전화·우편번호·주소 columns are skipped entirely.
#
# Usage: python scripts/etl_shipments.py [path/to/ship.csv]
#   default path = the known scratchpad export. Override with argv[1].
import csv, json, re, sys, io, os, urllib.request, urllib.error
from collections import OrderedDict, Counter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = "C:/Projects/zipiel-operate-dash"
DEFAULT_CSV = ("C:/Users/sickkiya/AppData/Local/Temp/claude/"
               "C--Projects-zipiel-operate-dash/1563e266-77f5-4a2b-b3f6-99dd62b3f291/"
               "scratchpad/ship-2081447250.csv")
CSV_PATH = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
SOURCE_SHEET_ID = "1GlDP_shipping_receipt"  # [은정님,H&H] 배송 접수용 (link-public)

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

def to_int(x):
    x = re.sub(r"[^\d]", "", (x or ""))
    return int(x) if x else None

def to_date(x):
    m = re.search(r"(20\d{2})\D{1,3}(\d{1,2})\D{1,3}(\d{1,2})", (x or ""))
    if not m: return None
    y, mo, d = m.groups()
    if not (1 <= int(mo) <= 12 and 1 <= int(d) <= 31): return None
    return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"

def norm_carrier(s):
    s = (s or "").strip()
    if not s: return None
    low = s.replace(" ", "").lower()
    if low in ("k패킷", "kpacket", "k-packet"): return "K-Packet"
    if "한중해상" in s: return "한중해상"
    if low == "ems": return "EMS"
    if low.replace("-", "") == "seaexpress": return "SeaExpress"
    return s  # unknown label preserved (no fabrication)

ISO2 = {"CN", "TW", "KR", "JP", "MY", "SG", "HK", "US"}

if not os.path.exists(CSV_PATH):
    print(f"배송 CSV 없음: {CSV_PATH}\n  argv[1]로 경로를 지정하세요."); sys.exit(1)

rows = list(csv.reader(open(CSV_PATH, encoding="utf-8")))
hdr = rows[0]
data = [r for r in rows[1:] if any(c.strip() for c in r)]

def g(r, i): return r[i].strip() if i < len(r) else ""

# column indices (fixed layout of the EMS export)
C = dict(req_date=1, carrier=2, invoice=3, status=4, proc_date=5,
         weight=6, fee=7, country=11, customs=(20, 21, 22, 23))

ship = OrderedDict()  # invoice_no -> payload (dedup: first occurrence wins)
skipped_no_invoice = 0
for r in data:
    inv = g(r, C["invoice"])
    if not inv:
        skipped_no_invoice += 1
        continue
    if inv in ship:
        continue  # multi-product line of the same waybill — already counted
    country_raw = g(r, C["country"]).upper()
    brand_tag = None
    country = None
    if country_raw == "H&H":
        brand_tag = "H&H"
    elif country_raw in ISO2:
        country = country_raw
    customs = next((g(r, i) for i in C["customs"] if g(r, i)), None)
    ship[inv] = {
        "invoice_no": inv,
        "carrier": norm_carrier(g(r, C["carrier"])),
        "request_date": to_date(g(r, C["req_date"])),
        "processed_date": to_date(g(r, C["proc_date"])),
        "weight_g": to_int(g(r, C["weight"])),
        "fee_krw": to_int(g(r, C["fee"])),
        "country_code": country,
        "brand_tag": brand_tag,
        "customs_no": customs,
        "delivery_status": g(r, C["status"]) or None,
        "source_system": "ship_sheet",
        "source_sheet_id": SOURCE_SHEET_ID,
        "source_row": to_int(g(r, 0)),
        "match_status": "unmatched",
    }

payload = list(ship.values())
fee_total = sum(s["fee_krw"] or 0 for s in payload)
fee_excl_hh = sum((s["fee_krw"] or 0) for s in payload if s["brand_tag"] != "H&H")

# idempotent upsert by invoice_no PK
for i in range(0, len(payload), 500):
    api("POST", "/shipments?on_conflict=invoice_no", payload[i:i+500],
        prefer="resolution=merge-duplicates,return=minimal")

print(f"고유 송장: {len(payload)}건 (빈 송장행 {skipped_no_invoice} 생략)")
print(f"물류비 합(전체): {fee_total:,}원  /  H&H 제외: {fee_excl_hh:,}원")
print("carrier 분포:", dict(Counter(s["carrier"] for s in payload)))
print("국가 분포:", dict(Counter(s["country_code"] for s in payload)))
print(f"brand_tag H&H: {sum(1 for s in payload if s['brand_tag']=='H&H')}건")
print("PII(수취인명·전화·우편번호·주소) 미적재 확인 — 송장·요금·국가·중량·제품만")
print("배송 적재 완료 (upsert by invoice_no, 멱등)")
