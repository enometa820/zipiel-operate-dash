-- AC-3.2: one-time provenance backfill of pre-existing rows (data migration, additive).
-- external_ref uses a column expression ('legacy:'||id), which PostgREST PATCH cannot
-- do — so it lives here. Idempotent (WHERE ... IS NULL → 0 rows on re-run / fresh DB).
-- UPDATE fires the status-change trigger but status is unchanged, so NO history rows
-- are written and counts stay invariant.
update collaborations
  set external_ref = 'legacy:' || id::text
  where external_ref is null;

update collaborations
  set source_system = 'legacy_contact_list'
  where source_system is null;

update creators
  set source_system = 'legacy_contact_list', in_legacy_list = true
  where source_system is null;
