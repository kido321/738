"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToTab, payTab, removeTabItem, voidSale } from "@/app/actions";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/config";
import { fmtMoney, toNum } from "@/lib/format";
import type { Product, Sale } from "@/lib/types";
import { Sheet } from "@/components/ui";
import { OrderLines, OrderTotals, cartLines, cartPayload, type Cart } from "@/components/SellScreen";

// Buttons at the bottom of a tab page: void, add items, collect.
export function TabActions({ tab, products, canVoid }: { tab: Sale; products: Product[]; canVoid: boolean }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<"pay" | "add" | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <div className="grid grid-cols-[auto_1fr_1.3fr] gap-2">
        {canVoid ? (
          <button
            className="btn-ghost px-3 py-3 text-bad"
            disabled={pending}
            aria-label="Void tab"
            onClick={() => {
              if (!confirm(`Void ${tab.customer_name ?? "this"}'s whole tab? Stock goes back.`)) return;
              start(async () => {
                const res = await voidSale(tab.id);
                if (!res.ok) return alert(res.error);
                router.push("/tabs");
              });
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
            </svg>
          </button>
        ) : (
          <span />
        )}
        <button className="btn-ghost py-3 text-[15px]" onClick={() => setSheet("add")} disabled={pending}>
          + Add items
        </button>
        <button className="btn-gold py-3 text-[15px]" onClick={() => setSheet("pay")} disabled={pending}>
          Collect {fmtMoney(tab.total)}
        </button>
      </div>

      {sheet === "pay" && (
        <PaySheet
          tab={tab}
          onClose={() => setSheet(null)}
          onPaid={() => {
            setSheet(null);
            router.push("/tabs");
          }}
        />
      )}
      {sheet === "add" && <AddSheet tab={tab} products={products} onClose={() => setSheet(null)} />}
    </>
  );
}

export function RemoveItemButton({ itemId, label }: { itemId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      aria-label={`Remove ${label}`}
      disabled={pending}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted active:bg-surface-2 disabled:opacity-40"
      onClick={() => {
        if (!confirm(`Remove ${label} from this tab? Stock goes back.`)) return;
        start(async () => {
          const res = await removeTabItem(itemId);
          if (!res.ok) return alert(res.error);
          router.refresh();
        });
      }}
    >
      {pending ? "…" : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      )}
    </button>
  );
}

function PaySheet({ tab, onClose, onPaid }: { tab: Sale; onClose: () => void; onPaid: () => void }) {
  const [busy, setBusy] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState("");
  const [, start] = useTransition();

  function pay(method: PaymentMethod) {
    setError("");
    setBusy(method);
    start(async () => {
      const res = await payTab({ saleId: tab.id, payment_method: method });
      setBusy(null);
      if (!res.ok) return setError(res.error);
      onPaid();
    });
  }

  return (
    <Sheet onClose={onClose} locked={busy !== null}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-bold">Collect from {tab.customer_name}</h2>
        <span className="tabular text-xl font-bold tracking-tight">{fmtMoney(tab.total)}</span>
      </div>
      {error && <p className="mb-2 rounded-lg bg-bad/15 px-3 py-2 text-[13px] text-bad">{error}</p>}
      <span className="label">Paid with</span>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m.key}
            onClick={() => pay(m.key)}
            disabled={busy !== null}
            className={`btn py-3 text-[15px] ${m.key === "cash" ? "bg-gold text-gold-ink" : "border border-line bg-surface-2 text-ink"}`}
          >
            {busy === m.key ? "Saving..." : m.label}
          </button>
        ))}
      </div>
      <button className="btn-ghost mb-2 w-full" onClick={onClose} disabled={busy !== null}>
        Cancel
      </button>
    </Sheet>
  );
}

function AddSheet({ tab, products, onClose }: { tab: Sale; products: Product[]; onClose: () => void }) {
  const [cart, setCart] = useState<Cart>({});
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lines = cartLines(cart, byId);
  const adding = toNum(lines.reduce((s, l) => s + l.each * l.qty, 0));
  const q = search.trim().toLowerCase();
  const shown = products.filter((p) => !q || p.name.toLowerCase().includes(q));

  function add(id: string) {
    setCart((c) => ({ ...c, [id]: { qty: (c[id]?.qty ?? 0) + 1, price: c[id]?.price ?? null } }));
  }

  return (
    <Sheet onClose={onClose} locked={pending}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="truncate text-base font-bold">Add to {tab.customer_name}&apos;s tab</h2>
        <span className="tabular shrink-0 text-[13px] text-muted">now {fmtMoney(tab.total)}</span>
      </div>

      {products.length > 9 && (
        <input
          className="field mb-2"
          placeholder="Search items"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        {shown.map((p) => {
          const qty = cart[p.id]?.qty ?? 0;
          return (
            <button
              key={p.id}
              onClick={() => add(p.id)}
              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left active:scale-[0.98] ${
                qty ? "border-gold/80 bg-gold/[0.07]" : "border-line bg-surface-2"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold">{p.name}</span>
                <span className="tabular text-[12px] text-gold">{fmtMoney(p.price)}</span>
              </span>
              {qty > 0 && (
                <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-gold px-1.5 text-xs font-bold text-gold-ink">
                  {qty}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {lines.length > 0 && (
        <>
          <OrderLines cart={cart} setCart={setCart} byId={byId} />
          <OrderTotals cart={cart} byId={byId} label="Adding" />
        </>
      )}

      {error && <p className="mt-2 rounded-lg bg-bad/15 px-3 py-2 text-[13px] text-bad">{error}</p>}

      <div className="mt-3 mb-2 grid grid-cols-3 gap-2">
        <button className="btn-ghost py-3" onClick={onClose} disabled={pending}>
          Cancel
        </button>
        <button
          className="btn-gold col-span-2 py-3 text-[15px]"
          disabled={pending || lines.length === 0}
          onClick={() =>
            start(async () => {
              setError("");
              const res = await addToTab(tab.id, cartPayload(lines));
              if (!res.ok) return setError(res.error);
              onClose();
            })
          }
        >
          {pending
            ? "Saving..."
            : lines.length
              ? `Add ${fmtMoney(adding)} → ${fmtMoney(tab.total + adding)}`
              : "Tap items to add"}
        </button>
      </div>
    </Sheet>
  );
}
