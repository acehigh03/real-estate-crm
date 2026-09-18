-- Text Drips: additive workflow, enrollment and execution-log schema.
-- Safe to apply alongside the existing CRM schema; nothing is dropped or renamed.

create table if not exists public.drip_workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  continue_after_reply boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.drip_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.drip_workflows(id) on delete cascade,
  step_number integer not null check (step_number > 0),
  delay_minutes integer not null default 0 check (delay_minutes >= 0 and delay_minutes <= 525600),
  message text not null check (char_length(trim(message)) between 1 and 1600),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workflow_id, step_number)
);

create table if not exists public.drip_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workflow_id uuid not null references public.drip_workflows(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  enrolled_at timestamptz not null default timezone('utc', now()),
  cancelled_at timestamptz,
  cancel_reason text,
  last_reply_at_enrollment timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workflow_id, lead_id)
);

create table if not exists public.drip_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null references public.drip_enrollments(id) on delete cascade,
  step_id uuid not null references public.drip_steps(id) on delete cascade,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'delivered', 'failed', 'skipped', 'cancelled')),
  rendered_message text,
  telnyx_message_id text,
  error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (enrollment_id, step_id)
);

create index if not exists drip_workflows_user_status_idx on public.drip_workflows(user_id, status);
create index if not exists drip_steps_workflow_order_idx on public.drip_steps(workflow_id, step_number);
create index if not exists drip_enrollments_user_status_idx on public.drip_enrollments(user_id, status);
create index if not exists drip_enrollments_lead_status_idx on public.drip_enrollments(lead_id, status);
create index if not exists drip_executions_due_idx on public.drip_executions(status, scheduled_for) where status = 'queued';

drop trigger if exists drip_workflows_updated_at on public.drip_workflows;
create trigger drip_workflows_updated_at before update on public.drip_workflows
  for each row execute procedure public.handle_updated_at();
drop trigger if exists drip_steps_updated_at on public.drip_steps;
create trigger drip_steps_updated_at before update on public.drip_steps
  for each row execute procedure public.handle_updated_at();
drop trigger if exists drip_enrollments_updated_at on public.drip_enrollments;
create trigger drip_enrollments_updated_at before update on public.drip_enrollments
  for each row execute procedure public.handle_updated_at();
drop trigger if exists drip_executions_updated_at on public.drip_executions;
create trigger drip_executions_updated_at before update on public.drip_executions
  for each row execute procedure public.handle_updated_at();

alter table public.drip_workflows enable row level security;
alter table public.drip_steps enable row level security;
alter table public.drip_enrollments enable row level security;
alter table public.drip_executions enable row level security;

create policy "Users manage own drip workflows" on public.drip_workflows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own drip steps" on public.drip_steps
  for all using (exists (select 1 from public.drip_workflows w where w.id = workflow_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.drip_workflows w where w.id = workflow_id and w.user_id = auth.uid()));
create policy "Users manage own drip enrollments" on public.drip_enrollments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own drip executions" on public.drip_executions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
