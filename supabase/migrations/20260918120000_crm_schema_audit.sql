-- CRM schema audit — ADDITIVE ONLY, idempotent, safe to re-run.
--
-- Brings the live database (project wdbxxjfgitlxeoluvanf) in line with what the
-- application code and types/database.ts expect. Nothing is dropped or renamed.
--
-- Live-schema findings this fixes (probed 2026-09-18 via PostgREST):
--   * public.leads was missing 24 columns (classification, property_address,
--     mailing_address, email, lead_source, motivation_score, last_contacted_at,
--     next_follow_up_at, tag, notes_summary, updated_at, campaign_id, city, state,
--     zip, stage, lead_score, priority, is_dnc, dnc_reason, last_replied_at, ...)
--     -> "Could not find the 'classification' column of 'leads' in the schema cache"
--   * public.profiles, campaigns, messages, notes, followups, import_logs did not exist
--   * public.sms_settings / sms_queue existed but lacked user_id, auto_send_enabled,
--     send_window_*, timezone, lead_id, scheduled_for, ...
--   * public.foreclosure_leads lacked owner_name, name, email, property_address,
--     city, state, zip, campaign_name, campaign_type, created_at
--
-- NOTE: this database is shared with the ForeclosureScraper project. Existing
-- scraper columns/tables are left untouched.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers (session-local, vanish at end of the session)
-- ---------------------------------------------------------------------------
create or replace function pg_temp.ensure_policy(
  tbl text, pol text, cmd text, using_expr text, check_expr text
) returns void language plpgsql as $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = tbl and policyname = pol
  ) then
    return;
  end if;
  execute format(
    'create policy %I on public.%I for %s %s %s',
    pol, tbl, cmd,
    case when using_expr is not null then 'using (' || using_expr || ')' else '' end,
    case when check_expr is not null then 'with check (' || check_expr || ')' else '' end
  );
end $$;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- New tables (only created when missing)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  campaign_type text,
  template_variant text,
  first_sms_template text,
  followup_1_template text,
  followup_2_template text,
  followup_3_template text,
  status text default 'active',
  total_leads integer default 0,
  messaged_count integer default 0,
  replied_count integer default 0,
  hot_count integer default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- public.leads — add every column the app reads or writes
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists property_address text not null default '',
  add column if not exists mailing_address text,
  add column if not exists email text,
  add column if not exists lead_source text,
  add column if not exists status text not null default 'New',
  add column if not exists classification text not null default 'UNKNOWN',
  add column if not exists motivation_score integer not null default 25,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists tag text,
  add column if not exists notes_summary text,
  add column if not exists campaign_id uuid references public.campaigns(id),
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists stage text,
  add column if not exists lead_score integer,
  add column if not exists priority text,
  add column if not exists is_dnc boolean not null default false,
  add column if not exists dnc_reason text,
  add column if not exists last_replied_at timestamptz,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_classification_check') then
    alter table public.leads
      add constraint leads_classification_check
      check (classification in ('HOT', 'WARM', 'COLD', 'DEAD', 'OPT_OUT', 'UNKNOWN'));
  end if;
end $$;

-- upload-csv upserts with onConflict "user_id,phone", which needs a unique index on
-- exactly those columns. Skipped (with a NOTICE) if existing rows already collide.
do $$
begin
  begin
    create unique index if not exists leads_user_phone_key on public.leads (user_id, phone);
  exception when unique_violation then
    raise notice 'leads_user_phone_key NOT created: duplicate (user_id, phone) rows exist. Dedupe them and re-run.';
  end;
end $$;

create index if not exists leads_user_status_idx on public.leads (user_id, status);
create index if not exists leads_user_stage_idx on public.leads (user_id, stage);
create index if not exists leads_user_dnc_idx on public.leads (user_id, is_dnc);
create index if not exists leads_next_follow_up_idx on public.leads (user_id, next_follow_up_at);
create index if not exists leads_campaign_id on public.leads (campaign_id);

