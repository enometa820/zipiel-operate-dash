-- onair-ingestion AC-5 보강: content_pieces에 scheduled_post_date 추가(달성률 분모=예상 온에어).
-- 0013에서 누락(content_pieces엔 posted_at만 있었음). additive.
alter table content_pieces add column if not exists scheduled_post_date date;
