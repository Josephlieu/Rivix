-- RIVIX dev database: sales reps + customer<->rep assignment
-- Run in Supabase Dashboard -> SQL Editor on the DEV project only.
-- Run AFTER dev-schema-customers-orders.sql.

create table if not exists public.reps (
  id uuid primary key default gen_random_uuid(),
  -- Empty for now. Filled in when reps get their own logins (next phase).
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  title text,
  email text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One rep per customer; a rep can have many customers.
-- If a rep row is ever removed, their customers just become unassigned.
alter table public.customers
  add column if not exists rep_id uuid references public.reps(id) on delete set null,
  add column if not exists contact_phone text;

alter table public.reps enable row level security;

-- A customer can read ONLY their own assigned rep (name/title/email/phone).
create policy "customers can view their assigned rep"
  on public.reps for select
  using (
    exists (
      select 1 from public.customers c
      where c.rep_id = reps.id and c.user_id = auth.uid()
    )
  );

-- No insert/update/delete for anon/authenticated. Admins manage reps
-- through server routes that check the admin role first.
