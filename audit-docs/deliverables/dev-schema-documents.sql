-- RIVIX dev database: documents / certificates attached to an order
-- Admin uploads a real file for a customer's order; the customer (and their rep)
-- can see and download it. Files live in a PRIVATE storage bucket; downloads go
-- through short-lived signed links created by the server after an ownership check.
-- Run in Supabase Dashboard -> SQL Editor on the DEV project only. Safe to run twice.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  title text not null,
  doc_type text not null default 'Other',
  file_path text not null,          -- path inside the 'documents' bucket
  file_name text not null,          -- original file name
  file_size bigint,
  mime_type text,
  uploaded_by text,                 -- admin email, for the record
  created_at timestamptz not null default now()
);

create index if not exists documents_customer_idx on public.documents (customer_id, created_at desc);
create index if not exists documents_order_idx on public.documents (order_id);

alter table public.documents enable row level security;

-- A customer can only read their own documents. No insert/update/delete from the
-- browser at all: admin writes go through server routes that check the admin role.
drop policy if exists "customers can view own documents" on public.documents;
create policy "customers can view own documents"
  on public.documents for select
  using (
    customer_id in (select id from public.customers where user_id = auth.uid())
  );

-- Private bucket, 20 MB per file, only these file types.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 20971520,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies for anon/authenticated: nobody can read or write
-- files straight from the browser except through a signed link the server issues.
