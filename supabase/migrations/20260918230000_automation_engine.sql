-- Automation engine: auto-responders, reply classifications, automation history.
-- ADDITIVE ONLY and safe to re-run (policies are guarded, everything else is "if not exists").
--
-- Depends on:  20260918120000_crm_schema_audit.sql  (public.leads, handle_updated_at)
--              20260918210000_text_drips.sql        (public.drip_workflows, ...)
--
-- Differences from the original sketch, on purpose:
--   * reply_classifications and automation_history get a user_id column and row-level security.
--     Without it they would be readable/writable by anyone holding the public anon key.
--   * reply_classifications.message_id is unique, so a Telnyx webhook retry can never run the
--     same reply through the auto-responders twice (a double auto-reply would text a seller twice).
--   * (user_id, name) is unique on drip_workflows so seeding the starter workflows is idempotent.

create table if not exists public.auto_responders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  is_active boolean not null default true,
  trigger_type text not null check (trigger_type in ('keyword', 'any_reply', 'first_reply', 'sentiment')),
  trigger_value text,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null check (jsonb_typeof(actions) = 'array'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reply_classifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  message_id text,
  message_body text,
  sentiment text check (sentiment in ('interested', 'maybe', 'not_interested', 'stop', 'question')),
  source text,
  raw_response jsonb,
  classified_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.automation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  automation_type text,
  automation_name text,
  action_taken text,
  result text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists auto_responders_user_active_idx on public.auto_responders (user_id, is_active);
create index if not exists reply_classifications_lead_idx on public.reply_classifications (lead_id, classified_at desc);
create index if not exists reply_classifications_user_idx on public.reply_classifications (user_id, classified_at desc);
create index if not exists automation_history_lead_idx on public.automation_history (lead_id, created_at desc);
create index if not exists automation_history_user_idx on public.automation_history (user_id, created_at desc);

-- Webhook retries must not re-run automations for the same inbound message.
-- (Deliberately NOT a partial index: ON CONFLICT (message_id) can't target one. Postgres treats
-- NULLs as distinct in unique indexes, so rows without a message id are still allowed.)
create unique index if not exists reply_classifications_message_id_key
  on public.reply_classifications (message_id);

-- Idempotent starter-workflow seeding (one row per user per name).
create unique index if not exists drip_workflows_user_name_key on public.drip_workflows (user_id, name);

drop trigger if exists auto_responders_updated_at on public.auto_responders;
create trigger auto_responders_updated_at before update on public.auto_responders
  for each row execute procedure public.handle_updated_at();

alter table public.auto_responders enable row level security;
alter table public.reply_classifications enable row level security;
alter table public.automation_history enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'auto_responders' and policyname = 'Users own auto_responders') then
    create policy "Users own auto_responders" on public.auto_responders
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reply_classifications' and policyname = 'Users read own reply classifications') then
    create policy "Users read own reply classifications" on public.reply_classifications
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'automation_history' and policyname = 'Users read own automation history') then
    create policy "Users read own automation history" on public.automation_history
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- reply_classifications and automation_history are written only by the server (service role),
-- which bypasses row-level security, so users get read-only access.

notify pgrst, 'reload schema';
