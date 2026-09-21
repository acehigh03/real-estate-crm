create table if not exists public.message_templates (
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_type text not null check (campaign_type in ('cash_offer', 'foreclosure_help', 'probate', 'tax_sale', 'custom')),
  body text not null check (char_length(body) between 1 and 1000),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, campaign_type)
);

alter table public.message_templates enable row level security;

drop policy if exists "Users manage own message templates" on public.message_templates;
create policy "Users manage own message templates" on public.message_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.messages add column if not exists from_number text;
create index if not exists messages_phone_from_created_idx on public.messages (phone, from_number, created_at desc);
