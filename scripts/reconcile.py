# Reconciliation — source<->target proof that the safe-sync sprint "is done". (AC-6)
# Usage:
#   python scripts/reconcile.py snapshot   # record pre-apply counts (AC-6.2 baseline)
#   python scripts/reconcile.py            # run all checks (+ diff vs snapshot if present)
#   python scripts/reconcile.py [ship.csv] # override shipping CSV path for the source compare
import json, re, sys, io, os, csv, socket, tempfile, urllib.request, urllib.error
from collections import OrderedDict

socket.setdefaulttimeout(30)  # 네트워크 블립 시 무한 행 방지
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = "C:/Projects/zipiel-operate-dash"
DEFAULT_CSV = ("C:/Users/sickkiya/AppData/Local/Temp/claude/"
               "C--Projects-zipiel-operate-dash/1563e266-77f5-4a2b-b3f6-99dd62b3f291/"
               "scratchpad/ship-2081447250.csv")
SNAP = os.path.join(tempfile.gettempdir(), "zipiel_reconcile_snapshot.json")

env = {}
for line in open(f"{ROOT}/.env.local", encoding="utf-8"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); env[k] = v
URL, SVC = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_KEY"]
HDR = {"apikey": SVC, "Authorization": f"Bearer {SVC}"}

def count(table, query="", col="id"):
    q = f"/rest/v1/{table}?select={col}{query}"
    req = urllib.request.Request(URL + q, headers={**HDR, "Prefer": "count=exact", "Range": "0-0"}, method="GET")
    try:
        r = urllib.request.urlopen(req)
        cr = r.headers.get("Content-Range", "0-0/0")
        return int(cr.split("/")[-1])
    except urllib.error.HTTPError as e:
        return -1  # invalid filter (e.g. dropped enum value) -> signal

def get(path):
    req = urllib.request.Request(URL + "/rest/v1" + path, headers=HDR, method="GET")
    r = urllib.request.urlopen(req); raw = r.read().decode()
    return json.loads(raw) if raw else []

def num(x):
    x = re.sub(r"[^\d]", "", x or "")
    return int(x) if x else 0

# ---- snapshot mode (AC-6.2 baseline) ----
def take_snapshot():
    snap = {
        "collaborations": count("collaborations"),
        "creators": count("creators"),
        "status_history": count("collaboration_status_history"),
        "content_pieces": count("content_pieces"),
    }
    # capture one manager-edited status (if any) to assert preservation across re-runs
    edited = get("/collaboration_status_history?select=collaboration_id&changed_by=neq.system&limit=1")
    if edited:
        cid = edited[0]["collaboration_id"]
        cur = get(f"/collaborations?select=id,status&id=eq.{cid}")
        if cur:
            snap["edited_sample"] = {"id": cid, "status": cur[0]["status"]}
    json.dump(snap, open(SNAP, "w"))
    print("스냅샷 기록:", snap, f"\n  -> {SNAP}")

# ---- shipping CSV source figures (AC-6.1) ----
def csv_figures(path):
    if not os.path.exists(path):
        return None
    rows = list(csv.reader(open(path, encoding="utf-8")))
    data = [r for r in rows[1:] if any(c.strip() for c in r)]
    inv = OrderedDict()
    for r in data:
        k = r[3].strip() if len(r) > 3 else ""
        if k and k not in inv:
            inv[k] = num(r[7]) if len(r) > 7 else 0
    return {"unique_invoices": len(inv), "fee_sum": sum(inv.values())}

