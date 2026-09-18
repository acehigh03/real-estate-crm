-- Adds the two deal fields the dashboard needs. ADDITIVE ONLY, idempotent, safe to re-run.
--
--   deal_value  estimated deal value in dollars the investor enters on the lead page.
--               NULL means "not entered" (deliberately not 0, so unset can be told from $0).
--   deadline    tax-sale / auction / other hard deadline for the deal.
--
-- Powers the dashboard's "Estimated pipeline value" (sum of deal_value on active leads) and
-- "Deals at risk" (deadline within 30 days) cards.
--
-- Requires public.leads to exist (see 20260918120000_crm_schema_audit.sql).

alter table public.leads
  add column if not exists deal_value numeric(14, 2),
  add column if not exists deadline date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_deal_value_nonnegative') then
    alter table public.leads
      add constraint leads_deal_value_nonnegative
      check (deal_value is null or deal_value >= 0);
  end if;
end $$;

-- "Deals at risk" scans a user's upcoming deadlines.
create index if not exists leads_user_deadline_idx
  on public.leads (user_id, deadline)
  where deadline is not null;

notify pgrst, 'reload schema';
