-- Seed data — mirrors lib/data.ts (FICTIONAL creators, no real PII).
-- Applied automatically by `supabase db reset` / `supabase start`.

insert into campaigns (name, type, brand) values
  ('Clay Mask Global Q3', 'Gifted', 'zipiel'),
  ('Tone-Up Cream JP', 'Paid', 'zipiel'),
  ('Serum Affiliate TW', 'Affiliate', 'zipiel');

insert into creators (handle, name, platform, country, followers, tier, manager, avg_views) values
  ('glow_gummi', 'Glow Gummi', 'tiktok', 'MY', 8200, 'Nano', 'sol', 12000),
  ('aiko.skin', 'Aiko', 'instagram', 'JP', 142000, 'Mid', 'anna', 51000),
  ('lele_amanslife', 'Lele', 'threads', 'TW', 33000, 'Micro', 'sol', 9800),
  ('sg_yuncat', 'Yun', 'tiktok', 'SG', 21500, 'Micro', 'sol', 17400),
  ('dumpling_soda', 'Dumpling Soda', 'instagram', 'TW', 410000, 'Macro', 'nhi', 120000),
  ('mei.routine', 'Mei', 'xiaohongshu', 'CN', 88000, 'Micro', 'anna', 26000),
  ('hana_babe', 'Hana', 'instagram', 'JP', 1250000, 'Mega', 'anna', 340000),
  ('tang_tui', 'Tang Tui', 'tiktok', 'TW', 64000, 'Micro', 'nhi', 41000),
  ('nadia.beauty', 'Nadia', 'tiktok', 'MY', 9700, 'Nano', 'sol', 8200),
  ('yuki.care', 'Yuki', 'x', 'JP', 4570, 'Nano', 'anna', 3100),
  ('sora_glow', 'Sora', 'instagram', 'SG', 175000, 'Mid', 'sol', 62000),
  ('chen.makeup', 'Chen', 'instagram', 'TW', 540000, 'Macro', 'nhi', 150000);

-- collaborations resolved by creator handle + campaign name
insert into collaborations (creator_id, campaign_id, status, manager, content_fee_krw, cpv, tracking_number, post_url, last_contact, listed_date, notes)
select c.id, cmp.id, v.status::collab_status, v.manager, v.fee, v.cpv, v.tracking, v.post_url, v.last_contact::date, v.listed_date::date, v.notes
from (values
  ('glow_gummi','Clay Mask Global Q3','Listed','sol',null::bigint,null::numeric,null,null,'2026-06-22','2026-06-22',null),
  ('nadia.beauty','Clay Mask Global Q3','Contacted','sol',null,null,null,null,'2026-06-23','2026-06-18',null),
  ('sg_yuncat','Clay Mask Global Q3','In Discussion','sol',null,null,null,null,'2026-06-24','2026-06-10','Asked about gifted collab'),
  ('lele_amanslife','Serum Affiliate TW','Rate Inquiry','sol',300000,null,null,null,'2026-06-23',null,null),
  ('aiko.skin','Tone-Up Cream JP','Confirmed','anna',280000,5.5,null,null,'2026-06-21',null,null),
  ('sora_glow','Tone-Up Cream JP','Contract','sol',450000,null,null,null,'2026-06-20',null,null),
  ('tang_tui','Serum Affiliate TW','Shipping','nhi',null,null,'TW884021',null,'2026-06-19',null,null),
  ('mei.routine','Clay Mask Global Q3','Guidelines Sent','anna',null,null,null,null,'2026-06-18',null,null),
  ('dumpling_soda','Clay Mask Global Q3','In Production','nhi',null,null,null,null,'2026-06-17',null,null),
  ('aiko.skin','Tone-Up Cream JP','Published','anna',null,4.9,null,'https://instagram.com/p/xyz','2026-06-15',null,null),
  ('hana_babe','Tone-Up Cream JP','Payment Pending','anna',1800000,5.3,null,'https://x.com/post','2026-06-12',null,null),
  ('chen.makeup','Serum Affiliate TW','Completed','nhi',600000,4.0,null,'https://instagram.com/p/abc','2026-06-10',null,null),
  ('yuki.care','Clay Mask Global Q3','Dropped','anna',null,null,null,null,'2026-06-08',null,'No reply 1 month+')
) as v(handle, campaign, status, manager, fee, cpv, tracking, post_url, last_contact, listed_date, notes)
join creators c on c.handle = v.handle
join campaigns cmp on cmp.name = v.campaign;

-- payments (Japanese creators perform abroad → no KR withholding)
insert into payments (collaboration_id, gross_krw, tax_type, withholding_rate, tax_krw, net_krw, status)
select co.id, 1800000, 'nonresident_overseas', 0, 0, 1800000, 'pending'
from collaborations co join creators c on c.id = co.creator_id
where c.handle = 'hana_babe' and co.status = 'Payment Pending';

insert into payments (collaboration_id, gross_krw, tax_type, withholding_rate, tax_krw, net_krw, status)
select co.id, 600000, 'nonresident_overseas', 0, 0, 600000, 'paid'
from collaborations co join creators c on c.id = co.creator_id
where c.handle = 'chen.makeup' and co.status = 'Completed';

-- status history for hana_babe (transitions before current state)
insert into collaboration_status_history (collaboration_id, from_status, to_status, changed_by, changed_at)
select co.id, f::collab_status, t::collab_status, 'anna', ts::timestamptz
from collaborations co
join creators c on c.id = co.creator_id,
lateral (values
  ('Published','Payment Pending','2026-06-12T09:00:00Z'),
  ('In Production','Published','2026-06-10T09:00:00Z'),
  ('Confirmed','In Production','2026-06-05T09:00:00Z')
) as h(f, t, ts)
where c.handle = 'hana_babe' and co.status = 'Payment Pending';