def run_checks(csv_path):
    results = []  # (label, ok, detail)

    # 1. shipments vs shipping CSV source
    fig = csv_figures(csv_path)
    db_ship = count("shipments", col="invoice_no")
    db_fee_rows = get("/shipments?select=fee_krw")
    db_fee = sum(int(x["fee_krw"] or 0) for x in db_fee_rows)
    if fig:
        results.append(("배송 송장수 CSV==DB", fig["unique_invoices"] == db_ship,
                        f"CSV {fig['unique_invoices']} / DB {db_ship}"))
        results.append(("물류비 합 CSV==DB", fig["fee_sum"] == db_fee,
                        f"CSV {fig['fee_sum']:,} / DB {db_fee:,}"))
    else:
        results.append(("배송 CSV 접근", False, f"CSV 없음: {csv_path} (DB shipments={db_ship})"))

    # 2. source_system fill rate = 100%
    col_total = count("collaborations")
    col_null = count("collaborations", "&source_system=is.null")
    results.append(("collaborations source_system 100%", col_null == 0,
                    f"null {col_null} / total {col_total}"))
    cre_total = count("creators")
    cre_null = count("creators", "&source_system=is.null")
    results.append(("creators source_system 100%", cre_null == 0,
                    f"null {cre_null} / total {cre_total}"))

    # 3. products seed present
    prods = {p["name"]: p["cogs_krw"] for p in get("/products?select=name,cogs_krw")}
    want = {"세럼": 2438, "크림": 2900, "클레이": 2618}
    ok_prod = all(prods.get(n) is not None and int(float(prods[n])) == v for n, v in want.items())
    results.append(("products 시드(세럼/크림/클레이)", ok_prod, str(prods)))

    # 4. 'On Hold' residue 0 (enum renamed to 'Payment Pending')
    on_hold = count("collaborations", "&status=eq.On%20Hold")  # -1 if enum value gone (good)
    pay_pending = count("collaborations", "&status=eq.Payment%20Pending")
    results.append(("'On Hold' 잔존 0 (→Payment Pending)", on_hold <= 0,
                    f"On Hold 쿼리={on_hold}(<=0 정상), Payment Pending={pay_pending}"))

    # 4b. 온에어 적재(onair-ingestion AC-8)
    onair_collab = count("collaborations", "&source_system=eq.onair_2026")
    legacy_collab = count("collaborations", "&source_system=eq.legacy_contact_list")
    cp_total = count("content_pieces")
    cp_onair = count("content_pieces", "&source_system=eq.onair_2026")
    results.append(("온에어 협업 적재(onair_2026)", onair_collab > 0, f"{onair_collab}건 (legacy frozen {legacy_collab})"))
    results.append(("content_pieces 적재", cp_total > 0, f"총 {cp_total} / onair {cp_onair}"))
    # provenance discrete 채움(AC-2): onair_2026 협업의 source_tab(gid) NULL 0
    prov_null = count("collaborations", "&source_system=eq.onair_2026&source_tab=is.null")
    results.append(("온에어 provenance(source_tab) 채움", prov_null == 0, f"NULL {prov_null}/{onair_collab}"))
    # content_pieces 1/3/7일차(metrics_d1) 채움률 — 정보(raw text 일부만, 게이트 아님)
    md1 = count("content_pieces", "&source_system=eq.onair_2026&metrics_d1=not.is.null")
    rate = (md1 * 100 // cp_onair) if cp_onair else 0
    results.append(("content_pieces 1일차(metrics_d1) 채움률", True, f"{md1}/{cp_onair} ({rate}%)"))
    # content_pieces PII 컬럼 0(AC-5 PII 절대선): 스키마에 email/phone/address/이름/주소/전화 부재
    cp_cols = list((get("/content_pieces?select=*&limit=1") or [{}])[0].keys())
    pii_cols = [c for c in cp_cols if any(p in c.lower() for p in ("email", "phone", "address", "이름", "주소", "전화"))]
    results.append(("content_pieces PII 컬럼 0", len(pii_cols) == 0, f"PII컬럼 {pii_cols or '없음'}"))
    # content_pieces 에러문자열 잔존 0 (metrics_d1/d3/d7 raw에 ERROR/#REF 정제 확인)
    dirty = get("/content_pieces?select=id&or=(metrics_d1.ilike.*ERROR*,metrics_d1.ilike.*%23REF*,metrics_d3.ilike.*ERROR*,metrics_d7.ilike.*ERROR*)&limit=5")
    results.append(("content_pieces 에러문자열 정제(잔존 0)", len(dirty) == 0, f"잔존 {len(dirty)}"))

    # 5. AC-6.2 — diff vs pre-apply snapshot (re-run safety)
    if os.path.exists(SNAP):
        snap = json.load(open(SNAP))
        tables = {"collaborations": "collaborations", "creators": "creators",
                  "status_history": "collaboration_status_history", "content_pieces": "content_pieces"}
        for key, table in tables.items():
            now = count(table)
            base = snap.get(key)
            results.append((f"[재실행안전] {key} 행수 불변", base is not None and now == base,
                            f"전 {base} / 후 {now}"))
        es = snap.get("edited_sample")
        if es:
            cur = get(f"/collaborations?select=status&id=eq.{es['id']}")
            now_status = cur[0]["status"] if cur else None
            results.append(("[재실행안전] 인앱편집 status 보존", now_status == es["status"],
                            f"기준 '{es['status']}' / 현재 '{now_status}'"))
    else:
        results.append(("[재실행안전] 스냅샷", False, "스냅샷 없음 — 먼저 `reconcile.py snapshot`을 실행하세요"))

    # ---- report ----
    print("\n==== RECONCILIATION ====")
    all_ok = True
    for label, ok, detail in results:
        mark = "PASS" if ok else "FAIL"
        if not ok: all_ok = False
        print(f"  [{mark}] {label}: {detail}")
    print("========================")
    print("결과:", "ALL PASS ✅" if all_ok else "FAIL ❌ — 위 항목 확인")
    return all_ok

if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "snapshot":
        take_snapshot()
    else:
        csv_path = arg if (arg and arg.endswith(".csv")) else DEFAULT_CSV
        ok = run_checks(csv_path)
        sys.exit(0 if ok else 1)
