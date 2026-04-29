create table if not exists public.sms_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  auto_send_enabled boolean not null default false,
  send_window_start time not null default '09:00:00',
  send_window_end time not null default '20:00:00',
  timezone text not null default 'America/Chicago',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sms_queue (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  message text not null,
  status text not null default 'queued',
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists sms_queue_status_scheduled_idx
  on public.sms_queue (status, scheduled_for);

alter table public.foreclosure_leads
  add column if not exists owner_name text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists name text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists property_address text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists campaign_name text,
  add column if not exists campaign_type text,
  add column if not exists crm_status text default 'new',
  add column if not exists crm_notes text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists sms_settings_set_updated_at on public.sms_settings;
create trigger sms_settings_set_updated_at
  before update on public.sms_settings
  for each row execute procedure public.handle_updated_at();

drop trigger if exists foreclosure_leads_set_updated_at on public.foreclosure_leads;
create trigger foreclosure_leads_set_updated_at
  before update on public.foreclosure_leads
  for each row execute procedure public.handle_updated_at();

alter table public.sms_settings enable row level security;
alter table public.sms_queue enable row level security;

create policy "Users can view own sms settings"
  on public.sms_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own sms settings"
  on public.sms_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sms settings"
  on public.sms_settings for update
  using (auth.uid() = user_id);

create policy "Users can view own sms queue"
  on public.sms_queue for select
  using (
    exists (
      select 1
      from public.leads
      where public.leads.id = sms_queue.lead_id
        and public.leads.user_id = auth.uid()
    )
  );

create policy "Users can insert own sms queue"
  on public.sms_queue for insert
  with check (
    exists (
      select 1
      from public.leads
      where public.leads.id = sms_queue.lead_id
        and public.leads.user_id = auth.uid()
    )
  );

create policy "Users can update own sms queue"
  on public.sms_queue for update
  using (
    exists (
      select 1
      from public.leads
      where public.leads.id = sms_queue.lead_id
        and public.leads.user_id = auth.uid()
    )
  );
