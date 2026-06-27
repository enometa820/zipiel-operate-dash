-- AC-2: provenance / source tagging columns (prerequisite for lossless incremental merge).
-- additive only. Lets every row answer "which sheet/tab/row did this come from",
-- enables idempotent re-sync (external_ref unique), legacy-pool separation,
-- and forward-compat for source_system = 'onair_2026' / 'crawler' (future sprints).

alter table collaborations add column if not exists source_system  text;
alter table collaborations add column if not exists source_sheet_id text;
alter table collaborations add column if not exists source_tab     text;
alter table collaborations add column if not exists source_row     integer;
alter table collaborations add column if not exists external_ref    text;

-- partial unique index on external_ref (NULL allowed) → idempotent upsert grain.
create unique index if not exists collaborations_external_ref_key
  on collaborations (external_ref) where external_ref is not null;
create index if not exists collaborations_source_system_idx
  on collaborations (source_system);

-- creators: source tagging + legacy-pool flag (effie: "기존 리스트업 중복 인원 별도표시·필터").
alter table creators add column if not exists source_system  text;
alter table creators add column if not exists in_legacy_list boolean not null default false;
create index if not exists creators_source_system_idx on creators (source_system);
