alter table public.leads
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists stage text,
  add column if not exists lead_score integer,
  add column if not exists priority text,
  add column if not exists is_dnc boolean not null default false,
  add column if not exists dnc_reason text,
  add column if not exists last_replied_at timestamptz;

update public.leads
set
  lead_score = coalesce(lead_score, motivation_score, 25),
  is_dnc = coalesce(is_dnc, false) or status = 'DNC' or classification = 'OPT_OUT',
  dnc_reason = case
    when coalesce(dnc_reason, '') <> '' then dnc_reason
    when status = 'DNC' or classification = 'OPT_OUT' then 'Existing DNC lead'
    else dnc_reason
  end,
  priority = coalesce(
    priority,
    case
      when classification = 'HOT' then 'high'
      when classification = 'WARM' then 'medium'
      when classification in ('DEAD', 'OPT_OUT') then 'low'
      else 'medium'
    end
  ),
  stage = coalesce(
    stage,
    case
      when status = 'DNC' or classification = 'OPT_OUT' then 'DNC'
      when status = 'Dead' or classification = 'DEAD' then 'Closed'
      when status = 'Hot' or classification = 'HOT' then 'Hot Lead'
      when status = 'Replied' then 'Replied'
      when status = 'Contacted' then 'Contacted'
      else 'New'
    end
  );

alter table public.messages
  add column if not exists phone text,
  add column if not exists classification text;

update public.messages
set phone = coalesce(phone, to_number)
where phone is null;

create table if not exists public.import_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  total_rows integer not null default 0,
  imported_count integer not null default 0,
  messaged_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists leads_user_stage_idx
  on public.leads (user_id, stage);

create index if not exists leads_user_dnc_idx
  on public.leads (user_id, is_dnc);

create index if not exists messages_lead_direction_created_idx
  on public.messages (lead_id, direction, created_at desc);

create index if not exists import_logs_user_created_idx
  on public.import_logs (user_id, created_at desc);

alter table public.import_logs enable row level security;

create policy "Users can view own import logs"
  on public.import_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own import logs"
  on public.import_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own import logs"
  on public.import_logs for update
  using (auth.uid() = user_id);
