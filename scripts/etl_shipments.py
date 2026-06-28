# ETL: shipping waybill sheets -> shipments table + 송장↔협업 매칭.
# 소스 = 글로벌 EMS export(고정 인덱스) + 국내 송장 시트(헤더 매핑). PII·gitignore, repo 미포함.
# 멱등 upsert by invoice_no. 한 송장 다상품(합포) dedup. carrier 정규화.
# 매칭: collaborations.tracking_number ↔ shipments.invoice_no 직접 조인 → collaborations.invoice_no(FK)·shipments.match_status='matched'.
# match_status는 upsert payload에서 제외 → 재적재해도 기존 매칭 보존(손실0).
# PII NEVER loaded: 수취인명·전화·우편번호·주소 컬럼 전면 제외.
#
# Usage: python scripts/etl_shipments.py [global_ship.csv]
#   global CSV = argv[1] 또는 기본 scratchpad(없으면 글로벌 skip, 이미 적재됨). 국내 = research snapshot 고정.
import csv, json, re, sys, io, os, socket, urllib.request, urllib.error
from collections import OrderedDict, Counter

socket.setdefaulttimeout(30)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = "C:/Projects/zipiel-operate-dash"
GLOBAL_CSV = sys.argv[1] if len(sys.argv) > 1 else (
    "C:/Users/sickkiya/AppData/Local/Temp/claude/"
    "C--Projects-zipiel-operate-dash/1563e266-77f5-4a2b-b3f6-99dd62b3f291/"
    "scratchpad/ship-2081447250.csv")
DOMESTIC_CSV = f"{ROOT}/research/ship-snapshot/_H_H__국내_송장번호__gid1579019407.csv"
GLOBAL_SHEET_ID = "1GlDP_shipping_receipt"  # [은정님,H&H] 배송 접수용
DOMESTIC_SHEET_ID = "1GlDP_domestic_1579019407"  # 국내 송장 시트

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

def api_paged(path):
    out, step, i = [], 1000, 0
    while True:
        sep = "&" if "?" in path else "?"
        chunk = api("GET", f"{path}{sep}limit={step}&offset={i}")
        if not chunk: break
        out.extend(chunk)
        if len(chunk) < step: break
        i += step
    return out

def to_int(x):
    x = re.sub(r"[^\d]", "", (x or ""))
    if not x: return None
    n = int(x)
    return n if n < 100_000_000 else None

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
    return s  # 국내 "전체택배" 등 원라벨 보존(날조 0)

ISO2 = {"CN", "TW", "KR", "JP", "MY", "SG", "HK", "US"}

def g(r, i): return r[i].strip() if i < len(r) else ""

def read_csv(path):
    rows = list(csv.reader(open(path, encoding="utf-8")))
    return [r for r in rows[1:] if any(c.strip() for c in r)]

# --- 글로벌 EMS (고정 인덱스) ---
GC = dict(req_date=1, carrier=2, invoice=3, status=4, proc_date=5, weight=6, fee=7, country=11, customs=(20, 21, 22, 23))

def build_global(data, ship):
    skipped = 0
    for r in data:
        inv = g(r, GC["invoice"])
        if not inv: skipped += 1; continue
        if inv in ship: continue
        cr = g(r, GC["country"]).upper()
        brand_tag = "H&H" if cr == "H&H" else None
        country = cr if cr in ISO2 else None
        customs = next((g(r, i) for i in GC["customs"] if g(r, i)), None)
        ship[inv] = {
            "invoice_no": inv, "carrier": norm_carrier(g(r, GC["carrier"])),
            "request_date": to_date(g(r, GC["req_date"])), "processed_date": to_date(g(r, GC["proc_date"])),
            "weight_g": to_int(g(r, GC["weight"])), "fee_krw": to_int(g(r, GC["fee"])),
            "country_code": country, "brand_tag": brand_tag, "customs_no": customs,
            "delivery_status": g(r, GC["status"]) or None,
            "source_system": "ship_sheet", "source_sheet_id": GLOBAL_SHEET_ID, "source_row": to_int(g(r, 0)),
        }
    return skipped

