-- Telnyx requires the consent checkbox to be optional when the phone field is required.
-- Keep the boolean NOT NULL so every submission explicitly records true or false, but
-- remove the original constraint that allowed only true.
alter table public.sms_opt_ins
  drop constraint if exists sms_opt_ins_consented_check;
