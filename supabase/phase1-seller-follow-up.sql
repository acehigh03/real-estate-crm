alter table public.leads
  add column if not exists classification text not null default 'UNKNOWN';

alter table public.leads
  add column if not exists motivation_score integer not null default 25;

alter table public.leads
  add column if not exists last_contacted_at timestamptz;

alter table public.leads
  add column if not exists next_follow_up_at timestamptz;

alter table public.leads
  drop constraint if exists leads_classification_check;

alter table public.leads
  add constraint leads_classification_check
  check (classification in ('HOT', 'WARM', 'COLD', 'DEAD', 'OPT_OUT', 'UNKNOWN'));

update public.leads
set classification = case
  when status = 'DNC' then 'OPT_OUT'
  when status = 'Dead' then 'DEAD'
  when status = 'Hot' then 'HOT'
  when status in ('Replied', 'Contacted') then 'WARM'
  else 'UNKNOWN'
end
where classification is null
   or classification not in ('HOT', 'WARM', 'COLD', 'DEAD', 'OPT_OUT', 'UNKNOWN');

update public.leads
set motivation_score = case classification
  when 'HOT' then 90
  when 'WARM' then 70
  when 'COLD' then 40
  when 'DEAD' then 5
  when 'OPT_OUT' then 0
  else 25
end;

update public.leads
set next_follow_up_at = coalesce(next_follow_up_at, follow_up_date::timestamptz)
where follow_up_date is not null;
