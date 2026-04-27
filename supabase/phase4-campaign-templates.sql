alter table public.campaigns
  add column if not exists first_sms_template text,
  add column if not exists followup_1_template text,
  add column if not exists followup_2_template text,
  add column if not exists followup_3_template text;

alter table public.campaigns
  drop constraint if exists campaigns_campaign_type_check;

alter table public.campaigns
  add constraint campaigns_campaign_type_check
  check (campaign_type in ('cash_offer', 'foreclosure_help', 'probate', 'tax_sale', 'custom'));
