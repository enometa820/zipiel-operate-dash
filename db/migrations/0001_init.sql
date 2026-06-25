-- zipiel Seeding Ops — initial schema
-- Normalized from the live "2026 Contact List" sheet (On-Air Sheet 39 cols).
-- See research/00-조사-종합.md §6. Current state lives on `collaborations`,
-- transitions are append-only on `collaboration_status_history`.

create extension if not exists "pgcrypto";

-- ---- enums ----
create type platform as enum ('instagram','tiktok','x','threads','xiaohongshu','douyin','youtube');
create type tier as enum ('Nano','Micro','Mid','Macro','Mega');
create type campaign_type as enum ('Gifted','Paid','Affiliate');
create type collab_status as enum (
  'Listed','Contacted','In Discussion','Rate Inquiry','Confirmed',
  'Contract','Shipping Info','Shipping','Guidelines Sent','In Production',
  'Published','Payment Pending','Completed','Dropped'
);
create type tax_type as enum (
  'kr_resident_3.3','nonresident_domestic','nonresident_overseas','none'
);
create type payment_status as enum ('pending','paid');

-- ---- creators (master) ----
create table creators (
  id          uuid primary key default gen_random_uuid(),
  handle      text not null,
  name        text,
  platform    platform not null,
  country     text not null,          -- ISO-2 (MY/SG/TW/JP/KR/HK/CN/US)
  followers   integer not null default 0,
  tier        tier not null,
  email       text,                   -- PII
  manager     text not null,
  avg_views   integer,                -- avg of last 6 posts (for CPV)
  created_at  timestamptz not null default now(),
  unique (handle, platform)
);

-- ---- campaigns ----
create table campaigns (
  id     uuid primary key default gen_random_uuid(),
  name   text not null,
  type   campaign_type not null,
  brand  text not null default 'zipiel',
  period_start date,
  period_end   date,
  budget_krw   bigint
);

-- ---- collaborations (join + current state) ----
create table collaborations (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references creators(id) on delete cascade,
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  status          collab_status not null default 'Listed',
  manager         text not null,
  content_fee_krw bigint,
  cpv             numeric(10,2),
  confirmed       boolean not null default false,
  usage_rights    text,
  source          text,               -- referral / crawling criteria
  shipped_product text,
  tracking_number text,
  last_contact    date,
  listed_date     date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on collaborations (status);
create index on collaborations (manager);
create index on collaborations (creator_id);

-- ---- status history (append-only audit) ----
create table collaboration_status_history (
  id               uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references collaborations(id) on delete cascade,
  from_status      collab_status,
  to_status        collab_status not null,
  changed_by       text not null,
  changed_at       timestamptz not null default now(),
  note             text
);
create index on collaboration_status_history (collaboration_id, changed_at);

-- ---- content pieces ----
create table content_pieces (
  id               uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references collaborations(id) on delete cascade,
  post_url         text,
  original_url     text,
  category         text,
  posted_at        date,
  likes            integer,
  comments         integer,
  views            integer,
  shares           integer,
  saves            integer,
  secondary_use    boolean default false,
  secondary_until  date
);

-- ---- payments ----
-- NOTE: tax is NOT a flat 3.3% for foreign creators. See research §8.
create table payments (
  id               uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references collaborations(id) on delete cascade,
  gross_krw        bigint not null,
  currency         text not null default 'KRW',
  fx_rate          numeric(14,6),
  tax_type         tax_type not null default 'none',
  withholding_rate numeric(5,2) not null default 0,
  tax_krw          bigint not null default 0,
  net_krw          bigint not null,
  status           payment_status not null default 'pending',
  paid_at          date
);

-- ---- auto-log status transitions ----
create or replace function log_status_change() returns trigger as $$
begin
  if new.status is distinct from old.status then
    insert into collaboration_status_history (collaboration_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, coalesce(new.manager, 'system'));
  end if;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_status_change
  before update on collaborations
  for each row execute function log_status_change();

-- ---- RLS (internal team; PII protection) ----
-- Enable RLS; policies are added per-role at deploy time.
-- Read open to authenticated internal team, writes gated. PII (creators.email,
-- shipping fields) should be restricted to assigned manager + admin.
alter table creators enable row level security;
alter table campaigns enable row level security;
alter table collaborations enable row level security;
alter table collaboration_status_history enable row level security;
alter table content_pieces enable row level security;
alter table payments enable row level security;
