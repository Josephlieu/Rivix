-- RIVIX dev database: in-app notifications + rep "request a document" (ping admin)
-- Run in Supabase Dashboard -> SQL Editor on the DEV project only. Safe to run twice.

-- ---------------------------------------------------------- notifications ---
-- One row per person to notify (admins each get their own copy).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,               -- e.g. new_order, stage_changed, document_added, document_request, request_done
  title text not null,
  body text,
  link text,                        -- where clicking it goes, e.g. /admin/orders/<id>
  order_id uuid references public.orders(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_user_id, created_at desc);

alter table public.notifications enable row level security;

-- You can read only your own notifications. Nobody writes from the browser:
-- they are created, and marked read, by server routes.
drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications"
  on public.notifications for select
  using (recipient_user_id = auth.uid());

-- ------------------------------------------------------ document_requests ---
-- A rep asks admin for a document on an order.
create table if not exists public.document_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  rep_id uuid references public.reps(id) on delete set null,
  doc_type text not null default 'Other',
  note text,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  done_at timestamptz,
  done_by text
);

create index if not exists document_requests_order_idx on public.document_requests (order_id, status);

alter table public.document_requests enable row level security;
-- No policies for anon/authenticated: reps and admin use server routes only.
