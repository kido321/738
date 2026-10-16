-- Party POS database schema
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- The app talks to the database only from the server with the secret key,
-- so Row Level Security is turned ON with no policies (blocks public access).

create extension if not exists pgcrypto;

-- STAFF: the people who can use the app (you + 3 others)
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,
  email text unique not null,
  name text not null,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- PRODUCTS / INVENTORY
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('bottle', 'drink', 'hookah', 'other')),
  price numeric(10,2) not null check (price >= 0),
  cost numeric(10,2) not null default 0 check (cost >= 0),
  stock integer not null default 0,
  low_stock_at integer not null default 3,
  track_stock boolean not null default true,
  active boolean not null default true,
  image_url text,
  created_at timestamptz not null default now()
);

-- SALES (one row per checkout)
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id),
  business_date date not null,
  payment_method text not null check (payment_method in ('cash', 'card', 'other')),
  subtotal numeric(10,2) not null,
  tip numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  note text,
  voided boolean not null default false,
  voided_by uuid references public.staff(id),
  voided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sales_business_date_idx on public.sales (business_date);
create index if not exists sales_staff_idx on public.sales (staff_id);

-- SALE ITEMS (what was in each sale, price saved at time of sale)
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  category text not null,
  unit_price numeric(10,2) not null,
  qty integer not null check (qty > 0),
  line_total numeric(10,2) not null
);
create index if not exists sale_items_sale_idx on public.sale_items (sale_id);

