-- RIVIX dev database: the real order flow
--   customer talks to rep -> REP creates the order -> ADMIN runs it
--   (stages, tracking, notes) -> customer + rep follow progress read-only.
-- Run in Supabase Dashboard -> SQL Editor on the DEV project only.
-- Run AFTER dev-schema-customers-orders.sql and dev-schema-reps.sql.
-- Safe to run more than once.

-- ---------------------------------------------------------------- orders ---
-- Existing columns stay as they are (batch_number is the order's public number).
alter table public.orders
  add column if not exists rep_id uuid references public.reps(id) on delete set null,  -- rep who created it
  add column if not exists delivery_location text,
  add column if not exists po_number text,
  add column if not exists pricing text,            -- reference only; real invoice/PO come from QuickBooks
  add column if not exists special_requirements text,
  add column if not exists carrier text,
  add column if not exists tracking_number text;

-- New orders start as "Order Received" (was "In Production").
alter table public.orders alter column status set default 'Order Received';

-- The only stages an order can be in. Matches RIVIX's real process.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in (
    'Order Received',
    'Sampling & Approval',
    'In Production',
    'QC & Packaging',
    'Shipped',
    'Delivered',
    'Cancelled'
  ));

-- ------------------------------------------------------ automatic order number
-- Reps never type an order number: it's ORD-0001, ORD-0002, ... when left empty.
-- Existing orders (e.g. RVX-2026-9421) keep their numbers.
create sequence if not exists public.order_code_seq;

create or replace function public.generate_order_code()
returns trigger as $$
begin
  if new.batch_number is null or new.batch_number = '' then
    new.batch_number := 'ORD-' || lpad(nextval('public.order_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_order_code on public.orders;
create trigger set_order_code
  before insert on public.orders
  for each row execute function public.generate_order_code();

-- ----------------------------------------------------------- order_items ---
-- One row per product on an order (an order can have several).
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  sizing text,      -- e.g. "S x10, M x20, L x20"
  branding text,    -- e.g. "Logo on back, 30cm, white on navy"
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

alter table public.order_items enable row level security;

drop policy if exists "customers can view own order items" on public.order_items;
create policy "customers can view own order items"
  on public.order_items for select
  using (
    order_id in (
      select o.id from public.orders o
      join public.customers c on c.id = o.customer_id
      where c.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------- order_events ---
-- The order's timeline: every stage change, plus notes.
-- customer_visible = false makes a note internal (admin only).
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text,                                   -- set when the event is a stage change
  note text,
  customer_visible boolean not null default true,
  created_by text,                               -- who did it (email), for the record
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_id_idx on public.order_events (order_id, created_at);

alter table public.order_events enable row level security;

drop policy if exists "customers can view own visible order events" on public.order_events;
create policy "customers can view own visible order events"
  on public.order_events for select
  using (
    customer_visible
    and order_id in (
      select o.id from public.orders o
      join public.customers c on c.id = o.customer_id
      where c.user_id = auth.uid()
    )
  );

-- Every stage change is recorded automatically, so the timeline can't be skipped.
create or replace function public.log_order_status()
returns trigger as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_events (order_id, status, customer_visible)
    values (new.id, new.status, true);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists log_order_status on public.orders;
create trigger log_order_status
  after insert or update of status on public.orders
  for each row execute function public.log_order_status();

-- Give orders that already exist a starting point on their timeline
insert into public.order_events (order_id, status, customer_visible, created_at)
select o.id, o.status, true, o.created_at
from public.orders o
where not exists (select 1 from public.order_events e where e.order_id = o.id);

-- No insert/update/delete policies on any of these for anon/authenticated:
-- customers only read. Reps create orders and admin changes stages through
-- server routes that check the role first (service role), never from the browser.
