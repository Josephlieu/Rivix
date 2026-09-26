-- RIVIX dev database: real per-customer product specs
-- Run this in Supabase Dashboard -> SQL Editor, on the DEV project only
-- (ddpgrgfayfmpsjndvgvz) -- never on production.
--
-- Replaces the generic, same-for-every-customer catalog page with real,
-- admin-managed technical files scoped to a specific customer (decided
-- 2026-09-25 — see audit-docs/07-client-requirements.md §5).

create table if not exists public.product_specs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_name text not null,
  safety_standard text,
  fabric text,
  description text,
  file_url text,
  file_label text,
  created_at timestamptz not null default now()
);

alter table public.product_specs enable row level security;

-- A customer can only ever see their own product specs
create policy "customers can view own product specs"
  on public.product_specs for select
  using (
    customer_id in (
      select id from public.customers where user_id = auth.uid()
    )
  );

-- No insert/update/delete policy for anon/authenticated — these are
-- admin-managed only (per the 2026-09-25 decision: customers view, they
-- never create or edit their own specs). Writes happen server-side via the
-- service role key until real Admin tooling exists to manage this.

-- Storage bucket for the actual technical files (drawings/PDFs) admin
-- uploads per customer. Private by default — access is only ever through
-- a signed URL generated server-side, never a public bucket URL.
insert into storage.buckets (id, name, public)
values ('product-specs', 'product-specs', false)
on conflict (id) do nothing;

-- No storage.objects policies for anon/authenticated — same reasoning as
-- above, admin/service-role only for now.
