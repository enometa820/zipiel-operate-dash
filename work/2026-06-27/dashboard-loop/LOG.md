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

### 라운드 1 (심야) — KPI 정직성·이중언어·성능·정리 (완료·배포)
- 발굴: 6렌즈 병렬 워크플로우 → 41 findings → 자율큐 10 / 승인큐 8 / stale 6.
- 구현(전 10건, 커밋 43155dc):
  - **재무 정직성**: executedFee 게이트 정정(Uploaded 과대계상 차단 → Completed+게시링크+신뢰KRW, 라이브 3건) · fee 원장 unknownSource 카테고리 신설(출처미상 금액 포착, 라이브 0건 = 누수 없음 확인) · 라벨 오독 방지.
  - **이중언어 정합**: DetailPanel·StatusEditor 상태라벨 statusLabel(한/영) 통일.
  - **성능**: fetchLogisticsStats 6쿼리 Promise.all 병렬 · payments 상한 · 인덱스 0012(listed_date desc·campaign_id).
  - **출처 추적**: mapCollab/mapCreator에 source_system·external_ref·in_legacy_list 매핑.
  - **접근성**: GridToolbar 컬럼이동 aria-label. **정합**: status 페이지 stale '칸반'→시트그리드 교정. **정리**: cn·StatusBadge·groupKeyOf 제거.
- 검증: tsc·lint·build 0 · reconcile ALL PASS(데이터 불변) · push 자동배포.
- 승인 대기(보류): 다통화 스키마·온에어 적재·content_pieces·캠페인 1차시민화·marketing_expenses·invoice 매칭 방향·Drop 후보큐 — 외부의존·정책 피드백 필요.
- 회고: 발굴이 정확했고(근거 file:line) 종합이 중복 잘 병합. 라운드2는 라운드1 미탐 영역(정확성·테스트부재·복원력·Deal페이지·RLS·데이터품질)로.

### 라운드 2 (심야) — 정확성·복원력·테스트·a11y (완료·배포)
- 발굴: 6렌즈(정확성·복원력·테스트·Deal·데이터품질·RLS) → 51 findings → 자율큐 10 / 승인큐 3.
- 구현(9/10):
  - **데이터손실 버그 수정(rank1)**: payment paidAt를 type→query→editor로 연결 — 지급 편집 시 날짜가 조용히 지워지던 버그 제거.
  - **정확성**: etl_shipments to_int 1억 상한(etl_seeding 일치) · daysSince/daysAgo NaN 가드('NaN d ago'·KPI 오염 차단).
  - **복원력**: StatusEditor·DashboardClient 서버액션 실패를 인라인/배너로 표시(silent rollback 제거).
  - **테스트 토대 신설**: vitest + grid-filters·grid-prefs 단위테스트 16건(전 green), `npm test`.
  - **a11y**: PaymentEditor 입력 aria-label + gross min=0 · Deal 빈결제 메시지 상태인지화.
  - **PII 위생**: creator SELECT를 표시 컬럼만으로 좁혀 email 전송 중단(소비자 0 확인).
  - **출처 추적**: (라운드1서 매핑됨) · **스크립트 복원력**: ETL/recon 소켓 타임아웃 30s.
- 검증: vitest 16 · tsc · build · lint 0. (이번 라운드 스키마·데이터 변경 0 — 읽기경로/UI/스크립트만.)
- 보류: **item5 pytest ETL** — main-guard 재구조화가 라이브 파이프라인 구조 변경이라 무인 루프 리스크>가치, 사용자 확인 후. RLS products/shipments 정책(라이브 접근제어, service key로 현재 동작), to_date 달력검증+ETL 재적재(데이터 정정) — 승인큐.
- 회고: rank1은 진짜 버그였음(발굴 가치 입증). 읽기경로 변경이라 무배포 리스크 낮음. 라운드3는 미답 영역(반응형/모바일·DetailPanel 에러상태·Deal페이지 정보밀도·번들/이미지)로.
