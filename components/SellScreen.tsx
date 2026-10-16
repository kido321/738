"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { addToTab, createSale, voidSale } from "@/app/actions";
import { CATEGORIES, PAYMENT_METHODS, type PaymentMethod } from "@/lib/config";
import { fmtMoney, toNum } from "@/lib/format";
import type { Product } from "@/lib/types";
import { ItemPhoto } from "@/components/ItemPhoto";
import { Sheet } from "@/components/ui";

export type OpenTabLite = { id: string; customer_name: string | null; total: number };

// qty plus an optional custom price per item (null = menu price)
export type Cart = Record<string, { qty: number; price: number | null }>;

export function cartLines(cart: Cart, byId: Map<string, Product>) {
  return Object.entries(cart)
    .map(([id, c]) => ({ product: byId.get(id), qty: c.qty, price: c.price }))
    .filter((l): l is { product: Product; qty: number; price: number | null } => !!l.product && l.qty > 0)
    .map((l) => ({ ...l, each: l.price ?? l.product.price }));
}

export function cartPayload(lines: ReturnType<typeof cartLines>) {
  return lines.map((l) => ({
    product_id: l.product.id,
    qty: l.qty,
    price: l.price != null && l.price !== l.product.price ? l.price : null,
  }));
}

type Toast = { msg: string; undoId?: string } | null;

