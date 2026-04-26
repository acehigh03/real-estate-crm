create extension if not exists "pgcrypto";

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  property_address text not null,
  mailing_address text,
  phone text not null,
  phone_normalized text not null,
  email text,
  lead_source text,
  status text not null default 'New' check (status in ('New', 'Contacted', 'Replied', 'Hot', 'Dead', 'DNC')),
  classification text not null default 'UNKNOWN' check (classification in ('HOT', 'WARM', 'COLD', 'DEAD', 'OPT_OUT', 'UNKNOWN')),
  motivation_score integer not null default 25 check (motivation_score >= 0 and motivation_score <= 100),
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  tag text,
  notes_summary text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists leads_user_phone_unique
  on public.leads (user_id, phone_normalized);

create index if not exists leads_user_status_idx
  on public.leads (user_id, status);

create index if not exists leads_next_follow_up_idx
  on public.leads (user_id, next_follow_up_at);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  to_number text not null,
  status text,
  telnyx_message_id text unique,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists messages_lead_created_idx
  on public.messages (lead_id, created_at desc);

create index if not exists messages_telnyx_id_idx
  on public.messages (telnyx_message_id);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists notes_lead_created_idx
  on public.notes (lead_id, created_at desc);

create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  due_date date not null,
  note text,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists followups_due_idx
  on public.followups (user_id, due_date, completed_at);

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute procedure public.handle_updated_at();

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.messages enable row level security;
alter table public.notes enable row level security;
alter table public.followups enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can view own leads"
  on public.leads for select
  using (auth.uid() = user_id);

create policy "Users can insert own leads"
  on public.leads for insert
  with check (auth.uid() = user_id);

create policy "Users can update own leads"
  on public.leads for update
  using (auth.uid() = user_id);

create policy "Users can delete own leads"
  on public.leads for delete
  using (auth.uid() = user_id);

create policy "Users can view own messages"
  on public.messages for select
  using (auth.uid() = user_id);

create policy "Users can insert own messages"
  on public.messages for insert
  with check (auth.uid() = user_id);

create policy "Users can update own messages"
  on public.messages for update
  using (auth.uid() = user_id);

create policy "Users can view own notes"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "Users can insert own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notes"
  on public.notes for update
  using (auth.uid() = user_id);

create policy "Users can delete own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

create policy "Users can view own followups"
  on public.followups for select
  using (auth.uid() = user_id);

create policy "Users can insert own followups"
  on public.followups for insert
  with check (auth.uid() = user_id);

create policy "Users can update own followups"
  on public.followups for update
  using (auth.uid() = user_id);

create policy "Users can delete own followups"
  on public.followups for delete
  using (auth.uid() = user_id);
