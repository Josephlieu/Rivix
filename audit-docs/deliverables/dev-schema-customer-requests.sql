-- RIVIX dev database: customers can ask their rep for a document
-- A customer request starts as 'pending_rep' (it goes to the customer's rep, NOT admin).
-- The rep then forwards it to admin ('open') or dismisses it. Run AFTER
-- dev-schema-notifications.sql. Safe to run twice.
-- Run in Supabase Dashboard -> SQL Editor on the DEV project only.

alter table public.document_requests
  add column if not exists requested_by text not null default 'rep';

alter table public.document_requests drop constraint if exists document_requests_requested_by_check;
alter table public.document_requests
  add constraint document_requests_requested_by_check check (requested_by in ('rep', 'customer'));

alter table public.document_requests drop constraint if exists document_requests_status_check;
alter table public.document_requests
  add constraint document_requests_status_check
  check (status in ('pending_rep', 'open', 'done', 'dismissed'));

-- A customer can read (only) their own requests, so the order page can show their status.
drop policy if exists "customers can view own document requests" on public.document_requests;
create policy "customers can view own document requests"
  on public.document_requests for select
  using (customer_id in (select id from public.customers where user_id = auth.uid()));
