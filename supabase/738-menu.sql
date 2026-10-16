-- 738 Afties menu
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to run again: it skips items that already exist.
-- Prices can be changed any time in the app: Inventory -> Edit.

-- 1) Turn on item photos (needed for the new photo feature)
alter table public.products add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- 2) Hide the old sample items if they were added (they stay in past sales)
update public.products set active = false
where name in ('Hennessy VS', 'Grey Goose', 'Moet Champagne', 'Beer', 'Mixed Drink',
               'Shot', 'Red Bull', 'Water', 'Hookah Refill', 'Table Fee')
  and not exists (select 1 from public.sale_items si where si.product_id = products.id);

-- If the sample 1942 is there, put it at the bottle price too
update public.products set price = 350
where name = 'Don Julio 1942' and price = 450 and active;

-- 3) Add the menu
insert into public.products (name, category, price, cost, stock, low_stock_at, track_stock)
select v.name, v.category, v.price, 0, 0, v.low_at, v.track
from (values
  ('Don Julio Reposado',  'bottle', 350, 2, true),
  ('Don Julio Blanco',    'bottle', 350, 2, true),
  ('Don Julio 1942',      'bottle', 350, 2, true),
  ('Clase Azul Reposado', 'bottle', 350, 2, true),
  ('Hennessy',            'bottle', 350, 2, true),
  ('Gold Label Champagne','bottle', 350, 2, true),
  ('Tito''s Vodka',       'bottle', 350, 2, true),
  ('Gin',                 'bottle', 350, 2, true),
  ('Hookah',              'hookah',  50, 0, false)
) as v(name, category, price, low_at, track)
where not exists (
  select 1 from public.products p where lower(p.name) = lower(v.name) and p.active
);

-- Check what's on the menu now
select name, category, price, stock, track_stock
from public.products
where active
order by category, name;
