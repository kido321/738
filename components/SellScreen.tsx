"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSale } from "@/app/actions";
import { CATEGORIES, PAYMENT_METHODS, type PaymentMethod } from "@/lib/config";
import { fmtMoney, toNum } from "@/lib/format";
import type { Product } from "@/lib/types";
import { ItemPhoto } from "@/components/ItemPhoto";

type Cart = Record<string, number>;

const TIP_PRESETS = [0, 10, 15, 20];

export function SellScreen({ products }: { products: Product[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<string>("all");
  const [cart, setCart] = useState<Cart>({});
  const [open, setOpen] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [tipPct, setTipPct] = useState<number | null>(0);
  const [tipCustom, setTipCustom] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const shown = tab === "all" ? products : products.filter((p) => p.category === tab);

  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ product: byId.get(id), qty }))
    .filter((l): l is { product: Product; qty: number } => !!l.product && l.qty > 0);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = toNum(lines.reduce((s, l) => s + l.product.price * l.qty, 0));
  const tip = tipPct === null ? Math.max(0, toNum(Number(tipCustom) || 0)) : toNum((subtotal * tipPct) / 100);
  const total = toNum(subtotal + tip);

  function add(id: string, n = 1) {
    setCart((c) => {
      const next = { ...c, [id]: Math.max(0, (c[id] ?? 0) + n) };
      if (next[id] === 0) delete next[id];
      return next;
    });
  }

  function reset() {
    setCart({});
    setOpen(false);
    setPayment("cash");
    setTipPct(0);
    setTipCustom("");
    setNote("");
    setError("");
  }

  function charge() {
    setError("");
    startTransition(async () => {
      const res = await createSale({
        items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
        payment_method: payment,
        tip,
        note,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      reset();
      setToast(`Sale saved · ${fmtMoney(total)}`);
      setTimeout(() => setToast(""), 2500);
      router.refresh();
    });
  }

  if (products.length === 0) {
    return (
      <div className="card text-center">
        <p className="mb-1 font-semibold">No items yet</p>
        <p className="mb-4 text-sm text-muted">Add bottles, drinks and hookah on the Inventory page.</p>
        <Link href="/inventory" className="btn-gold">
          Go to Inventory
        </Link>
      </div>
    );
  }

  return (
    <div className={count > 0 ? "pb-20" : ""}>
      {/* Category tabs */}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {[{ key: "all", label: "All" }, ...CATEGORIES].map((c) => (
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
          const inCart = cart[p.id] ?? 0;
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
              <span className="pr-1 font-semibold leading-snug">{p.name}</span>
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
                <span className="absolute top-2 right-2 grid h-7 min-w-7 shadow-md shadow-black/40 place-items-center rounded-full bg-gold px-1.5 text-xs font-bold text-gold-ink">
                  {inCart}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Cart bar */}
      {count > 0 && !open && (
        <div className="fixed inset-x-0 z-20 mx-auto max-w-2xl px-4" style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}>
          <button onClick={() => setOpen(true)} className="btn-gold w-full justify-between py-3.5 text-base shadow-lg shadow-black/40">
            <span>
              {count} item{count === 1 ? "" : "s"}
            </span>
            <span className="tabular">Charge {fmtMoney(subtotal)}</span>
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
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Checkout</h2>
              <button className="text-sm text-muted" onClick={() => setCart({})} disabled={pending}>
                Clear
              </button>
            </div>

            <ul className="mb-4 divide-y divide-line">
              {lines.map(({ product, qty }) => (
                <li key={product.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1">
                    <div className="font-medium">{product.name}</div>
                    <div className="tabular text-xs text-muted">{fmtMoney(product.price)} each</div>
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
                  <div className="tabular w-20 text-right font-semibold">{fmtMoney(product.price * qty)}</div>
                </li>
              ))}
            </ul>

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
              <button onClick={() => setTipPct(null)} className={`${tipPct === null ? "btn-gold" : "btn-ghost"} px-0`}>
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

            <div className="tabular mb-4 space-y-1 text-sm">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>{fmtMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Tip</span>
                <span>{fmtMoney(tip)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{fmtMoney(total)}</span>
              </div>
            </div>

            {error && <p className="mb-3 rounded-xl bg-bad/15 px-3 py-2 text-sm text-bad">{error}</p>}

            <div className="mb-3 grid grid-cols-3 gap-2">
              <button className="btn-ghost" onClick={() => setOpen(false)} disabled={pending}>
                Back
              </button>
              <button className="btn-gold col-span-2 py-3.5 text-base" onClick={charge} disabled={pending || count === 0}>
                {pending ? "Saving..." : `Complete ${fmtMoney(total)}`}
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
