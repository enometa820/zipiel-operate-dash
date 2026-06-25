-- RLS policies for the internal team tool.
-- Server-side reads/writes use the service_role key, which BYPASSES RLS.
-- These policies prepare for authenticated client access (auth added later):
-- authenticated users may read; writes stay server-side (service_role) for now.
-- anon stays fully blocked. PII columns (creators.email, shipping) will get
-- column/row-scoped policies when auth + roles land.

create policy "auth_read" on creators
  for select to authenticated using (true);
create policy "auth_read" on campaigns
  for select to authenticated using (true);
create policy "auth_read" on collaborations
  for select to authenticated using (true);
create policy "auth_read" on collaboration_status_history
  for select to authenticated using (true);
create policy "auth_read" on content_pieces
  for select to authenticated using (true);
create policy "auth_read" on payments
  for select to authenticated using (true);
