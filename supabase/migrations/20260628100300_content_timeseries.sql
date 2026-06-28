-- content-timeseries: 1/3/7일차 성과 정수 컬럼(additive). raw text(metrics_d1/d3/d7)는 보존.
-- etl_onair가 raw 블롭("재생: N\n좋아요: N\n댓글: N")을 파싱해 적재. 파싱 실패=null(날조 0).
alter table content_pieces add column if not exists views_d1    integer;
alter table content_pieces add column if not exists views_d3    integer;
alter table content_pieces add column if not exists views_d7    integer;
alter table content_pieces add column if not exists likes_d1    integer;
alter table content_pieces add column if not exists likes_d3    integer;
alter table content_pieces add column if not exists likes_d7    integer;
alter table content_pieces add column if not exists comments_d1 integer;
alter table content_pieces add column if not exists comments_d3 integer;
alter table content_pieces add column if not exists comments_d7 integer;
