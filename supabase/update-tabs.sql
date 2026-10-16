-- 738 Afties update: open tabs (pay later) + custom prices
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to run again.

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

-- Old sales were all paid on the spot
update public.sales
set paid_at = created_at, paid_by = staff_id, paid_date = business_date
where status = 'paid' and paid_date is null;

create index if not exists sales_status_idx on public.sales (status) where status = 'open';
create index if not exists sales_paid_date_idx on public.sales (paid_date);

-- ---------- Sale items: keep the menu price next to the price charged ----------
alter table public.sale_items add column if not exists list_price numeric(10,2);
update public.sale_items set list_price = unit_price where list_price is null;

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
  if p_payment_method not in ('cash', 'card', 'other') then
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

revoke execute on function public.add_sale_items(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.create_sale(uuid, date, text, text, numeric, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.add_to_tab(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.pay_tab(uuid, uuid, text, numeric, date) from public, anon, authenticated;
grant execute on function public.add_sale_items(uuid, uuid, jsonb) to service_role;
grant execute on function public.create_sale(uuid, date, text, text, numeric, text, text, jsonb) to service_role;
grant execute on function public.add_to_tab(uuid, uuid, jsonb) to service_role;
grant execute on function public.pay_tab(uuid, uuid, text, numeric, date) to service_role;
