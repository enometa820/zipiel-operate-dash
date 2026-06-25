-- fee_source: content_fee_krw 출처 신뢰도 격리(집행/제안 KPI 게이트).
-- sheet_krw  = KRW 명시 시트 컬럼(KR/CN/On-Air = Content Cost (KRW), SGP = Rate (KRW))
-- unverified = 통화 미표기 Rate 컬럼(TW/HK/US) — 합산 제외 대상
-- null       = fee 컬럼 없음(JP는 Engagement Rate뿐 → fee 미적재)
alter table collaborations add column if not exists fee_source text;
comment on column collaborations.fee_source is 'fee 출처 신뢰도: sheet_krw | unverified | null';
