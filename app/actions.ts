"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { businessDate, isDateString, toNum } from "@/lib/format";
import { CATEGORIES, PAYMENT_METHODS } from "@/lib/config";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function refresh() {
  revalidatePath("/", "layout");
}

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function num(form: FormData, key: string, fallback = 0) {
  const v = Number(text(form, key));
  return Number.isFinite(v) ? v : fallback;
}

// ---------- Sales ----------

type CartItem = { product_id: string; qty: number; price?: number | null };

// Clean up the cart from the phone. A price is only sent when it was changed.
function cleanItems(items: CartItem[] | undefined) {
  return (items ?? [])
    .filter((i) => i.product_id && Number.isInteger(i.qty) && i.qty > 0 && i.qty < 1000)
    .map((i) => {
      const price = i.price == null ? null : toNum(i.price);
      return price == null || !Number.isFinite(price)
        ? { product_id: i.product_id, qty: i.qty }
        : { product_id: i.product_id, qty: i.qty, price: Math.max(0, Math.min(price, 100000)) };
    });
}

function dbError(message: string) {
  if (
    /payment_method_check/i.test(message) ||
    (/create_sale|add_to_tab|pay_tab|status|customer_name|list_price/i.test(message) &&
      /function|column|does not exist|schema cache/i.test(message))
  ) {
    return "The database needs an update. Run supabase/update.sql in the Supabase SQL Editor.";
  }
  return message;
}

export async function createSale(input: {
  items: CartItem[];
  mode: "paid" | "open";
  payment_method?: string | null;
  customer_name?: string;
  note?: string;
}): Promise<Result<{ saleId: string }>> {
  const staff = await requireStaff();
  const paid = input.mode !== "open";

  if (paid && !PAYMENT_METHODS.some((p) => p.key === input.payment_method)) {
    return { ok: false, error: "Pick a payment method." };
  }
  const customer = (input.customer_name ?? "").trim().slice(0, 60);
  if (!paid && !customer) return { ok: false, error: "Add a name for the tab." };

  const items = cleanItems(input.items);
  if (items.length === 0) return { ok: false, error: "Cart is empty." };

  const { data, error } = await db().rpc("create_sale", {
    p_staff_id: staff.id,
    p_business_date: businessDate(),
    p_status: paid ? "paid" : "open",
    p_payment_method: paid ? input.payment_method : null,
    p_tip: 0,
    p_customer_name: customer || null,
    p_note: (input.note ?? "").slice(0, 200),
    p_items: items,
  });
  if (error) return { ok: false, error: dbError(error.message) };

  refresh();
  return { ok: true, saleId: data as string };
}

export async function addToTab(saleId: string, rawItems: CartItem[]): Promise<Result> {
  const staff = await requireStaff();
  const items = cleanItems(rawItems);
  if (items.length === 0) return { ok: false, error: "Cart is empty." };
  const { error } = await db().rpc("add_to_tab", { p_sale_id: saleId, p_staff_id: staff.id, p_items: items });
  if (error) return { ok: false, error: dbError(error.message) };
  refresh();
  return { ok: true };
}

export async function payTab(input: { saleId: string; payment_method: string }): Promise<Result> {
  const staff = await requireStaff();
  if (!PAYMENT_METHODS.some((p) => p.key === input.payment_method)) {
    return { ok: false, error: "Pick a payment method." };
  }
  const { error } = await db().rpc("pay_tab", {
    p_sale_id: input.saleId,
    p_staff_id: staff.id,
    p_payment_method: input.payment_method,
    p_tip: 0,
    p_paid_date: businessDate(),
  });
  if (error) return { ok: false, error: dbError(error.message) };
  refresh();
  return { ok: true };
}

