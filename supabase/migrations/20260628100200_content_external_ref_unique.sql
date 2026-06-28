-- onair-ingestion 수정: content_pieces.external_ref 부분 unique → full unique.
-- PostgREST on_conflict=external_ref는 partial index(WHERE ...)를 못 쓴다(42P10).
-- Postgres는 NULL을 distinct로 취급 → full unique도 다중 NULL 허용(비-onair 출처 안전).
drop index if exists content_pieces_external_ref_key;
create unique index if not exists content_pieces_external_ref_key on content_pieces (external_ref);