-- STOCK MOVEMENTS (history of every stock change)
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  staff_id uuid references public.staff(id),
  change integer not null,
  reason text not null check (reason in ('sale', 'restock', 'adjust', 'void')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on public.stock_movements (product_id);

-- DAY AUDITS (end of night cash count)
create table if not exists public.day_audits (
  business_date date primary key,
  closed_by uuid references public.staff(id),
  expected_cash numeric(10,2) not null default 0,
  counted_cash numeric(10,2) not null default 0,
  difference numeric(10,2) not null default 0,
  notes text,
  closed_at timestamptz not null default now()
);

alter table public.staff enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.day_audits enable row level security;

-- Void a sale and put the stock back.
create or replace function public.void_sale(p_sale_id uuid, p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
begin
  update public.sales
  set voided = true, voided_by = p_staff_id, voided_at = now()
  where id = p_sale_id and not voided;

  if not found then
    raise exception 'Sale not found or already voided';
  end if;

  for v_item in
    select si.product_id, si.qty, p.track_stock
    from public.sale_items si
    join public.products p on p.id = si.product_id
    where si.sale_id = p_sale_id
  loop
    if v_item.track_stock then
      update public.products set stock = stock + v_item.qty where id = v_item.product_id;
      insert into public.stock_movements (product_id, staff_id, change, reason, note)
      values (v_item.product_id, p_staff_id, v_item.qty, 'void', p_sale_id::text);
    end if;
  end loop;
end;
$$;

-- Restock (add to stock) or Count (set stock to what's on the shelf).
create or replace function public.change_stock(
  p_product_id uuid,
  p_staff_id uuid,
  p_mode text,      -- 'restock' or 'count'
  p_amount integer,
  p_note text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_change integer;
begin
  select stock into v_stock from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Item not found';
  end if;

  if p_mode = 'count' then
    v_change := p_amount - v_stock;
  else
    v_change := p_amount;
  end if;

  if v_change = 0 then
    return v_stock;
  end if;

  update public.products set stock = stock + v_change where id = p_product_id;
  insert into public.stock_movements (product_id, staff_id, change, reason, note)
  values (p_product_id, p_staff_id, v_change,
          case when p_mode = 'count' then 'adjust' else 'restock' end,
          nullif(p_note, ''));
  return v_stock + v_change;
end;
$$;

-- Only the server (secret key) may call these functions.
revoke execute on function public.change_stock(uuid, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.change_stock(uuid, uuid, text, integer, text) to service_role;
revoke execute on function public.void_sale(uuid, uuid) from public, anon, authenticated;
grant execute on function public.void_sale(uuid, uuid) to service_role;

-- Item photos (public bucket, uploads only happen from the server)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- ================= Tabs, custom prices, payments =================

-- ---------- Sales: open tabs ----------
alter table public.sales add column if not exists status text not null default 'paid';
alter table public.sales add column if not exists customer_name text;
alter table public.sales add column if not exists paid_at timestamptz;
alter table public.sales add column if not exists paid_by uuid references public.staff(id);
alter table public.sales add column if not exists paid_date date;
alter table public.sales alter column payment_method drop not null;

do $$ begin
  alter table public.sales add constraint sales_status_check check (status in ('paid', 'open'));
exception when duplicate_object then null; end $$;

-- Payment types: Cash, Cash App, Zelle, Other ('card' kept for old sales)
alter table public.sales drop constraint if exists sales_payment_method_check;
alter table public.sales add constraint sales_payment_method_check
  check (payment_method in ('cash', 'cashapp', 'zelle', 'card', 'other'));

-- Old sales were all paid on the spot
update public.sales
set paid_at = created_at, paid_by = staff_id, paid_date = business_date
where status = 'paid' and paid_date is null;

create index if not exists sales_status_idx on public.sales (status) where status = 'open';
create index if not exists sales_paid_date_idx on public.sales (paid_date);

-- ---------- Sale items: keep the menu price next to the price charged ----------
alter table public.sale_items add column if not exists list_price numeric(10,2);
update public.sale_items set list_price = unit_price where list_price is null;

-- When each item was added (tabs can grow during the night)
alter table public.sale_items add column if not exists created_at timestamptz;
update public.sale_items si set created_at = s.created_at
from public.sales s where s.id = si.sale_id and si.created_at is null;
alter table public.sale_items alter column created_at set default now();

-- ---------- Functions ----------
drop function if exists public.create_sale(uuid, date, text, numeric, text, jsonb);

-- Adds items to a sale. Price can be custom per line.
-- Used by create_sale and add_to_tab.
create or replace function public.add_sale_items(p_sale_id uuid, p_staff_id uuid, p_items jsonb)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_price numeric(10,2);
  v_added numeric(10,2) := 0;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Bad quantity';
    end if;

    select * into v_product from public.products
    where id = (v_item->>'product_id')::uuid and active
    for update;
    if not found then
      raise exception 'Item not found or turned off';
    end if;

    v_price := coalesce((v_item->>'price')::numeric, v_product.price);
    if v_price < 0 then
      raise exception 'Price can''t be below 0';
    end if;

    insert into public.sale_items (sale_id, product_id, name, category, unit_price, list_price, qty, line_total)
    values (p_sale_id, v_product.id, v_product.name, v_product.category, v_price, v_product.price, v_qty, v_price * v_qty);

    v_added := v_added + v_price * v_qty;

    if v_product.track_stock then
      update public.products set stock = stock - v_qty where id = v_product.id;
      insert into public.stock_movements (product_id, staff_id, change, reason, note)
      values (v_product.id, p_staff_id, -v_qty, 'sale', p_sale_id::text);
    end if;
  end loop;

  return v_added;
end;
$$;

-- New sale. p_status = 'paid' (pay now) or 'open' (tab, pay later).
create or replace function public.create_sale(
  p_staff_id uuid,
  p_business_date date,
  p_status text,
  p_payment_method text,
  p_tip numeric,
  p_customer_name text,
  p_note text,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_subtotal numeric(10,2);
  v_paid boolean := p_status = 'paid';
begin
  if p_status not in ('paid', 'open') then
    raise exception 'Bad status';
  end if;
  if v_paid and p_payment_method is null then
    raise exception 'Pick a payment method';
  end if;
  if not v_paid and coalesce(trim(p_customer_name), '') = '' then
    raise exception 'Add a name for the tab';
  end if;

  insert into public.sales (staff_id, business_date, status, payment_method, subtotal, tip, total,
                            customer_name, note, paid_at, paid_by, paid_date)
  values (p_staff_id, p_business_date, p_status,
          case when v_paid then p_payment_method end,
          0, case when v_paid then coalesce(p_tip, 0) else 0 end, 0,
          nullif(trim(p_customer_name), ''), nullif(p_note, ''),
          case when v_paid then now() end,
          case when v_paid then p_staff_id end,
          case when v_paid then p_business_date end)
  returning id into v_sale_id;

  v_subtotal := public.add_sale_items(v_sale_id, p_staff_id, p_items);

  update public.sales
  set subtotal = v_subtotal, total = v_subtotal + tip
  where id = v_sale_id;

  return v_sale_id;
end;
$$;

-- Add more items to an open tab.
create or replace function public.add_to_tab(p_sale_id uuid, p_staff_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added numeric(10,2);
begin
  perform 1 from public.sales
  where id = p_sale_id and status = 'open' and not voided
  for update;
  if not found then
    raise exception 'That tab is closed or was voided';
  end if;

  v_added := public.add_sale_items(p_sale_id, p_staff_id, p_items);

  update public.sales
  set subtotal = subtotal + v_added, total = total + v_added
  where id = p_sale_id;
end;
$$;

-- Collect payment on an open tab.
create or replace function public.pay_tab(
  p_sale_id uuid,
  p_staff_id uuid,
  p_payment_method text,
  p_tip numeric,
  p_paid_date date
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_payment_method not in ('cash', 'cashapp', 'zelle', 'other') then
    raise exception 'Pick a payment method';
  end if;

  update public.sales
  set status = 'paid',
      payment_method = p_payment_method,
      tip = coalesce(p_tip, 0),
      total = subtotal + coalesce(p_tip, 0),
      paid_at = now(),
      paid_by = p_staff_id,
      paid_date = p_paid_date
  where id = p_sale_id and status = 'open' and not voided;

  if not found then
    raise exception 'That tab is already paid or was voided';
  end if;
end;
$$;

-- Take one item line off an open tab (mistake). Stock goes back.
-- If nothing is left, the tab is voided.
create or replace function public.remove_tab_item(p_item_id uuid, p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.sale_items%rowtype;
  v_track boolean;
begin
  select si.* into v_item from public.sale_items si
  join public.sales s on s.id = si.sale_id
  where si.id = p_item_id and s.status = 'open' and not s.voided
  for update of si;
  if not found then
    raise exception 'That item is not on an open tab';
  end if;

  delete from public.sale_items where id = p_item_id;

  select track_stock into v_track from public.products where id = v_item.product_id;
  if coalesce(v_track, false) then
    update public.products set stock = stock + v_item.qty where id = v_item.product_id;
    insert into public.stock_movements (product_id, staff_id, change, reason, note)
    values (v_item.product_id, p_staff_id, v_item.qty, 'void', v_item.sale_id::text);
  end if;

  update public.sales
  set subtotal = subtotal - v_item.line_total, total = total - v_item.line_total
  where id = v_item.sale_id;

  if not exists (select 1 from public.sale_items where sale_id = v_item.sale_id) then
    update public.sales set voided = true, voided_by = p_staff_id, voided_at = now()
    where id = v_item.sale_id;
  end if;
end;
$$;

revoke execute on function public.remove_tab_item(uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_tab_item(uuid, uuid) to service_role;
revoke execute on function public.add_sale_items(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.create_sale(uuid, date, text, text, numeric, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.add_to_tab(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.pay_tab(uuid, uuid, text, numeric, date) from public, anon, authenticated;
grant execute on function public.add_sale_items(uuid, uuid, jsonb) to service_role;
grant execute on function public.create_sale(uuid, date, text, text, numeric, text, text, jsonb) to service_role;
grant execute on function public.add_to_tab(uuid, uuid, jsonb) to service_role;
grant execute on function public.pay_tab(uuid, uuid, text, numeric, date) to service_role;
