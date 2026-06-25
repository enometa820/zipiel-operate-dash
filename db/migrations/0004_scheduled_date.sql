-- Scheduled upload/post date from the sheet (업로드 예정일).
alter table collaborations add column if not exists scheduled_post_date date;
