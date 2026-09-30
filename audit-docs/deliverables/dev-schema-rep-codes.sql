-- RIVIX dev database: unique code for every sales rep (e.g. REP-0001)
-- Customers already get one (customers.customer_code, unique). This gives reps
-- the same. Run in Supabase Dashboard -> SQL Editor on the DEV project only.
-- Safe to run more than once.

create sequence if not exists public.rep_code_seq;

alter table public.reps add column if not exists rep_code text;

create or replace function public.generate_rep_code()
returns trigger as $$
begin
  if new.rep_code is null or new.rep_code = '' then
    new.rep_code := 'REP-' || lpad(nextval('public.rep_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_rep_code on public.reps;
create trigger set_rep_code
  before insert on public.reps
  for each row execute function public.generate_rep_code();

-- Give existing reps a code, oldest first
update public.reps r
set rep_code = 'REP-' || lpad(nextval('public.rep_code_seq')::text, 4, '0')
from (select id from public.reps where rep_code is null or rep_code = '' order by created_at) o
where r.id = o.id;

create unique index if not exists reps_rep_code_key on public.reps (rep_code);
