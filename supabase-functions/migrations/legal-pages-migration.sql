-- Privacy Policy and Contact info, written by the super admin, shown to everyone in Settings.
-- Run once in the Supabase SQL editor. Terms and About already exist.
alter table app_settings add column if not exists privacy_policy text;
alter table app_settings add column if not exists privacy_updated_at timestamptz;
alter table app_settings add column if not exists contact_info text;
alter table app_settings add column if not exists contact_updated_at timestamptz;
