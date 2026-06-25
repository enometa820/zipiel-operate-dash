-- Replace collab_status enum with effie's canonical 15-stage dropdown (EN labels).
-- Data is re-seeded by scripts/etl_seeding.py, so the status columns are emptied
-- first to allow a clean enum swap.

truncate collaboration_status_history, payments, content_pieces, collaborations cascade;

alter table collaborations alter column status drop default;
alter table collaborations alter column status type text;
alter table collaboration_status_history alter column from_status type text;
alter table collaboration_status_history alter column to_status type text;

drop type collab_status;
create type collab_status as enum (
  'Listing',
  'Contact Completed',
  'Negotiating',
  'Rate Inquiry',
  'Confirmed to Proceed',
  'Contract',
  'Request Shipping Information',
  'Shipping',
  'Guideline Sent',
  'Content in Production',
  'Content Uploaded',
  'On Hold',
  'Simple Seeding/PR',
  'Completed',
  'Drop'
);

alter table collaborations
  alter column status type collab_status using status::collab_status;
alter table collaborations
  alter column status set default 'Listing';
alter table collaboration_status_history
  alter column from_status type collab_status using nullif(from_status, '')::collab_status;
alter table collaboration_status_history
  alter column to_status type collab_status using to_status::collab_status;
