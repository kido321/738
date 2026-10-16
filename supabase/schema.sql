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

-- Create a sale in one step: saves the sale, its items, and lowers stock.
-- Prices come from the products table, not from the phone.
create or replace function public.create_sale(
  p_staff_id uuid,
  p_business_date date,
  p_payment_method text,
  p_tip numeric,
  p_note text,
  p_items jsonb  -- [{ "product_id": "...", "qty": 2 }, ...]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_subtotal numeric(10,2) := 0;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  insert into public.sales (staff_id, business_date, payment_method, subtotal, tip, total, note)
  values (p_staff_id, p_business_date, p_payment_method, 0, coalesce(p_tip, 0), 0, nullif(p_note, ''))
  returning id into v_sale_id;

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

    insert into public.sale_items (sale_id, product_id, name, category, unit_price, qty, line_total)
    values (v_sale_id, v_product.id, v_product.name, v_product.category, v_product.price, v_qty, v_product.price * v_qty);

    v_subtotal := v_subtotal + v_product.price * v_qty;

    if v_product.track_stock then
      update public.products set stock = stock - v_qty where id = v_product.id;
      insert into public.stock_movements (product_id, staff_id, change, reason, note)
      values (v_product.id, p_staff_id, -v_qty, 'sale', v_sale_id::text);
    end if;
  end loop;

  update public.sales
  set subtotal = v_subtotal, total = v_subtotal + coalesce(p_tip, 0)
  where id = v_sale_id;

  return v_sale_id;
end;
$$;

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
revoke execute on function public.create_sale(uuid, date, text, numeric, text, jsonb) from public, anon, authenticated;
revoke execute on function public.void_sale(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_sale(uuid, date, text, numeric, text, jsonb) to service_role;
grant execute on function public.void_sale(uuid, uuid) to service_role;

-- Item photos (public bucket, uploads only happen from the server)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
