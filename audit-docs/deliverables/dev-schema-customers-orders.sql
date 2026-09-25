-- RIVIX dev database: real customer/order scoping
-- Run this in Supabase Dashboard -> SQL Editor, on the DEV project only
-- (ddpgrgfayfmpsjndvgvz) -- never on production.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  customer_code text not null unique,
  company_name text not null,
  contact_email text,
  created_at timestamptz not null default now()
);

-- Human-readable customer code, e.g. "PAC-0001" — generated from the first
-- 3 letters of the company name + a sequential number, so customers/admins
-- never have to deal with the raw uuid.
create sequence if not exists public.customer_code_seq;

create or replace function public.generate_customer_code()
returns trigger as $$
begin
  if new.customer_code is null or new.customer_code = '' then
    new.customer_code := upper(left(regexp_replace(new.company_name, '[^a-zA-Z]', '', 'g'), 3))
      || '-' || lpad(nextval('public.customer_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger set_customer_code
  before insert on public.customers
  for each row execute function public.generate_customer_code();

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  batch_number text not null unique,
  product_name text not null,
  quantity integer not null default 0,
  material text,
  origin text,
  order_date date,
  ship_date date,
  status text not null default 'In Production',
  certs_generated boolean not null default false,
  safety_standard text,
  inspector_name text,
  created_at timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.orders enable row level security;

-- A customer can only ever see their own row
create policy "customers can view own record"
  on public.customers for select
  using (auth.uid() = user_id);

-- A customer can only ever see orders tied to their own customer record
create policy "customers can view own orders"
  on public.orders for select
  using (
    customer_id in (
      select id from public.customers where user_id = auth.uid()
    )
  );

-- No insert/update/delete policies for the anon/authenticated role at all —
-- customers should never write to these tables directly. All writes happen
-- server-side (via the service role key, bypassing RLS) once Admin/Sales Rep
-- tooling exists.
