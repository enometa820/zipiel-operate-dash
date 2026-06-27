-- Perf indexes (additive). VIEW_ORDER sorts by listed_date desc on 14k rows;
-- SELECT joins campaigns by campaign_id. 0001 indexed status·manager·creator_id only.
create index if not exists idx_collab_listed_date on collaborations (listed_date desc);
create index if not exists idx_collab_campaign_id on collaborations (campaign_id);
