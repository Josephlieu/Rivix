-- RIVIX dev database: switch customer codes to CUS-0001, CUS-0002, ...
-- Old format was 3 letters of the company name + number (PAC-0001, SAY-0009).
-- New format doesn't depend on the name, so it never goes stale on a rename.
-- Run in Supabase Dashboard -> SQL Editor on the DEV project only.
-- Safe to run more than once.

-- 1. New codes are generated as CUS-0001, CUS-0002, ...
create or replace function public.generate_customer_code()
returns trigger as $$
begin
  if new.customer_code is null or new.customer_code = '' then
    new.customer_code := 'CUS-' || lpad(nextval('public.customer_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

-- 2. Renumber the existing (test) customers, oldest first, from CUS-0001.
--    Skip this block if you ever run this after real clients have been given
--    their codes -- codes should not change once shared.
with numbered as (
  select id, row_number() over (order by created_at, id) as n
  from public.customers
)
update public.customers c
set customer_code = 'CUS-' || lpad(numbered.n::text, 4, '0')
from numbered
where c.id = numbered.id;

-- 3. Continue the counter after the highest existing code
select setval(
  'public.customer_code_seq',
  greatest((select count(*) from public.customers), 1),
  (select count(*) from public.customers) > 0
);
