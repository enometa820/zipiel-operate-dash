-- AC-4: products (COGS) master + seed.
-- effie explicit unit costs (KRW): 세럼 2,438 · 크림 2,900 · 클레이 2,618.
-- aliases for name normalization when matching shipment/onair product columns.
create table if not exists products (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  sku       text,
  cogs_krw  numeric(12,2),
  aliases   text[] not null default '{}'
);

insert into products (name, cogs_krw, aliases) values
  ('세럼', 2438, array['serum','세럼','앰플','ampoule']),
  ('크림', 2900, array['cream','크림','모이스처','moisturizer']),
  ('클레이', 2618, array['clay','클레이','마스크','mask','클레이마스크'])
on conflict (name) do update
  set cogs_krw = excluded.cogs_krw,
      aliases  = excluded.aliases;

alter table products enable row level security;
