create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  campaign_type text check (campaign_type in ('cash_offer', 'foreclosure_help', 'probate', 'tax_sale')),
  template_variant text,
  status text default 'active',
  total_leads integer default 0,
  messaged_count integer default 0,
  replied_count integer default 0,
  hot_count integer default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.leads
  add column if not exists campaign_id uuid references public.campaigns(id);

create index if not exists leads_campaign_id
  on public.leads (campaign_id);

create index if not exists campaigns_user_created_idx
  on public.campaigns (user_id, created_at desc);

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute procedure public.handle_updated_at();

alter table public.campaigns enable row level security;

create policy "Users can view own campaigns"
  on public.campaigns for select
  using (auth.uid() = user_id);

create policy "Users can insert own campaigns"
  on public.campaigns for insert
  with check (auth.uid() = user_id);

create policy "Users can update own campaigns"
  on public.campaigns for update
  using (auth.uid() = user_id);

create policy "Users can delete own campaigns"
  on public.campaigns for delete
  using (auth.uid() = user_id);
