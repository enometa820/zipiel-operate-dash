# 진단(읽기전용): fee 정합·매니저 표기·집행 현황 baseline.
# ETL 재적재 전후를 같은 렌즈로 비교하기 위한 검증 인프라. 쓰기 없음.
import json, io, sys, urllib.request, urllib.error
from collections import Counter, defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = "C:/Projects/zipiel-operate-dash"

env = {}
for line in open(f"{ROOT}/.env.local", encoding="utf-8"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); env[k] = v
URL = env["NEXT_PUBLIC_SUPABASE_URL"]
SVC = env.get("SUPABASE_SERVICE_KEY") or env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
H = {"apikey": SVC, "Authorization": f"Bearer {SVC}", "Content-Type": "application/json"}

def get(path):
    req = urllib.request.Request(URL + "/rest/v1" + path, headers=H, method="GET")
    r = urllib.request.urlopen(req); raw = r.read().decode()
    return json.loads(raw) if raw else []

def count(path):
    h = dict(H); h["Range"] = "0-0"; h["Prefer"] = "count=exact"
    req = urllib.request.Request(URL + "/rest/v1" + path, headers=h, method="GET")
    try:
        r = urllib.request.urlopen(req)
        return r.headers.get("Content-Range", "?/?").split("/")[-1]
    except urllib.error.HTTPError as e:
        return f"ERR {e.code}"

def page(select):
    out = []
    for frm in range(0, 60000, 1000):
        h = dict(H); h["Range"] = f"{frm}-{frm+999}"
        req = urllib.request.Request(URL + "/rest/v1/collaborations?select=" + select, headers=h, method="GET")
        try:
            r = urllib.request.urlopen(req); rows = json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            print("page err", e.code, e.read().decode()[:300]); break
        out.extend(rows)
        if len(rows) < 1000: break
    return out

# fee_source 컬럼이 있으면 포함, 없으면(D1 이전) 폴백
sel = "status,content_fee_krw,manager,fee_source,creator:creators(country),campaign:campaigns(type)"
rows = page(sel)
if not rows:
    sel = "status,content_fee_krw,manager,creator:creators(country),campaign:campaigns(type)"
    rows = page(sel)
    for r in rows: r["fee_source"] = None
HAS_FS = "fee_source" in sel

print(f"=== 협업 총 {len(rows)}건 (fee_source 컬럼: {'있음' if HAS_FS else '없음'}) ===\n")

def f(r):
    v = r.get("content_fee_krw")
    return float(v) if v not in (None, "") else 0.0

# 국가별 fee
byc = defaultdict(lambda: {"n": 0, "feeN": 0, "sum": 0.0})
for r in rows:
    c = (r.get("creator") or {}).get("country") or "?"
    byc[c]["n"] += 1
    if f(r) > 0: byc[c]["feeN"] += 1; byc[c]["sum"] += f(r)
print("=== 국가별 fee (건수 · fee있음 · 합 · 평균) ===")
for c, v in sorted(byc.items(), key=lambda x: -x[1]["sum"]):
    avg = round(v["sum"]/v["feeN"]) if v["feeN"] else 0
    print(f"  {c:4} {v['n']:6}건  fee {v['feeN']:5}  합 {v['sum']/1e8:7.2f}억  평균 {avg:>12,}")

# campaign type x 상태별 fee
byt = defaultdict(lambda: {"n": 0, "sum": 0.0})
for r in rows:
    t = (r.get("campaign") or {}).get("type") or "?"
    byt[t]["n"] += 1; byt[t]["sum"] += f(r)
print("\n=== campaign type별 fee 합 ===")
for t, v in sorted(byt.items(), key=lambda x: -x[1]["sum"]):
    print(f"  {t:10} {v['n']:6}건  합 {v['sum']/1e8:7.2f}억")

# fee_source별
if HAS_FS:
    bys = defaultdict(lambda: {"n": 0, "sum": 0.0})
    for r in rows:
        s = r.get("fee_source") or "(null)"
        bys[s]["n"] += 1; bys[s]["sum"] += f(r)
    print("\n=== fee_source별 (집행/제안 게이트) ===")
    for s, v in sorted(bys.items(), key=lambda x: -x[1]["sum"]):
        print(f"  {s:12} {v['n']:6}건  합 {v['sum']/1e8:7.2f}억")

# 정직 집행 후보: Paid & 완료단계 & (게이트 통과)
DONE = {"Content Uploaded", "Completed"}
exec_rows = [r for r in rows if (r.get("campaign") or {}).get("type") == "Paid" and r.get("status") in DONE]
exec_ok = [r for r in exec_rows if (not HAS_FS or r.get("fee_source") == "sheet_krw") and f(r) > 0]
print(f"\n=== Executed fee 후보 (Paid & 콘텐츠업로드/완료) ===")
print(f"  대상 {len(exec_rows)}건 / fee&게이트 통과 {len(exec_ok)}건 / 합 {sum(f(r) for r in exec_ok):,.0f}원")

# 상태 분포
print("\n=== 상태 분포 ===")
for s, n in Counter(r["status"] for r in rows).most_common():
    print(f"  {n:6}  {s}")

# 매니저 distinct (정규화 근거)
print("\n=== 매니저 distinct 표기 ===")
for m, n in Counter((r.get("manager") or "(빈값)") for r in rows).most_common():
    print(f"  {n:6}  '{m}'")

# 테이블 카운트
print("\n=== 테이블 행수 ===")
print("  payments:", count("/payments?select=id"))
print("  collaboration_status_history:", count("/collaboration_status_history?select=id"))
print("  content_pieces:", count("/content_pieces?select=id"))