-- Older installs (supabase/schema.sql) declared leads.phone_normalized NOT NULL, but the
-- app never sends it. If the column exists, have the database fill it from phone.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'phone_normalized'
  ) then
    create or replace function public.leads_fill_phone_normalized()
    returns trigger language plpgsql as $f$
    begin
      if new.phone_normalized is null or new.phone_normalized = '' then
        new.phone_normalized := new.phone;
      end if;
      return new;
    end;
    $f$;

    drop trigger if exists leads_fill_phone_normalized on public.leads;
    create trigger leads_fill_phone_normalized
      before insert or update of phone on public.leads
      for each row execute procedure public.leads_fill_phone_normalized();
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'leads_set_updated_at' and tgrelid = 'public.leads'::regclass) then
    create trigger leads_set_updated_at
      before update on public.leads
      for each row execute procedure public.handle_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- messages / notes / followups / import_logs
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  to_number text not null,
  phone text,
  status text,
  classification text,
  telnyx_message_id text unique,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists messages_lead_created_idx on public.messages (lead_id, created_at desc);
create index if not exists messages_user_created_idx on public.messages (user_id, created_at desc);
create index if not exists messages_lead_direction_created_idx on public.messages (lead_id, direction, created_at desc);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists notes_lead_created_idx on public.notes (lead_id, created_at desc);

create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  due_date date not null,
  note text,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists followups_due_idx on public.followups (user_id, due_date, completed_at);

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

create index if not exists import_logs_user_created_idx on public.import_logs (user_id, created_at desc);
create index if not exists campaigns_user_created_idx on public.campaigns (user_id, created_at desc);

-- If messages pre-existed without the newer columns, add them.
alter table public.messages
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists phone text,
  add column if not exists classification text,
  add column if not exists status text;

-- ---------------------------------------------------------------------------
-- sms_settings / sms_queue — tables exist live but with an older shape
-- ---------------------------------------------------------------------------
alter table public.sms_settings
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists auto_send_enabled boolean not null default false,
  add column if not exists send_window_start time not null default '09:00:00',
  add column if not exists send_window_end time not null default '20:00:00',
  add column if not exists timezone text not null default 'America/Chicago',
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

-- /api/settings/sms upserts with onConflict "user_id"
do $$
begin
  begin
    create unique index if not exists sms_settings_user_id_key on public.sms_settings (user_id);
  exception when unique_violation then
    raise notice 'sms_settings_user_id_key NOT created: duplicate user_id rows exist.';
  end;
end $$;

alter table public.sms_queue
  add column if not exists lead_id uuid references public.leads(id) on delete cascade,
  add column if not exists message text,
  add column if not exists status text not null default 'queued',
  add column if not exists scheduled_for timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

create index if not exists sms_queue_status_scheduled_idx on public.sms_queue (status, scheduled_for);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'sms_settings_set_updated_at' and tgrelid = 'public.sms_settings'::regclass) then
    create trigger sms_settings_set_updated_at
      before update on public.sms_settings
      for each row execute procedure public.handle_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- foreclosure_leads — the scraper's table; only add the CRM-facing columns
-- ---------------------------------------------------------------------------
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
  add column if not exists created_at timestamptz default timezone('utc', now()),
  add column if not exists updated_at timestamptz default timezone('utc', now());

-- ---------------------------------------------------------------------------
-- Row level security — every table the app scopes by user_id
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.campaigns enable row level security;
alter table public.messages enable row level security;
alter table public.notes enable row level security;
alter table public.followups enable row level security;
alter table public.import_logs enable row level security;
alter table public.sms_settings enable row level security;
alter table public.sms_queue enable row level security;

select pg_temp.ensure_policy('profiles', 'Users can view own profile', 'select', 'auth.uid() = id', null);
select pg_temp.ensure_policy('profiles', 'Users can update own profile', 'update', 'auth.uid() = id', null);

