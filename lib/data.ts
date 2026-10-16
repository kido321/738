import "server-only";
import { db } from "./supabase";
import { addDays, toNum } from "./format";
import type { DayAudit, Product, Sale, Staff, StockMovement } from "./types";

const SALE_SELECT =
  "id, staff_id, business_date, status, payment_method, customer_name, paid_at, paid_by, paid_date, subtotal, tip, total, note, voided, voided_by, voided_at, created_at, sale_items(product_id, name, category, unit_price, list_price, qty, line_total)";

// Turn "column does not exist" into a clear next step.
function fail(message: string): never {
  if (/does not exist|schema cache/i.test(message) && /status|customer_name|paid_|list_price/i.test(message)) {
    throw new Error("The database needs the tabs update. Run supabase/update-tabs.sql in the Supabase SQL Editor.");
  }
  throw new Error(message);
}

function cleanSale(s: Sale): Sale {
  return {
    ...s,
    subtotal: toNum(s.subtotal),
    tip: toNum(s.tip),
    total: toNum(s.total),
    sale_items: (s.sale_items ?? []).map((i) => ({
      ...i,
      unit_price: toNum(i.unit_price),
      list_price: i.list_price == null ? null : toNum(i.list_price),
      line_total: toNum(i.line_total),
    })),
  };
}

// Pulls every sale between two business dates (inclusive), 1000 rows at a time.
export async function getSales(
  start: string,
  end: string,
  opts: { includeVoided?: boolean; staffId?: string } = {}
): Promise<Sale[]> {
  const out: Sale[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    let q = db()
      .from("sales")
      .select(SALE_SELECT)
      .gte("business_date", start)
      .lte("business_date", end)
      .order("created_at", { ascending: false })
      .range(from, from + page - 1);
    if (!opts.includeVoided) q = q.eq("voided", false);
    if (opts.staffId) q = q.eq("staff_id", opts.staffId);
    const { data, error } = await q;
    if (error) fail(error.message);
    out.push(...((data ?? []) as unknown as Sale[]).map(cleanSale));
    if (!data || data.length < page) break;
  }
  return out;
}

// Every open tab (not paid yet), oldest first.
export async function getOpenTabs(): Promise<Sale[]> {
  const { data, error } = await db()
    .from("sales")
    .select(SALE_SELECT)
    .eq("status", "open")
    .eq("voided", false)
    .order("created_at", { ascending: true });
  if (error) fail(error.message);
  return ((data ?? []) as unknown as Sale[]).map(cleanSale);
}

export async function getOpenTabCount(): Promise<number> {
  const { count } = await db()
    .from("sales")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .eq("voided", false);
  return count ?? 0;
}

// Money actually collected on a business day (includes old tabs paid that day).
export async function getCollected(date: string): Promise<Sale[]> {
  const { data, error } = await db()
    .from("sales")
    .select(SALE_SELECT)
    .eq("status", "paid")
    .eq("voided", false)
    .eq("paid_date", date)
    .order("paid_at", { ascending: false });
  if (error) fail(error.message);
  return ((data ?? []) as unknown as Sale[]).map(cleanSale);
}

export function byMethod(sales: Sale[]) {
  const out = { cash: 0, card: 0, other: 0, tips: 0, count: sales.length, total: 0 };
  for (const s of sales) {
    if (s.payment_method === "cash") out.cash += s.total;
    else if (s.payment_method === "card") out.card += s.total;
    else out.other += s.total;
    out.tips += s.tip;
    out.total += s.total;
  }
  return {
    ...out,
    cash: toNum(out.cash),
    card: toNum(out.card),
    other: toNum(out.other),
    tips: toNum(out.tips),
    total: toNum(out.total),
  };
}

export async function getProducts(opts: { activeOnly?: boolean } = {}): Promise<Product[]> {
  let q = db().from("products").select("*").order("category").order("name");
  if (opts.activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Product[]).map((p) => ({
    ...p,
    price: toNum(p.price),
    cost: toNum(p.cost),
  }));
}

export async function getStaffList(): Promise<Staff[]> {
  const { data, error } = await db().from("staff").select("*").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as Staff[];
}

