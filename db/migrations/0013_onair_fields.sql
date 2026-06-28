-- onair-ingestion AC-1: content_pieces·collaborations 확장 (additive only).
-- 온에어 시트 적재용 필드. 1/3/7일차는 Bright Data 스크랩 raw 텍스트 블롭(에러 다수)이라
-- integer 아닌 text로 보존(나중 파싱). 정본 메트릭은 기존 views/likes/comments/shares/saves
-- + 신규 reposts. content_pieces도 출처 태깅(provenance) + external_ref 멱등 키.
alter table content_pieces add column if not exists reposts       integer;
alter table content_pieces add column if not exists quotes        integer;
alter table content_pieces add column if not exists concept       text;
alter table content_pieces add column if not exists content_type  text;
alter table content_pieces add column if not exists metrics_d1    text;   -- raw scrape (day 1)
alter table content_pieces add column if not exists metrics_d3    text;   -- raw scrape (day 3)
alter table content_pieces add column if not exists metrics_d7    text;   -- raw scrape (day 7)
alter table content_pieces add column if not exists source_system text;
alter table content_pieces add column if not exists external_ref  text;
create unique index if not exists content_pieces_external_ref_key
  on content_pieces (external_ref) where external_ref is not null;
create index if not exists content_pieces_source_system_idx
  on content_pieces (source_system);

-- collaborations: 온에어 캠페인 텍스트 보존(1차시민화는 다음 스프린트) + 파트너십·통화.
alter table collaborations add column if not exists campaign_label   text;
alter table collaborations add column if not exists partnership_code text;
alter table collaborations add column if not exists currency         text;