export function SellScreen({ products, openTabs }: { products: Product[]; openTabs: OpenTabLite[] }) {
  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [undoing, startUndo] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const q = search.trim().toLowerCase();
  const shown = products.filter(
    (p) => (tab === "all" || p.category === tab) && (!q || p.name.toLowerCase().includes(q))
  );
  const lines = cartLines(cart, byId);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = toNum(lines.reduce((s, l) => s + l.each * l.qty, 0));

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  function add(id: string, n = 1) {
    setCart((c) => bump(c, id, n));
  }

  function flash(t: Toast, ms = 5000) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }

  if (products.length === 0) {
    return (
      <div className="card text-center">
        <p className="mb-1 font-semibold">No items yet</p>
        <p className="mb-3 text-[13px] text-muted">Add bottles and hookah on the Inventory page.</p>
        <Link href="/inventory" className="btn-gold">
          Go to Inventory
        </Link>
      </div>
    );
  }

  const cats = [{ key: "all", label: "All" }, ...CATEGORIES.filter((c) => products.some((p) => p.category === c.key))];

  return (
    <div className={count > 0 ? "pb-16" : ""}>
      {/* Filters */}
      <div className="no-scrollbar -mx-4 mb-2.5 flex items-center gap-1.5 overflow-x-auto px-4">
        {cats.length > 2 &&
          cats.map((c) => (
            <button key={c.key} onClick={() => setTab(c.key)} className={tab === c.key ? "chip-on" : "chip"}>
              {c.label}
            </button>
          ))}
        {products.length > 9 && (
          <input
            className="field ml-auto h-8 w-32 shrink-0 rounded-full px-3 py-0 text-[13px]"
            style={{ fontSize: 16 }}
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            enterKeyHint="search"
          />
        )}
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {shown.map((p) => {
          const inCart = cart[p.id]?.qty ?? 0;
          const left = p.track_stock ? p.stock - inCart : null;
          const low = p.track_stock && left !== null && left <= p.low_stock_at;
          return (
            <div
              key={p.id}
              className={`relative overflow-hidden rounded-xl border transition ${
                inCart ? "border-gold/80 bg-gold/[0.07]" : "border-line bg-surface"
              }`}
            >
              <button onClick={() => add(p.id)} className="block w-full text-left active:opacity-80">
                <ItemPhoto url={p.image_url} category={p.category} name={p.name} className="aspect-[4/3] w-full" small />
                <div className="px-2 pt-1.5 pb-2">
                  <div className="line-clamp-2 min-h-[2lh] text-[12.5px] leading-tight font-semibold">{p.name}</div>
                  <div className="mt-1 flex items-baseline justify-between gap-1">
                    <span className="tabular text-[13px] font-bold text-gold">{fmtMoney(p.price)}</span>
                    {left !== null && (
                      <span className={`tabular text-[10.5px] ${left <= 0 ? "text-bad" : low ? "text-warn" : "text-muted"}`}>
                        {left <= 0 ? "Out" : left}
                      </span>
                    )}
                  </div>
                </div>
              </button>
              {inCart > 0 && (
                <>
                  <span className="pointer-events-none absolute top-1.5 right-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-gold px-1.5 text-xs font-bold text-gold-ink shadow shadow-black/50">
                    {inCart}
                  </span>
                  <button
                    onClick={() => add(p.id, -1)}
                    aria-label={`Remove one ${p.name}`}
                    className="absolute top-1.5 left-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-sm font-bold text-ink backdrop-blur"
                  >
                    −
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
      {shown.length === 0 && <p className="py-6 text-center text-[13px] text-muted">Nothing matches “{search}”.</p>}

      {/* Cart bar */}
      {count > 0 && !open && (
        <div
          className="fixed inset-x-0 z-20 mx-auto max-w-2xl px-4"
          style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-between rounded-xl bg-gold px-4 py-3 text-gold-ink shadow-lg shadow-black/50 active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-gold-ink/90 px-1.5 text-xs text-gold">
                {count}
              </span>
              Review order
            </span>
            <span className="tabular text-base font-bold">{fmtMoney(subtotal)}</span>
          </button>
        </div>
      )}

      {open && (
        <Checkout
          cart={cart}
          setCart={setCart}
          byId={byId}
          openTabs={openTabs}
          onClose={() => setOpen(false)}
          onDone={(t) => {
            setCart({});
            setOpen(false);
            flash(t);
          }}
        />
      )}

      {toast && (
        <div className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4">
          <div className="pointer-events-auto mt-1 flex items-center gap-3 rounded-full bg-surface-3 py-1.5 pr-1.5 pl-4 text-[13px] font-semibold shadow-xl shadow-black/60 ring-1 ring-line">
            <span className="text-good">✓</span>
            <span>{toast.msg}</span>
            {toast.undoId ? (
              <button
                disabled={undoing}
                className="rounded-full bg-surface-2 px-3 py-1 text-[12px] text-gold"
                onClick={() =>
                  startUndo(async () => {
                    const res = await voidSale(toast.undoId!);
                    flash({ msg: res.ok ? "Undone" : res.error }, 2500);
                  })
                }
              >
                {undoing ? "..." : "Undo"}
              </button>
            ) : (
              <span className="w-1" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function bump(c: Cart, id: string, n: number): Cart {
  const cur = c[id] ?? { qty: 0, price: null };
  const qty = Math.max(0, cur.qty + n);
  const next = { ...c, [id]: { ...cur, qty } };
  if (qty === 0) delete next[id];
  return next;
}

// ---------- Order lines with steppers and custom price (shared with Tabs) ----------

export function OrderLines({
  cart,
  setCart,
  byId,
}: {
  cart: Cart;
  setCart: React.Dispatch<React.SetStateAction<Cart>>;
  byId: Map<string, Product>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const lines = cartLines(cart, byId);

  function setPrice(id: string, value: string) {
    setCart((c) => {
      if (!c[id]) return c;
      const n = value.trim() === "" ? null : Number(value);
      return { ...c, [id]: { ...c[id], price: n == null || !Number.isFinite(n) || n < 0 ? null : toNum(n) } };
    });
  }

  return (
    <ul className="divide-y divide-line/70">
      {lines.map(({ product, qty, price, each }) => {
        const custom = price != null && price !== product.price;
        const isEditing = editing === product.id;
        return (
          <li key={product.id} className="py-2">
            <div className="flex items-center gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{product.name}</div>
                <button
                  className={`tabular mt-0.5 inline-flex items-center gap-1 rounded px-1.5 py-px text-[11.5px] font-semibold ${
                    custom ? "bg-gold/15 text-gold" : "bg-surface-2 text-muted"
                  }`}
                  onClick={() => setEditing(isEditing ? null : product.id)}
                >
                  {fmtMoney(each)}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
                  </svg>
                </button>
                {custom && <span className="tabular ml-1.5 text-[11px] text-muted line-through">{fmtMoney(product.price)}</span>}
              </div>
              <div className="flex items-center rounded-lg border border-line bg-surface-2">
                <button className="grid h-8 w-8 place-items-center text-lg leading-none" onClick={() => setCart((c) => bump(c, product.id, -1))} aria-label="Less">
                  −
                </button>
                <span className="tabular w-6 text-center text-sm font-semibold">{qty}</span>
                <button className="grid h-8 w-8 place-items-center text-lg leading-none" onClick={() => setCart((c) => bump(c, product.id, 1))} aria-label="More">
                  +
                </button>
              </div>
              <div className="tabular w-[4.5rem] text-right text-sm font-semibold">{fmtMoney(each * qty)}</div>
            </div>
            {isEditing && (
              <div className="mt-2 flex items-center gap-1.5">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">$</span>
                  <input
                    autoFocus
                    className="field pl-6"
                    inputMode="decimal"
                    placeholder={`${product.price} (menu price)`}
                    defaultValue={custom ? String(price) : ""}
                    onChange={(e) => setPrice(product.id, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && setEditing(null)}
                  />
                </div>
                {custom && (
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setPrice(product.id, "");
                      setEditing(null);
                    }}
                  >
                    Reset
                  </button>
                )}
                <button className="btn-gold" onClick={() => setEditing(null)}>
                  Done
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function OrderTotals({ cart, byId, label = "Total" }: { cart: Cart; byId: Map<string, Product>; label?: string }) {
  const lines = cartLines(cart, byId);
  const listTotal = toNum(lines.reduce((s, l) => s + l.product.price * l.qty, 0));
  const total = toNum(lines.reduce((s, l) => s + l.each * l.qty, 0));
  const diff = toNum(listTotal - total);
  return (
    <div className="tabular mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
      {diff !== 0 && (
        <div className="flex justify-between text-muted">
          <span>Menu {fmtMoney(listTotal)}</span>
          <span className={diff > 0 ? "text-warn" : "text-good"}>
            {diff > 0 ? "Discount −" : "Extra +"}
            {fmtMoney(Math.abs(diff))}
          </span>
        </div>
      )}
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{label}</span>
        <span className="text-xl font-bold tracking-tight">{fmtMoney(total)}</span>
      </div>
    </div>
  );
}

// ---------- Checkout ----------

type Mode = "paid" | "open";

function Checkout({
  cart,
  setCart,
  byId,
  openTabs,
  onClose,
  onDone,
}: {
  cart: Cart;
  setCart: React.Dispatch<React.SetStateAction<Cart>>;
  byId: Map<string, Product>;
  openTabs: OpenTabLite[];
  onClose: () => void;
  onDone: (t: Toast) => void;
}) {
  const [mode, setMode] = useState<Mode>("paid");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [customer, setCustomer] = useState("");
  const [tabId, setTabId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const lines = cartLines(cart, byId);
  const total = toNum(lines.reduce((s, l) => s + l.each * l.qty, 0));
  const chosenTab = openTabs.find((t) => t.id === tabId) ?? null;
  const name = customer.trim();
  const payLabel = PAYMENT_METHODS.find((m) => m.key === payment)?.label ?? "";

  useEffect(() => {
    if (lines.length === 0) onClose();
  }, [lines.length, onClose]);

  function submit() {
    setError("");
    start(async () => {
      if (mode === "paid") {
        const res = await createSale({ items: cartPayload(lines), mode: "paid", payment_method: payment, note });
        if (!res.ok) return setError(res.error);
        onDone({ msg: `Paid · ${payLabel} · ${fmtMoney(total)}`, undoId: res.saleId });
      } else if (chosenTab) {
        const res = await addToTab(chosenTab.id, cartPayload(lines));
        if (!res.ok) return setError(res.error);
        onDone({ msg: `Added ${fmtMoney(total)} to ${chosenTab.customer_name}` });
      } else {
        const res = await createSale({ items: cartPayload(lines), mode: "open", customer_name: name, note });
        if (!res.ok) return setError(res.error);
        onDone({ msg: `Tab opened for ${name}`, undoId: res.saleId });
      }
    });
  }

  const ready = mode === "paid" || !!chosenTab || name.length > 0;
  const buttonText = pending
    ? "Saving..."
    : mode === "paid"
      ? `Paid ${fmtMoney(total)} · ${payLabel}`
      : chosenTab
        ? `Add ${fmtMoney(total)} to ${chosenTab.customer_name}'s tab`
        : name
          ? `Open tab for ${name} · ${fmtMoney(total)}`
          : "Pick a tab or type a name";

  return (
    <Sheet onClose={onClose} locked={pending}>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-bold">Checkout</h2>
        <button className="text-[13px] font-medium text-muted" onClick={() => setCart({})} disabled={pending}>
          Clear
        </button>
      </div>

      <OrderLines cart={cart} setCart={setCart} byId={byId} />
      <OrderTotals cart={cart} byId={byId} label={mode === "paid" ? "Total" : "Owed"} />

      {/* Pay now / Tab switch */}
      <div className="mt-3 mb-3 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
        {(["paid", "open"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError("");
            }}
            className={`rounded-lg py-2.5 text-sm font-semibold transition ${
              mode === m ? (m === "paid" ? "bg-gold text-gold-ink" : "bg-warn text-black") : "text-muted"
            }`}
          >
            {m === "paid" ? "Pay now" : "Tab · pay later"}
          </button>
        ))}
      </div>

      {mode === "paid" ? (
        <>
          <span className="label">Payment</span>
          <div className="mb-2 grid grid-cols-4 gap-1.5">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.key}
                onClick={() => setPayment(m.key)}
                className={`btn px-1 py-2.5 text-[13px] ${
                  payment === m.key ? "bg-gold text-gold-ink" : "border border-line bg-surface-2 text-ink"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <input
            className="field mb-3"
            placeholder="Note (table, name...) optional"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
        </>
      ) : (
        <>
          {openTabs.length > 0 && (
            <>
              <span className="label">Add to an open tab</span>
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {openTabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTabId(tabId === t.id ? null : t.id);
                      setCustomer("");
                    }}
                    className={tabId === t.id ? "chip-on" : "chip"}
                  >
                    {t.customer_name} <span className="tabular font-medium opacity-70">{fmtMoney(t.total)}</span>
                  </button>
                ))}
              </div>
              <span className="label">Or start a new tab</span>
            </>
          )}
          <input
            className="field mb-2"
            placeholder="Customer name"
            value={customer}
            onChange={(e) => {
              setCustomer(e.target.value);
              setTabId(null);
            }}
            maxLength={60}
            autoCapitalize="words"
          />
          {chosenTab ? (
            <p className="mb-3 text-[13px] text-muted">
              {chosenTab.customer_name}&apos;s tab goes from {fmtMoney(chosenTab.total)} to{" "}
              <span className="tabular font-semibold text-ink">{fmtMoney(chosenTab.total + total)}</span>.
            </p>
          ) : (
            <input
              className="field mb-3"
              placeholder="Table / phone (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
          )}
        </>
      )}

      {error && <p className="mb-2 rounded-lg bg-bad/15 px-3 py-2 text-[13px] text-bad">{error}</p>}

      <div className="mb-2 grid grid-cols-[1fr_2.6fr] gap-2">
        <button className="btn-ghost py-3" onClick={onClose} disabled={pending}>
          Back
        </button>
        <button
          onClick={submit}
          disabled={pending || !ready}
          className={`btn py-3 text-[15px] ${
            !ready
              ? "border border-line bg-surface-2 text-muted"
              : mode === "paid"
                ? "bg-gold text-gold-ink"
                : "bg-warn text-black"
          }`}
        >
          {buttonText}
        </button>
      </div>
    </Sheet>
  );
}
