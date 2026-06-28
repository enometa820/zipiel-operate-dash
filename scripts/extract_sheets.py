# 원본 시트 100% 추출 — 온에어·배송(우리 데이터, full) + 참조예시(위마케팅·GM1, 샘플).
# enometa OAuth 토큰(vault, drive/sheets readonly·자동갱신)으로 읽는다. PII 포함 → 출력 dir은 gitignore.
# 구조만 담은 매니페스트(research/04-원본-추출-매니페스트.md)는 PII 없어 커밋 가능.
# Usage: python scripts/extract_sheets.py
import json, csv, sys, io, os, time, urllib.request, urllib.parse as up, urllib.error, socket

socket.setdefaulttimeout(60)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = "C:/Projects/zipiel-operate-dash"
TOKEN = "C:/Users/sickkiya/.vault/zipiel/oauth-enometa-token.json"

t = json.load(open(TOKEN))
body = up.urlencode({"client_id": t["client_id"], "client_secret": t["client_secret"], "refresh_token": t["refresh_token"], "grant_type": "refresh_token"}).encode()
AT = json.loads(urllib.request.urlopen(urllib.request.Request(t["token_uri"], data=body, method="POST")).read().decode())["access_token"]
H = {"Authorization": f"Bearer {AT}"}

def api(url):
    # 페이싱 + 429/5xx 백오프 재시도(rate limit 회피)
    for attempt in range(5):
        try:
            r = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=H)).read().decode())
            time.sleep(0.4)  # 호출 간 페이싱
            return r
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503) and attempt < 4:
                time.sleep(2 ** attempt + 1)  # 2,3,5,9s 백오프
                continue
            raise

def tabs(sid):
    m = api(f"https://sheets.googleapis.com/v4/spreadsheets/{sid}?fields=properties.title,sheets.properties(sheetId,title,gridProperties)")
    return m["properties"]["title"], [(s["properties"]["title"], s["properties"]["sheetId"],
            s["properties"].get("gridProperties", {}).get("rowCount", 0),
            s["properties"].get("gridProperties", {}).get("columnCount", 0)) for s in m["sheets"]]

def values(sid, title, cap):
    rng = "'" + title.replace("'", "''") + f"'!1:{cap}"
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{sid}/values/" + up.quote(rng, safe="")
    return api(url).get("values", [])

def safe(name):
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in name)[:50]

# (이름, spreadsheetId, 출력서브dir, 캡, 비고)
SHEETS = [
    ("온에어(B)", "10ymVkhZTXEaCHHqQbv8ZZf21gEufW20pvo3cMOAr-P0", "onair-snapshot", 5000, "우리 데이터 SSOT"),
    ("배송(C)", "1GlDPYMyDal5az4ouL4AnAJfvRYZEr9kpW2U-E-5Tqj0", "ship-snapshot", 5000, "물류·송장(국내+글로벌)"),
    ("위마케팅예시", "1S71xU03vePxmH7mANbF_TW4ZlYZ0Lko_kC8D6D_pHUE", "ref-snapshot/wemkt", 200, "대시보드 구조 참조"),
    ("GM1예시", "13FP_Uly6-3mO8D9YNck7rvDJ6TyAsc9lQNVjCPfZlPE", "ref-snapshot/gm1", 200, "성과분석 구조 참조"),
]

manifest = ["# 원본 시트 추출 매니페스트 (구조 전용·PII 없음)", "",
            "> 생성: scripts/extract_sheets.py / enometa OAuth(readonly). 원본 CSV는 gitignore된 research/{onair,ship,ref}-snapshot/. 이 문서는 탭·차원·헤더(컬럼명)만 — 값 없음.", ""]

for nm, sid, sub, cap, note in SHEETS:
    title, tl = tabs(sid)
    outdir = f"{ROOT}/research/{sub}"
    os.makedirs(outdir, exist_ok=True)
    manifest.append(f"## {nm} — {title}  ({len(tl)}탭, {note})")
    manifest.append(f"- spreadsheetId: `{sid}`")
    manifest.append("")
    print(f"\n=== {nm}: {title} ({len(tl)}탭) → {sub} (cap {cap}) ===")
    for ttl, gid, rc, cc in tl:
        try:
            v = values(sid, ttl, cap)
        except Exception as e:
            print(f"  ! {ttl}: 실패 {e}"); manifest.append(f"- **{ttl}** (gid {gid}) — 추출 실패"); continue
        fn = f"{safe(ttl)}__gid{gid}.csv"
        with open(f"{outdir}/{fn}", "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerows(v)
        capped = " ⚠CAP" if rc > cap else ""
        print(f"  {ttl}: {len(v)}행 추출(시트 {rc}x{cc}){capped} → {fn}")
        # 헤더 후보 = 비어있지 않은 셀 최다 행(상위 8행)
        hi = max(range(min(8, len(v))), key=lambda i: sum(1 for c in v[i] if str(c).strip())) if v else 0
        hdr = [str(c).strip().replace("\n", "/") for c in (v[hi] if v else []) if str(c).strip()]
        manifest.append(f"- **{ttl}** (gid {gid}) — 시트 {rc}×{cc}, 추출 {len(v)}행{' ⚠CAP' if rc>cap else ''}. 헤더(row{hi+1}, {len(hdr)}칸): {' | '.join(hdr)[:800]}")
    manifest.append("")

open(f"{ROOT}/research/04-원본-추출-매니페스트.md", "w", encoding="utf-8").write("\n".join(manifest))
print(f"\n매니페스트: research/04-원본-추출-매니페스트.md ({len(manifest)}줄)")
print("추출 완료 — 원본 CSV는 gitignore, 매니페스트는 구조만(커밋 가능)")
