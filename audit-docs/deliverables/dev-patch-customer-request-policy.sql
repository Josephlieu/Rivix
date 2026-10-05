-- RIVIX dev database: PATCH — customers must not see requests that a rep made.
-- (The first version of the customer-request policy also exposed rep-made requests and their notes.)
-- Run once in Supabase SQL Editor on the DEV project. Safe to run twice.

drop policy if exists "customers can view own document requests" on public.document_requests;
create policy "customers can view own document requests"
  on public.document_requests for select
  using (
    requested_by = 'customer'
    and customer_id in (select id from public.customers where user_id = auth.uid())
  );
