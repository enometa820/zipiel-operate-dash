# 밤샘 자율 루프 — zipiel-operate-dash

> 트랙: zipiel 시딩 운영 대시보드를 혼자 발전시킨다(코드·정합·신뢰·성능·UX).
> 시작: 2026-06-27 / 베이스라인 커밋: c9c91ed (데이터 토대 스프린트 완료·배포됨) / 빌드 통과 확인됨.

## 안전 가드 (night-loop §0)
- **자율 진행 OK**: 로컬 코드·문서·분석·빌드·tsc·lint·테스트·커밋·push·검증된 배포(`vercel --prod`, 팀 게이트 앱).
- **승인큐 보류(비가역·피드백 필요)**: operator 새 행 생성 UX(dedup·필드 선택 결정 필요)·온에어 시트 접근(401 외부)·캠페인 마스터 확정·크롤링 수집·DB destructive·marketing_expenses 금액.
- **절대 금지**: 날조 수치·크리덴셜 echo·vault 밖 평문·raw PII.
- 라이브 DB 변경은 additive only. ETL/마이그 재실행 전후 reconcile.

## 검증·배포 경로
- 빌드/타입/린트: `npm run build` · `npx tsc --noEmit` · `npm run lint`
- 데이터 정합: `python scripts/reconcile.py` (ALL PASS 기준)
- 배포: `vercel --prod --yes` (검증 확실 시, 팀 게이트 앱). push 시 GitHub→Vercel 자동배포도 트리거.

## 정본 (발굴 소스)
- research/02·03 (effie 스펙·빌드계획) · .planning/intel/decisions.yaml(D-1~18) · .enometa/*/spec·plan
- 라이브 Supabase(seeding-ops) · 코드(lib·components·app·scripts) — 진실 우선순위 = 코드·데이터 > 문서

## 라운드

### 라운드 1 (심야) — 다관점 발굴
(진행 중)
