create table if not exists public.sms_opt_ins (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  phone_normalized text not null,
  property_address text,
  consented boolean not null check (consented = true),
  consent_text text not null,
  consent_version text not null,
  source_url text not null,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists sms_opt_ins_phone_created_idx
  on public.sms_opt_ins (phone_normalized, created_at desc);

alter table public.sms_opt_ins enable row level security;

-- No public policies: submissions are written only by the server-side API with
-- the service role. This prevents anonymous visitors from reading consent logs.

notify pgrst, 'reload schema';