select pg_temp.ensure_policy('leads', 'Users can view own leads', 'select', 'auth.uid() = user_id', null);
select pg_temp.ensure_policy('leads', 'Users can insert own leads', 'insert', null, 'auth.uid() = user_id');
select pg_temp.ensure_policy('leads', 'Users can update own leads', 'update', 'auth.uid() = user_id', null);
select pg_temp.ensure_policy('leads', 'Users can delete own leads', 'delete', 'auth.uid() = user_id', null);

select pg_temp.ensure_policy('campaigns', 'Users can view own campaigns', 'select', 'auth.uid() = user_id', null);
select pg_temp.ensure_policy('campaigns', 'Users can insert own campaigns', 'insert', null, 'auth.uid() = user_id');
select pg_temp.ensure_policy('campaigns', 'Users can update own campaigns', 'update', 'auth.uid() = user_id', null);
select pg_temp.ensure_policy('campaigns', 'Users can delete own campaigns', 'delete', 'auth.uid() = user_id', null);

select pg_temp.ensure_policy('messages', 'Users can view own messages', 'select', 'auth.uid() = user_id', null);
select pg_temp.ensure_policy('messages', 'Users can insert own messages', 'insert', null, 'auth.uid() = user_id');
select pg_temp.ensure_policy('messages', 'Users can update own messages', 'update', 'auth.uid() = user_id', null);

select pg_temp.ensure_policy('notes', 'Users can view own notes', 'select', 'auth.uid() = user_id', null);
select pg_temp.ensure_policy('notes', 'Users can insert own notes', 'insert', null, 'auth.uid() = user_id');
select pg_temp.ensure_policy('notes', 'Users can update own notes', 'update', 'auth.uid() = user_id', null);
select pg_temp.ensure_policy('notes', 'Users can delete own notes', 'delete', 'auth.uid() = user_id', null);

select pg_temp.ensure_policy('followups', 'Users can view own followups', 'select', 'auth.uid() = user_id', null);
select pg_temp.ensure_policy('followups', 'Users can insert own followups', 'insert', null, 'auth.uid() = user_id');
select pg_temp.ensure_policy('followups', 'Users can update own followups', 'update', 'auth.uid() = user_id', null);
select pg_temp.ensure_policy('followups', 'Users can delete own followups', 'delete', 'auth.uid() = user_id', null);

select pg_temp.ensure_policy('import_logs', 'Users can view own import logs', 'select', 'auth.uid() = user_id', null);
select pg_temp.ensure_policy('import_logs', 'Users can insert own import logs', 'insert', null, 'auth.uid() = user_id');
select pg_temp.ensure_policy('import_logs', 'Users can update own import logs', 'update', 'auth.uid() = user_id', null);

select pg_temp.ensure_policy('sms_settings', 'Users can view own sms settings', 'select', 'auth.uid() = user_id', null);
select pg_temp.ensure_policy('sms_settings', 'Users can insert own sms settings', 'insert', null, 'auth.uid() = user_id');
select pg_temp.ensure_policy('sms_settings', 'Users can update own sms settings', 'update', 'auth.uid() = user_id', null);

select pg_temp.ensure_policy(
  'sms_queue', 'Users can view own sms queue', 'select',
  'exists (select 1 from public.leads l where l.id = sms_queue.lead_id and l.user_id = auth.uid())', null);
select pg_temp.ensure_policy(
  'sms_queue', 'Users can insert own sms queue', 'insert', null,
  'exists (select 1 from public.leads l where l.id = sms_queue.lead_id and l.user_id = auth.uid())');
select pg_temp.ensure_policy(
  'sms_queue', 'Users can update own sms queue', 'update',
  'exists (select 1 from public.leads l where l.id = sms_queue.lead_id and l.user_id = auth.uid())', null);

-- NOTE: foreclosure_leads RLS is intentionally NOT changed — the scraper and the
-- /foreclosure page access it with their own keys/policies.

-- ---------------------------------------------------------------------------
-- Realtime — the inbox subscribes to postgres_changes on messages and leads
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leads'
    ) then
      alter publication supabase_realtime add table public.leads;
    end if;
  end if;
end $$;

-- Refresh PostgREST's schema cache so the new columns are visible immediately.
notify pgrst, 'reload schema';
