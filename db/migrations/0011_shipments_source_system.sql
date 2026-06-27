-- AC-2 follow-up: tag shipments with source_system too (spec §3 req2: collaborations
-- ·creators·shipments all carry source_system; provenance model = every operational
-- object tagged). additive·idempotent. source_sheet_id already distinguishes the
-- exact sheet; source_system is the coarse origin bucket ('ship_sheet').
alter table shipments add column if not exists source_system text;
update shipments set source_system = 'ship_sheet' where source_system is null;