export async function voidSale(saleId: string): Promise<Result> {
  const staff = await requireStaff();
  const sb = db();

  const { data: sale } = await sb
    .from("sales")
    .select("id, staff_id, business_date, voided")
    .eq("id", saleId)
    .maybeSingle();
  if (!sale) return { ok: false, error: "Sale not found." };

  if (staff.role !== "admin") {
    if (sale.staff_id !== staff.id) return { ok: false, error: "You can only void your own sales." };
    const { data: closed } = await sb
      .from("day_audits")
      .select("business_date")
      .eq("business_date", sale.business_date)
      .maybeSingle();
    if (closed) return { ok: false, error: "This day is closed. Ask an admin." };
  }

  const { error } = await sb.rpc("void_sale", { p_sale_id: saleId, p_staff_id: staff.id });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---------- Day audit ----------

export async function closeDay(form: FormData): Promise<Result> {
  const staff = await requireStaff();
  const date = text(form, "date");
  if (!isDateString(date)) return { ok: false, error: "Bad date." };
  const counted = toNum(num(form, "counted_cash"));
  const notes = text(form, "notes").slice(0, 500);

  const sb = db();
  // Cash collected that day, including old tabs paid that day.
  const { data: cashSales, error } = await sb
    .from("sales")
    .select("total")
    .eq("paid_date", date)
    .eq("status", "paid")
    .eq("voided", false)
    .eq("payment_method", "cash");
  if (error) return { ok: false, error: error.message };

  const expected = toNum((cashSales ?? []).reduce((sum, s) => sum + Number(s.total), 0));

  const { error: upErr } = await sb.from("day_audits").upsert({
    business_date: date,
    closed_by: staff.id,
    expected_cash: expected,
    counted_cash: counted,
    difference: toNum(counted - expected),
    notes: notes || null,
    closed_at: new Date().toISOString(),
  });
  if (upErr) return { ok: false, error: upErr.message };
  refresh();
  return { ok: true };
}

export async function reopenDay(date: string): Promise<Result> {
  await requireAdmin();
  if (!isDateString(date)) return { ok: false, error: "Bad date." };
  const { error } = await db().from("day_audits").delete().eq("business_date", date);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---------- Inventory ----------

export async function saveProduct(form: FormData): Promise<Result> {
  const me = await requireAdmin();
  const id = text(form, "id");
  const name = text(form, "name").slice(0, 60);
  const category = text(form, "category");
  if (!name) return { ok: false, error: "Name is required." };
  if (!CATEGORIES.some((c) => c.key === category)) return { ok: false, error: "Pick a category." };

  const row = {
    name,
    category,
    price: Math.max(0, toNum(num(form, "price"))),
    cost: Math.max(0, toNum(num(form, "cost"))),
    low_stock_at: Math.max(0, Math.round(num(form, "low_stock_at", 3))),
    track_stock: form.get("track_stock") === "on",
  };

  const sb = db();
  if (id) {
    const { error } = await sb.from("products").update(row).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const stock = Math.round(num(form, "stock"));
    const { data, error } = await sb
      .from("products")
      .insert({ ...row, stock })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    if (stock !== 0 && row.track_stock) {
      await sb.from("stock_movements").insert({
        product_id: data.id,
        staff_id: me.id,
        change: stock,
        reason: "restock",
        note: "Starting stock",
      });
    }
  }
  refresh();
  return { ok: true };
}

export async function setProductActive(id: string, active: boolean): Promise<Result> {
  await requireAdmin();
  const { error } = await db().from("products").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// Restock: add bottles that came in. Any staff can do this.
// Count: set stock to what is really on the shelf. Admin only.
export async function changeStock(form: FormData): Promise<Result> {
  const staff = await requireStaff();
  const id = text(form, "id");
  const mode = text(form, "mode");
  const amount = Math.round(num(form, "amount", NaN));
  const note = text(form, "note").slice(0, 200) || null;
  if (!id || !Number.isFinite(amount)) return { ok: false, error: "Enter a number." };

  if (mode === "count") {
    if (staff.role !== "admin") return { ok: false, error: "Only an admin can set a count." };
    if (amount < 0) return { ok: false, error: "Count can't be below 0." };
  } else if (amount <= 0) {
    return { ok: false, error: "Restock must be more than 0." };
  }

  const { error } = await db().rpc("change_stock", {
    p_product_id: id,
    p_staff_id: staff.id,
    p_mode: mode === "count" ? "count" : "restock",
    p_amount: amount,
    p_note: note ?? "",
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---------- Staff ----------

export async function addStaff(form: FormData): Promise<Result> {
  await requireAdmin();
  const name = text(form, "name").slice(0, 60);
  const email = text(form, "email").toLowerCase();
  const role = text(form, "role") === "admin" ? "admin" : "staff";
  if (!name) return { ok: false, error: "Name is required." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Enter a real email." };

  const { error } = await db().from("staff").insert({ name, email, role });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "That email is already on the list." : error.message };
  }
  refresh();
  return { ok: true };
}

export async function updateStaff(
  id: string,
  patch: { role?: "admin" | "staff"; active?: boolean; name?: string }
): Promise<Result> {
  const me = await requireAdmin();
  const sb = db();

  const removingAdmin = patch.role === "staff" || patch.active === false;
  if (removingAdmin) {
    if (id === me.id) return { ok: false, error: "You can't remove your own admin access." };
  }

  const row: Record<string, unknown> = {};
  if (patch.role) row.role = patch.role === "admin" ? "admin" : "staff";
  if (typeof patch.active === "boolean") row.active = patch.active;
  if (patch.name?.trim()) row.name = patch.name.trim().slice(0, 60);

  const { error } = await sb.from("staff").update(row).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---------- Item photos ----------

const PHOTO_BUCKET = "product-images";

export async function uploadProductImage(form: FormData): Promise<Result> {
  await requireAdmin();
  const id = text(form, "id");
  const file = form.get("file");
  if (!id) return { ok: false, error: "Item not found." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Pick a photo." };
  if (!file.type.startsWith("image/")) return { ok: false, error: "That file is not a photo." };
  if (file.size > 900_000) return { ok: false, error: "Photo is too big. Try another one." };

  const sb = db();
  const { data: product } = await sb.from("products").select("id, image_url").eq("id", id).maybeSingle();
  if (!product) return { ok: false, error: "Item not found." };

  const path = `${id}/${Date.now()}.jpg`;
  const { error: upErr } = await sb.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (upErr) {
    return {
      ok: false,
      error: /bucket/i.test(upErr.message)
        ? "Photo storage is not set up. Run supabase/738-menu.sql in Supabase."
        : upErr.message,
    };
  }
  const url = sb.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;

  const { error } = await sb.from("products").update({ image_url: url }).eq("id", id);
  if (error) {
    return {
      ok: false,
      error: /image_url/.test(error.message)
        ? "Photos are not set up. Run supabase/738-menu.sql in Supabase."
        : error.message,
    };
  }

  await removeStoredPhoto(product.image_url);
  refresh();
  return { ok: true };
}

export async function removeProductImage(id: string): Promise<Result> {
  await requireAdmin();
  const sb = db();
  const { data: product } = await sb.from("products").select("image_url").eq("id", id).maybeSingle();
  if (!product) return { ok: false, error: "Item not found." };
  const { error } = await sb.from("products").update({ image_url: null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await removeStoredPhoto(product.image_url);
  refresh();
  return { ok: true };
}

async function removeStoredPhoto(url: string | null) {
  if (!url) return;
  const marker = `/object/public/${PHOTO_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return;
  await db().storage.from(PHOTO_BUCKET).remove([url.slice(at + marker.length)]);
}