export async function getAudit(date: string): Promise<DayAudit | null> {
  const { data } = await db().from("day_audits").select("*").eq("business_date", date).maybeSingle();
  if (!data) return null;
  const a = data as DayAudit;
  return {
    ...a,
    expected_cash: toNum(a.expected_cash),
    counted_cash: toNum(a.counted_cash),
    difference: toNum(a.difference),
  };
}

export async function getRecentAudits(limit = 10): Promise<DayAudit[]> {
  const { data } = await db()
    .from("day_audits")
    .select("*")
    .order("business_date", { ascending: false })
    .limit(limit);
  return ((data ?? []) as DayAudit[]).map((a) => ({
    ...a,
    expected_cash: toNum(a.expected_cash),
    counted_cash: toNum(a.counted_cash),
    difference: toNum(a.difference),
  }));
}

export async function getMovements(limit = 30): Promise<StockMovement[]> {
  const { data } = await db()
    .from("stock_movements")
    .select("*")
    .neq("reason", "sale")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as StockMovement[];
}

// ---------- Summaries ----------

export type Summary = ReturnType<typeof summarize>;

export function summarize(sales: Sale[], products: Product[], staff: Staff[]) {
  const costById = new Map(products.map((p) => [p.id, p.cost]));
  const nameById = new Map(staff.map((s) => [s.id, s.name]));
  const live = sales.filter((s) => !s.voided);

  let revenue = 0;
  let subtotal = 0;
  let tips = 0;
  let cost = 0;
  let collected = 0;
  let unpaid = 0;
  let openCount = 0;
  let discounts = 0;
  type StaffRow = { id: string; name: string; count: number; total: number; paid: number; unpaid: number; tips: number };
  const byStaff = new Map<string, StaffRow>();
  const byPayment = new Map<string, { count: number; total: number }>();
  const byCategory = new Map<string, { qty: number; total: number }>();
  const byItem = new Map<string, { name: string; category: string; qty: number; total: number }>();
  const byDay = new Map<string, number>();

  for (const s of live) {
    const isOpen = s.status === "open";
    revenue += s.total;
    subtotal += s.subtotal;
    tips += s.tip;
    if (isOpen) {
      unpaid += s.total;
      openCount += 1;
    } else {
      collected += s.total;
    }

    const st = byStaff.get(s.staff_id) ?? {
      id: s.staff_id,
      name: nameById.get(s.staff_id) ?? "Unknown",
      count: 0,
      total: 0,
      paid: 0,
      unpaid: 0,
      tips: 0,
    };
    st.count += 1;
    st.total += s.total;
    st.tips += s.tip;
    if (isOpen) st.unpaid += s.total;
    else st.paid += s.total;
    byStaff.set(s.staff_id, st);

    if (!isOpen && s.payment_method) {
      const pm = byPayment.get(s.payment_method) ?? { count: 0, total: 0 };
      pm.count += 1;
      pm.total += s.total;
      byPayment.set(s.payment_method, pm);
    }

    byDay.set(s.business_date, (byDay.get(s.business_date) ?? 0) + s.total);

    for (const i of s.sale_items) {
      const c = byCategory.get(i.category) ?? { qty: 0, total: 0 };
      c.qty += i.qty;
      c.total += i.line_total;
      byCategory.set(i.category, c);

      const key = `${i.category}|${i.name}`;
      const it = byItem.get(key) ?? { name: i.name, category: i.category, qty: 0, total: 0 };
      it.qty += i.qty;
      it.total += i.line_total;
      byItem.set(key, it);

      if (i.list_price != null && i.list_price > i.unit_price) {
        discounts += (i.list_price - i.unit_price) * i.qty;
      }
      if (i.product_id) cost += (costById.get(i.product_id) ?? 0) * i.qty;
    }
  }

  return {
    count: live.length,
    voidedCount: sales.length - live.length,
    revenue: toNum(revenue),
    subtotal: toNum(subtotal),
    tips: toNum(tips),
    collected: toNum(collected),
    unpaid: toNum(unpaid),
    openCount,
    discounts: toNum(discounts),
    avg: live.length ? toNum(revenue / live.length) : 0,
    estProfit: toNum(subtotal - cost),
    byStaff: [...byStaff.values()].sort((a, b) => b.total - a.total),
    byPayment,
    byCategory,
    topItems: [...byItem.values()].sort((a, b) => b.total - a.total),
    byDay,
  };
}

export function dayRange(start: string, end: string) {
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}
