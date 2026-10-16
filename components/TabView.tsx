import Link from "next/link";
import { businessDate, fmtDateTime, fmtDay, fmtMoney, fmtTime, toNum } from "@/lib/format";
import { paymentLabel } from "@/lib/config";
import type { Product, Sale, Staff } from "@/lib/types";
import { RemoveItemButton, TabActions } from "@/components/TabsClient";

export function TabView({ tab, staff, products, me }: { tab: Sale; staff: Staff[]; products: Product[]; me: Staff }) {
  const nameById = new Map(staff.map((s) => [s.id, s.name]));
  const today = businessDate();
  const isOpen = tab.status === "open" && !tab.voided;
  const canEdit = me.role === "admin" || tab.staff_id === me.id;
  const menuTotal = toNum(tab.sale_items.reduce((s, i) => s + (i.list_price ?? i.unit_price) * i.qty, 0));
  const discount = toNum(menuTotal - tab.subtotal);
  const count = tab.sale_items.reduce((n, i) => n + i.qty, 0);

  // Group items by the time they were added ("rounds")
  const rounds: { time: string; items: typeof tab.sale_items }[] = [];
  for (const item of tab.sale_items) {
    const time = item.created_at ? fmtTime(item.created_at) : fmtTime(tab.created_at);
    const last = rounds[rounds.length - 1];
    if (last && last.time === time) last.items.push(item);
    else rounds.push({ time, items: [item] });
  }

  return (
    <>
      <Link href="/tabs" className="mb-2 inline-flex items-center gap-1 text-[13px] font-medium text-muted">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        All tabs
      </Link>

      {/* Header */}
      <div className="card mb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">{tab.customer_name || "No name"}</h1>
            <div className="text-[12px] text-muted">
              Opened {tab.business_date === today ? "tonight" : fmtDay(tab.business_date)} at {fmtTime(tab.created_at)} by{" "}
              {nameById.get(tab.staff_id) ?? "Unknown"}
            </div>
            {tab.note && <div className="mt-1 text-[13px] text-ink/80">{tab.note}</div>}
          </div>
          <div className="shrink-0 text-right">
            <div
              className={`tabular text-2xl leading-none font-bold tracking-tight ${
                tab.voided ? "text-muted line-through" : isOpen ? "text-warn" : "text-good"
              }`}
            >
              {fmtMoney(tab.total)}
            </div>
            <div
              className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                tab.voided ? "bg-bad/15 text-bad" : isOpen ? "bg-warn/15 text-warn" : "bg-good/15 text-good"
              }`}
            >
              {tab.voided ? "VOIDED" : isOpen ? "UNPAID" : `PAID · ${paymentLabel(tab.payment_method ?? "")}`}
            </div>
          </div>
        </div>
        {!isOpen && tab.paid_at && !tab.voided && (
          <div className="mt-2 text-[12px] text-muted">
            Paid {fmtDateTime(tab.paid_at)}
            {tab.paid_by ? ` · collected by ${nameById.get(tab.paid_by) ?? "Unknown"}` : ""}
          </div>
        )}
      </div>

      {/* Items */}
      <section className="card mb-3 py-2">
        <div className="flex items-center justify-between py-1">
          <h2 className="text-[13px] font-semibold tracking-wide text-ink/90 uppercase">Items</h2>
          <span className="text-[12px] text-muted">{count} total</span>
        </div>
        {rounds.map((r, idx) => (
          <div key={`${r.time}-${idx}`} className="border-t border-line/70 py-1.5 first:border-0">
            <div className="py-0.5 text-[11px] font-semibold text-muted">
              {idx === 0 ? "Opened" : "Added"} · {r.time}
            </div>
            <ul>
              {r.items.map((i) => {
                const custom = i.list_price != null && i.list_price !== i.unit_price;
                return (
                  <li key={i.id ?? `${i.name}-${i.line_total}`} className="flex items-center gap-2 py-1">
                    <span className="tabular w-7 shrink-0 text-[13px] text-muted">{i.qty}×</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{i.name}</div>
                      <div className="tabular text-[11.5px] text-muted">
                        {fmtMoney(i.unit_price)} each
                        {custom && (
                          <>
                            {" "}
                            <span className="line-through">{fmtMoney(i.list_price!)}</span>{" "}
                            <span className="text-gold">custom</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="tabular shrink-0 text-sm font-semibold">{fmtMoney(i.line_total)}</span>
                    {isOpen && canEdit && i.id && <RemoveItemButton itemId={i.id} label={`${i.qty}× ${i.name}`} />}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="tabular mt-1 space-y-0.5 border-t border-line pt-2 pb-1 text-[13px]">
          {discount !== 0 && (
            <>
              <div className="flex justify-between text-muted">
                <span>Menu price</span>
                <span>{fmtMoney(menuTotal)}</span>
              </div>
              <div className={`flex justify-between ${discount > 0 ? "text-warn" : "text-good"}`}>
                <span>{discount > 0 ? "Discount" : "Extra"}</span>
                <span>
                  {discount > 0 ? "−" : "+"}
                  {fmtMoney(Math.abs(discount))}
                </span>
              </div>
            </>
          )}
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">{isOpen ? "Owed" : "Total"}</span>
            <span className="text-lg font-bold">{fmtMoney(tab.total)}</span>
          </div>
        </div>
      </section>

      {isOpen && <TabActions tab={tab} products={products} canVoid={canEdit} />}
    </>
  );
}
