"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { payTab, voidSale } from "@/app/actions";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/config";
import { fmtMoney, fmtTime, toNum } from "@/lib/format";
import type { Sale } from "@/lib/types";

const TIP_PRESETS = [0, 10, 15, 20];

export function TabCard({
  tab,
  takenBy,
  dayLabel,
  pastNight,
  canVoid,
}: {
  tab: Sale;
  takenBy: string;
  dayLabel: string;
  pastNight: boolean;
  canVoid: boolean;
}) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [pending, start] = useTransition();

  // Group repeated items (a tab can get the same bottle added twice)
  const items = new Map<string, { name: string; qty: number; total: number; custom: boolean }>();
  for (const i of tab.sale_items) {
    const key = `${i.name}|${i.unit_price}`;
    const cur = items.get(key) ?? { name: i.name, qty: 0, total: 0, custom: false };
    cur.qty += i.qty;
    cur.total += i.line_total;
    cur.custom = cur.custom || (i.list_price != null && i.list_price !== i.unit_price);
    items.set(key, cur);
  }

  return (
    <div className={`card ${pastNight ? "border-bad/40" : ""}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">{tab.customer_name || "No name"}</div>
          <div className="text-xs text-muted">
            {dayLabel} · {fmtTime(tab.created_at)} · by {takenBy}
          </div>
          {tab.note && <div className="mt-0.5 text-xs text-ink/70">Note: {tab.note}</div>}
        </div>
        <div className="tabular shrink-0 text-right text-xl font-bold text-warn">{fmtMoney(tab.total)}</div>
      </div>

      <ul className="tabular mb-3 space-y-0.5 text-sm">
        {[...items.values()].map((i) => (
          <li key={`${i.name}-${i.total}`} className="flex justify-between text-ink/85">
            <span>
              {i.qty}× {i.name}
              {i.custom && <span className="ml-1 text-xs text-gold">custom</span>}
            </span>
            <span>{fmtMoney(i.total)}</span>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-3 gap-2">
        {canVoid ? (
          <button
            className="btn-ghost py-2 text-sm text-bad"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Void ${tab.customer_name ?? "this"}'s tab? Stock goes back.`)) return;
              start(async () => {
                const res = await voidSale(tab.id);
                if (!res.ok) alert(res.error);
                router.refresh();
              });
            }}
          >
            Void
          </button>
        ) : (
          <span />
        )}
        <button className="btn-gold col-span-2 py-2.5" onClick={() => setPaying(true)} disabled={pending}>
          Collect {fmtMoney(tab.total)}
        </button>
      </div>

      {paying && <PaySheet tab={tab} onClose={() => setPaying(false)} />}
    </div>
  );
}

function PaySheet({ tab, onClose }: { tab: Sale; onClose: () => void }) {
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [tipPct, setTipPct] = useState<number | null>(0);
  const [tipCustom, setTipCustom] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const tip = tipPct === null ? Math.max(0, toNum(Number(tipCustom) || 0)) : toNum((tab.subtotal * tipPct) / 100);
  const total = toNum(tab.subtotal + tip);

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => !pending && onClose()}>
      <div
        className="pb-safe mx-auto w-full max-w-2xl rounded-t-3xl border-t border-line bg-surface px-4 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
        <h2 className="text-lg font-bold">Collect from {tab.customer_name}</h2>
        <p className="tabular mb-4 text-sm text-muted">Tab {fmtMoney(tab.subtotal)}</p>

        <span className="label">Payment</span>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button key={m.key} onClick={() => setPayment(m.key)} className={payment === m.key ? "btn-gold" : "btn-ghost"}>
              {m.label}
            </button>
          ))}
        </div>

        <span className="label">Tip</span>
        <div className="mb-2 grid grid-cols-5 gap-2">
          {TIP_PRESETS.map((pct) => (
            <button key={pct} onClick={() => setTipPct(pct)} className={`${tipPct === pct ? "btn-gold" : "btn-ghost"} px-0`}>
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

        <div className="tabular my-4 flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>{fmtMoney(total)}</span>
        </div>

        {error && <p className="mb-3 rounded-xl bg-bad/15 px-3 py-2 text-sm text-bad">{error}</p>}

        <div className="mb-3 grid grid-cols-3 gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={pending}>
            Back
          </button>
          <button
            className="btn-gold col-span-2 py-3.5 text-base"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError("");
                const res = await payTab({ saleId: tab.id, payment_method: payment, tip });
                if (!res.ok) return setError(res.error);
                onClose();
                router.refresh();
              })
            }
          >
            {pending ? "Saving..." : `Paid ${fmtMoney(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