# --- 국내 송장 (헤더 매핑) — 배송비 컬럼 없음→fee_krw=null. PII 제외. ---
DC = dict(invoice=33, carrier=34, proc_date=32, req_date=30, weight=50, status=4)

def build_domestic(data, ship):
    skipped = 0
    for r in data:
        inv = g(r, DC["invoice"])
        if not inv: skipped += 1; continue
        if inv in ship: continue  # 합포(한 송장 다상품) first-wins
        ship[inv] = {
            "invoice_no": inv, "carrier": norm_carrier(g(r, DC["carrier"])),
            "request_date": to_date(g(r, DC["req_date"])), "processed_date": to_date(g(r, DC["proc_date"])),
            "weight_g": to_int(g(r, DC["weight"])), "fee_krw": None,  # 국내 CSV에 배송비 컬럼 없음(상품원가 위장 금지)
            "country_code": "KR", "brand_tag": None, "customs_no": None,
            "delivery_status": g(r, DC["status"]) or None,
            "source_system": "ship_sheet", "source_sheet_id": DOMESTIC_SHEET_ID, "source_row": to_int(g(r, 0)),
        }
    return skipped

# --- 적재 ---
ship = OrderedDict()
g_skip = d_skip = 0
g_n = d_n = 0
if os.path.exists(GLOBAL_CSV):
    before = len(ship); g_skip = build_global(read_csv(GLOBAL_CSV), ship); g_n = len(ship) - before
    print(f"글로벌 적재: {g_n}건 (빈송장 {g_skip} 생략)")
else:
    print(f"글로벌 CSV 없음(skip, 이미 적재됨): {GLOBAL_CSV}")
if os.path.exists(DOMESTIC_CSV):
    before = len(ship); d_skip = build_domestic(read_csv(DOMESTIC_CSV), ship); d_n = len(ship) - before
    print(f"국내 적재: {d_n}건 (빈송장 {d_skip} 생략, 합포 dedup)")
else:
    print(f"국내 CSV 없음: {DOMESTIC_CSV}"); sys.exit(1)

payload = list(ship.values())  # match_status 미포함 → 신규는 DB default 'unmatched', 기존 매칭 보존
for i in range(0, len(payload), 500):
    api("POST", "/shipments?on_conflict=invoice_no", payload[i:i+500], prefer="resolution=merge-duplicates,return=minimal")
print(f"upsert: {len(payload)}건 (글로벌 {g_n}+국내 {d_n}). carrier:", dict(Counter(s["carrier"] for s in payload).most_common(6)))
print("국가 분포:", dict(Counter(s["country_code"] for s in payload).most_common()))
print("PII(수취인명·전화·우편번호·주소) 미적재 확인")

# --- 매칭: collaborations.tracking_number ↔ shipments.invoice_no ---
shp_inv = {s["invoice_no"].strip() for s in api_paged("/shipments?select=invoice_no")}
cols = api_paged("/collaborations?select=id,tracking_number,invoice_no&tracking_number=not.is.null")
linked = 0
already = 0
matched_invoices = set()
for c in cols:
    tr = (c.get("tracking_number") or "").strip()
    if tr not in shp_inv: continue  # 12자리·오염 자연 필터(shipments에 없으면 skip)
    matched_invoices.add(tr)
    if c.get("invoice_no") == tr:
        already += 1; continue  # 이미 매칭(멱등)
    api("PATCH", f"/collaborations?id=eq.{c['id']}", {"invoice_no": tr}, prefer="return=minimal")
    linked += 1
# shipments.match_status='matched' (연결된 송장만, 배치)
if matched_invoices:
    inv_list = ",".join(f'"{i}"' for i in matched_invoices)
    api("PATCH", f"/shipments?invoice_no=in.({inv_list})", {"match_status": "matched"}, prefer="return=minimal")
print(f"매칭: 신규연결 {linked} · 기존(멱등) {already} · 총 matched 송장 {len(matched_invoices)}")
print("배송 적재·매칭 완료 (DELETE/TRUNCATE 0, invoice_no 멱등, match_status 보존)")
