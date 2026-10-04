-- Scholin: ad settings controlled from the server
-- Run once in the Supabase SQL editor.

create table if not exists ad_config (
  id uuid primary key default gen_random_uuid(),
  ads_enabled boolean not null default false,
  use_test_ads boolean not null default true,
  banner_unit_id text,
  feed_every int not null default 6 check (feed_every >= 4 and feed_every <= 20),
  updated_at timestamptz default now()
);

insert into ad_config (ads_enabled, use_test_ads)
select false, true
where not exists (select 1 from ad_config);

alter table ad_config enable row level security;

drop policy if exists "Signed in users read ad_config" on ad_config;
create policy "Signed in users read ad_config"
on ad_config for select
to authenticated
using (true);

drop policy if exists "Super admin manages ad_config" on ad_config;
create policy "Super admin manages ad_config"
on ad_config for all
using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true))
with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true));
