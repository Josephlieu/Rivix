-- RIVIX dev database: structured sizes on order items (size grid)
-- Each item stores its sizes as data, e.g. [{"size":"M","qty":10},{"size":"L","qty":25}],
-- instead of only free text. The old `sizing` text column stays (a readable summary,
-- and what pre-existing orders use).
-- Run in Supabase Dashboard -> SQL Editor on the DEV project only. Safe to run twice.

alter table public.order_items
  add column if not exists size_breakdown jsonb;

alter table public.order_items drop constraint if exists order_items_size_breakdown_is_array;
alter table public.order_items
  add constraint order_items_size_breakdown_is_array
  check (size_breakdown is null or jsonb_typeof(size_breakdown) = 'array');
