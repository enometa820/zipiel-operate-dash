-- AC-5: shipments (logistics cost / waybill) + link from collaborations.
-- Loaded from the shipping sheet (EMS waybill export). PII (recipient name/phone/
-- zip/address) is NOT stored — only invoice, carrier, fee, country, weight, product.
create table if not exists shipments (
  invoice_no      text primary key,            -- 등기번호 (waybill no.)
  carrier         text,                        -- normalized: K-Packet / 한중해상 / EMS / SeaExpress
  request_date    date,
  processed_date  date,
  weight_g        integer,
  fee_krw         numeric(12,2),
  country_code    text,                         -- ISO-2; NULL when source held a brand tag
  brand_tag       text,                         -- non-country tag found in country column (e.g. H&H)
  customs_no      text,                         -- 수출신고번호 (first non-empty)
  delivery_status text,
  source_sheet_id text,
  source_row      integer,
  match_status    text not null default 'unmatched'
);
create index if not exists shipments_country_code_idx on shipments (country_code);

alter table collaborations
  add column if not exists invoice_no text references shipments(invoice_no);

alter table shipments enable row level security;
