"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addToTab, createSale } from "@/app/actions";
import { CATEGORIES, PAYMENT_METHODS, type PaymentMethod } from "@/lib/config";
import { fmtMoney, toNum } from "@/lib/format";
import type { Product } from "@/lib/types";
import { ItemPhoto } from "@/components/ItemPhoto";

export type OpenTabLite = { id: string; customer_name: string | null; total: number };

// qty plus an optional custom price per item (null = menu price)
type Cart = Record<string, { qty: number; price: number | null }>;
type Mode = "paid" | "open";

const TIP_PRESETS = [0, 10, 15, 20];

export function SellScreen({ products, openTabs }: { products: Product[]; openTabs: OpenTabLite[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("paid");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [tipPct, setTipPct] = useState<number | null>(0);
  const [tipCustom, setTipCustom] = useState("");
  const [customer, setCustomer] = useState("");
  const [tabId, setTabId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const q = search.trim().toLowerCase();
  const shown = products.filter(
    (p) => (tab === "all" || p.category === tab) && (!q || p.name.toLowerCase().includes(q))
  );

  const lines = Object.entries(cart)
    .map(([id, c]) => ({ product: byId.get(id), qty: c.qty, price: c.price }))
    .filter((l): l is { product: Product; qty: number; price: number | null } => !!l.product && l.qty > 0)
    .map((l) => ({ ...l, each: l.price ?? l.product.price }));
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const listTotal = toNum(lines.reduce((s, l) => s + l.product.price * l.qty, 0));
  const subtotal = toNum(lines.reduce((s, l) => s + l.each * l.qty, 0));
  const discount = toNum(listTotal - subtotal);
  const tip =
    mode === "open"
      ? 0
      : tipPct === null
        ? Math.max(0, toNum(Number(tipCustom) || 0))
        : toNum((subtotal * tipPct) / 100);
  const total = toNum(subtotal + tip);
  const chosenTab = openTabs.find((t) => t.id === tabId) ?? null;

  function add(id: string, n = 1) {
    setCart((c) => {
      const cur = c[id] ?? { qty: 0, price: null };
      const qty = Math.max(0, cur.qty + n);
      const next = { ...c, [id]: { ...cur, qty } };
      if (qty === 0) delete next[id];
      return next;
    });
  }

  function setPrice(id: string, value: string) {
    setCart((c) => {
      if (!c[id]) return c;
      const n = value.trim() === "" ? null : Number(value);
      return { ...c, [id]: { ...c[id], price: n == null || !Number.isFinite(n) || n < 0 ? null : toNum(n) } };
    });
  }

  function reset() {
    setCart({});
    setOpen(false);
    setMode("paid");
    setPayment("cash");
    setTipPct(0);
    setTipCustom("");
    setCustomer("");
    setTabId(null);
    setNote("");
    setEditing(null);
    setError("");
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function submit() {
    setError("");
    const items = lines.map((l) => ({
      product_id: l.product.id,
      qty: l.qty,
      price: l.price != null && l.price !== l.product.price ? l.price : null,
    }));
    startTransition(async () => {
      let res;
      if (mode === "open" && chosenTab) {
        res = await addToTab(chosenTab.id, items);
      } else {
        res = await createSale({
          items,
          mode,
          payment_method: mode === "paid" ? payment : null,
          tip,
          customer_name: customer,
          note,
        });
      }
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const msg =
        mode === "paid"
          ? `Paid · ${fmtMoney(total)}`
          : chosenTab
            ? `Added ${fmtMoney(subtotal)} to ${chosenTab.customer_name}`
            : `Tab opened for ${customer.trim()}`;
      reset();
      flash(msg);
      router.refresh();
    });
  }

  if (products.length === 0) {
    return (
      <div className="card text-center">
        <p className="mb-1 font-semibold">No items yet</p>
        <p className="mb-4 text-sm text-muted">Add bottles and hookah on the Inventory page.</p>
        <Link href="/inventory" className="btn-gold">
          Go to Inventory
        </Link>
      </div>
    );
  }

  const canSubmit =
    count > 0 && !pending && (mode === "paid" ? true : !!chosenTab || customer.trim().length > 0);

  const buttonText = pending
    ? "Saving..."
    : mode === "paid"
      ? `Paid ${fmtMoney(total)}`
      : chosenTab
        ? `Add ${fmtMoney(subtotal)} to tab`
        : `Open tab · ${fmtMoney(subtotal)}`;

  return (
    <div className={count > 0 ? "pb-20" : ""}>
      {/* Search + category tabs */}
      {products.length > 8 && (
        <input
          className="field mb-3"
          placeholder="Search items"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          enterKeyHint="search"
        />
      )}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {[{ key: "all", label: "All" }, ...CATEGORIES]
          .filter((c) => c.key === "all" || products.some((p) => p.category === c.key))
          .map((c) => (
            <button
              key={c.key}
              onClick={() => setTab(c.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                tab === c.key ? "bg-gold text-gold-ink" : "border border-line bg-surface text-ink"
              }`}
            >
              {c.label}
            </button>
          ))}
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {shown.map((p) => {
          const inCart = cart[p.id]?.qty ?? 0;
          const low = p.track_stock && p.stock <= p.low_stock_at;
          const left = p.track_stock ? p.stock - inCart : null;
          return (
            <button
              key={p.id}
              onClick={() => add(p.id)}
              className={`relative flex flex-col overflow-hidden rounded-2xl border text-left transition active:scale-[0.97] ${
                inCart ? "border-gold bg-gold/10" : "border-line bg-surface"
              }`}
            >
              <ItemPhoto url={p.image_url} category={p.category} name={p.name} className="aspect-[4/3] w-full" />
              <span className="flex flex-1 flex-col justify-between p-3">
                <span className="font-semibold leading-snug">{p.name}</span>
                <span className="mt-2 flex items-end justify-between">
                  <span className="tabular text-lg font-bold text-gold">{fmtMoney(p.price)}</span>
                  {left !== null && (
                    <span className={`text-xs ${left <= 0 ? "text-bad" : low ? "text-warn" : "text-muted"}`}>
                      {left <= 0 ? "Out" : `${left} left`}
                    </span>
                  )}
                </span>
              </span>
              {inCart > 0 && (
                <span className="absolute top-2 right-2 grid h-7 min-w-7 place-items-center rounded-full bg-gold px-1.5 text-xs font-bold text-gold-ink shadow-md shadow-black/40">
                  {inCart}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {shown.length === 0 && <p className="py-6 text-center text-sm text-muted">Nothing matches “{search}”.</p>}

      {/* Cart bar */}
      {count > 0 && !open && (
        <div
          className="fixed inset-x-0 z-20 mx-auto max-w-2xl px-4"
          style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={() => setOpen(true)}
            className="btn-gold w-full justify-between py-3.5 text-base shadow-lg shadow-black/40"
          >
            <span>
              {count} item{count === 1 ? "" : "s"}
            </span>
            <span className="tabular">Checkout {fmtMoney(subtotal)}</span>
          </button>
        </div>
      )}

      {/* Checkout sheet */}
      {open && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => !pending && setOpen(false)}>
          <div
            className="pb-safe mx-auto max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border-t border-line bg-surface px-4 pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold">Checkout</h2>
              <button className="text-sm text-muted" onClick={() => setCart({})} disabled={pending}>
                Clear
              </button>
            </div>
            <p className="mb-2 text-xs text-muted">Tap a price to change it for this customer.</p>

            {/* Lines */}
            <ul className="mb-4 divide-y divide-line">
              {lines.map(({ product, qty, price, each }) => {
                const custom = price != null && price !== product.price;
                const isEditing = editing === product.id;
                return (
                  <li key={product.id} className="py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium leading-snug">{product.name}</div>
                        <button
                          className={`tabular mt-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                            custom ? "bg-gold/20 text-gold" : "bg-surface-2 text-muted"
                          }`}
                          onClick={() => setEditing(isEditing ? null : product.id)}
                        >
                          {fmtMoney(each)} each ✎
                        </button>
                        {custom && (
                          <span className="tabular ml-1.5 text-xs text-muted line-through">{fmtMoney(product.price)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="btn-ghost h-9 w-9 p-0" onClick={() => add(product.id, -1)} aria-label="Less">
                          −
                        </button>
                        <span className="tabular w-6 text-center font-semibold">{qty}</span>
                        <button className="btn-ghost h-9 w-9 p-0" onClick={() => add(product.id, 1)} aria-label="More">
                          +
                        </button>
                      </div>
                      <div className="tabular w-20 text-right font-semibold">{fmtMoney(each * qty)}</div>
                    </div>
                    {isEditing && (
                      <div className="mt-2 flex items-center gap-2 rounded-xl bg-surface-2 p-2">
                        <span className="text-sm text-muted">$</span>
                        <input
                          autoFocus
                          className="field flex-1 py-2"
                          inputMode="decimal"
                          placeholder={String(product.price)}
                          defaultValue={custom ? String(price) : ""}
                          onChange={(e) => setPrice(product.id, e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && setEditing(null)}
                        />
                        {custom && (
                          <button
                            className="btn-ghost px-3 py-2 text-sm"
                            onClick={() => {
                              setPrice(product.id, "");
                              setEditing(null);
                            }}
                          >
                            Reset
                          </button>
                        )}
                        <button className="btn-gold px-3 py-2 text-sm" onClick={() => setEditing(null)}>
                          Done
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Pay now / Tab */}
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
              {(["paid", "open"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setError("");
                  }}
                  className={`rounded-lg py-2.5 text-sm font-semibold ${
                    mode === m ? "bg-gold text-gold-ink" : "text-muted"
                  }`}
                >
                  {m === "paid" ? "Pay now" : "Tab · pay later"}
                </button>
              ))}
            </div>

            {mode === "paid" ? (
              <>
                <span className="label">Payment</span>
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setPayment(m.key)}
                      className={payment === m.key ? "btn-gold" : "btn-ghost"}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <span className="label">Tip</span>
                <div className="mb-2 grid grid-cols-5 gap-2">
                  {TIP_PRESETS.map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setTipPct(pct)}
                      className={`${tipPct === pct ? "btn-gold" : "btn-ghost"} px-0`}
                    >
                      {pct === 0 ? "None" : `${pct}%`}
                    </button>
                  ))}
                  <button
                    onClick={() => setTipPct(null)}
                    className={`${tipPct === null ? "btn-gold" : "btn-ghost"} px-0`}
                  >
                    $
                  </button>
                </div>
                {tipPct === null && (
                  <input
                    className="field mb-2"
                    inputMode="decimal"
                    placeholder="Tip amount"
                    value={tipCustom}
                    onChange={(e) => setTipCustom(e.target.value)}
                  />
                )}
                <input
                  className="field mt-2 mb-4"
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
                    <div className="mb-3 flex flex-wrap gap-2">
                      {openTabs.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setTabId(tabId === t.id ? null : t.id);
                            setCustomer("");
                          }}
                          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                            tabId === t.id ? "bg-gold text-gold-ink" : "border border-line bg-surface-2"
                          }`}
                        >
                          {t.customer_name} <span className="tabular opacity-70">{fmtMoney(t.total)}</span>
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
                {!chosenTab && (
                  <input
                    className="field mb-4"
                    placeholder="Note (table, phone...) optional"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={200}
                  />
                )}
                {chosenTab && (
                  <p className="mb-4 text-sm text-muted">
                    {chosenTab.customer_name}&apos;s tab goes from {fmtMoney(chosenTab.total)} to{" "}
                    <span className="tabular font-semibold text-ink">{fmtMoney(chosenTab.total + subtotal)}</span>.
                  </p>
                )}
              </>
            )}

            {/* Totals */}
            <div className="tabular mb-4 space-y-1 text-sm">
              {discount !== 0 && (
                <div className="flex justify-between text-muted">
                  <span>Menu price</span>
                  <span>{fmtMoney(listTotal)}</span>
                </div>
              )}
              {discount !== 0 && (
                <div className={`flex justify-between ${discount > 0 ? "text-warn" : "text-good"}`}>
                  <span>{discount > 0 ? "Discount" : "Extra"}</span>
                  <span>
                    {discount > 0 ? "−" : "+"}
                    {fmtMoney(Math.abs(discount))}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>{fmtMoney(subtotal)}</span>
              </div>
              {mode === "paid" && (
                <div className="flex justify-between text-muted">
                  <span>Tip</span>
                  <span>{fmtMoney(tip)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>{mode === "paid" ? "Total" : "Owed"}</span>
                <span>{fmtMoney(mode === "paid" ? total : subtotal)}</span>
              </div>
            </div>

            {error && <p className="mb-3 rounded-xl bg-bad/15 px-3 py-2 text-sm text-bad">{error}</p>}

            <div className="mb-3 grid grid-cols-3 gap-2">
              <button className="btn-ghost" onClick={() => setOpen(false)} disabled={pending}>
                Back
              </button>
              <button className="btn-gold col-span-2 py-3.5 text-base" onClick={submit} disabled={!canSubmit}>
                {buttonText}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4">
          <div className="mt-2 rounded-full bg-good px-4 py-2 text-sm font-semibold text-black shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  );
}
