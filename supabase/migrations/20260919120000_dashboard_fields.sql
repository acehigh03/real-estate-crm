-- Seller Command Center: read state for conversations, and a persisted order for pipeline cards.
-- ADDITIVE ONLY and safe to re-run. Nothing is dropped.
--
-- Already present from earlier migrations, so NOT re-added here:
--   leads.deal_value (numeric), leads.next_follow_up_at (timestamptz), leads.last_contacted_at (timestamptz)
--
-- Depends on: 20260918120000_crm_schema_audit.sql (public.leads, public.messages)

-- A conversation is "unread" when its newest message is inbound and read_at is null.
alter table public.messages add column if not exists read_at timestamptz;

-- Existing history counts as read, except each lead's newest message when it is an inbound reply
-- (those are the conversations the seller is still waiting on, so they stay unread).
update public.messages m
set read_at = m.created_at
where m.read_at is null
  and not (
    m.direction = 'inbound'
    and m.created_at = (select max(x.created_at) from public.messages x where x.lead_id = m.lead_id)
  );

create index if not exists messages_user_unread_idx
  on public.messages (user_id, created_at desc)
  where direction = 'inbound' and read_at is null;

-- Manual card order inside a pipeline column (drag to reorder). Lower sorts first; null sorts last.
alter table public.leads add column if not exists pipeline_position integer;

notify pgrst, 'reload schema';
