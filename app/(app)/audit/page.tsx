import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { byMethod, getAudit, getCollected, getProducts, getRecentAudits, getSales, getStaffList, summarize } from "@/lib/data";
import { addDays, businessDate, fmtDateTime, fmtDay, fmtMoney, fmtTime, isDateString } from "@/lib/format";
import { CATEGORIES, paymentLabel } from "@/lib/config";
import { Empty, PageTitle, Section, Stat } from "@/components/ui";
import { CloseDayForm, DatePicker, ReopenButton, VoidButton } from "@/components/AuditControls";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const me = await requireStaff();
  const today = businessDate();
  const { date: raw } = await searchParams;
  const date = isDateString(raw) && raw <= today ? raw : today;

  const [sales, products, staff, audit, recent, collectedSales] = await Promise.all([
    getSales(date, date, { includeVoided: true }),
    getProducts(),
    getStaffList(),
    getAudit(date),
    getRecentAudits(7),
    getCollected(date),
  ]);
  const s = summarize(sales, products, staff);
  const nameById = new Map(staff.map((x) => [x.id, x.name]));
  const collected = byMethod(collectedSales);
  const fromOldTabs = collectedSales.filter((x) => x.business_date !== date);
  const expectedCash = collected.cash;
  const closed = !!audit;

  return (
    <>
      <PageTitle
        title="Day Audit"
        sub={`${fmtDay(date, true)}${date === today ? " · tonight" : ""}`}
        right={<DatePicker value={date} max={today} />}
      />

      <div className="mb-4 flex gap-2">
        <Link href={`/audit?date=${addDays(date, -1)}`} className="btn-ghost flex-1">
          ← Prev day
        </Link>
        <Link
          href={`/audit?date=${addDays(date, 1)}`}
          className={`btn-ghost flex-1 ${date >= today ? "pointer-events-none opacity-40" : ""}`}
        >
          Next day →
        </Link>
      </div>

      <div className={`mb-4 rounded-2xl border p-3.5 ${closed ? "border-good/40 bg-good/10" : "border-line bg-surface"}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`font-semibold ${closed ? "text-good" : ""}`}>{closed ? "Day closed" : "Day still open"}</div>
            {audit && (
              <div className="text-xs text-muted">
                By {nameById.get(audit.closed_by ?? "") ?? "Unknown"} · {fmtDateTime(audit.closed_at)}
              </div>
            )}
          </div>
          {closed && me.role === "admin" && <ReopenButton date={date} />}
        </div>
        {audit && (
          <div className="tabular mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="text-xs text-muted">Expected</div>
              <div className="font-semibold">{fmtMoney(audit.expected_cash)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Counted</div>
              <div className="font-semibold">{fmtMoney(audit.counted_cash)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Difference</div>
              <div className={`font-semibold ${audit.difference === 0 ? "text-good" : audit.difference > 0 ? "text-warn" : "text-bad"}`}>
                {audit.difference > 0 ? "+" : ""}
                {fmtMoney(audit.difference)}
              </div>
            </div>
          </div>
        )}
        {audit?.notes && <p className="mt-2 text-sm text-ink/80">“{audit.notes}”</p>}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5">
        <Stat label="Total sales" value={fmtMoney(s.revenue)} tone="gold" />
        <Stat label="Orders" value={String(s.count)} />
        <Stat label="Paid" value={fmtMoney(s.collected)} tone="good" />
        <Stat label={`Unpaid tabs (${s.openCount})`} value={fmtMoney(s.unpaid)} tone={s.unpaid ? "bad" : undefined} />
        <Stat label="Discounts" value={fmtMoney(s.discounts)} />
        <Stat label="Tips" value={fmtMoney(s.tips)} />
      </div>

      <Section title="Money collected this day">
        <div className="tabular grid grid-cols-3 gap-2 text-center">
          {[
            ["Cash", collected.cash],
            ["Card", collected.card],
            ["Other", collected.other],
          ].map(([label, v]) => (
            <div key={label as string} className="rounded-xl bg-surface-2 p-2.5">
              <div className="text-xs text-muted">{label}</div>
              <div className="font-bold">{fmtMoney(v as number)}</div>
            </div>
          ))}
        </div>
        {fromOldTabs.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            Includes {fmtMoney(fromOldTabs.reduce((a, x) => a + x.total, 0))} from {fromOldTabs.length} tab
            {fromOldTabs.length === 1 ? "" : "s"} opened on an earlier night.
          </p>
        )}
      </Section>

      <Section title="Each person's sales">
        {s.byStaff.length === 0 ? (
          <Empty>No sales this day.</Empty>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="tabular w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="px-1 pb-2 font-medium">Name</th>
                  <th className="px-1 pb-2 text-right font-medium">Orders</th>
                  <th className="px-1 pb-2 text-right font-medium">Paid</th>
                  <th className="px-1 pb-2 text-right font-medium">Unpaid</th>
                  <th className="px-1 pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {s.byStaff.map((x) => (
                  <tr key={x.id}>
                    <td className="px-1 py-2 font-medium">{x.name}</td>
                    <td className="px-1 py-2 text-right">{x.count}</td>
                    <td className="px-1 py-2 text-right">{fmtMoney(x.paid)}</td>
                    <td className={`px-1 py-2 text-right ${x.unpaid ? "text-warn" : ""}`}>{fmtMoney(x.unpaid)}</td>
                    <td className="px-1 py-2 text-right font-semibold">{fmtMoney(x.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Items sold">
        {s.topItems.length === 0 ? (
          <Empty>Nothing sold.</Empty>
        ) : (
          CATEGORIES.map((c) => {
            const items = s.topItems.filter((i) => i.category === c.key);
            if (items.length === 0) return null;
            return (
              <div key={c.key} className="mb-3 last:mb-0">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gold">{c.label}</div>
                <ul className="tabular divide-y divide-line text-sm">
                  {items.map((i) => (
                    <li key={`${i.category}|${i.name}`} className="flex justify-between py-1.5">
                      <span>
                        {i.name} <span className="text-muted">× {i.qty}</span>
                      </span>
                      <span className="font-semibold">{fmtMoney(i.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </Section>

      <Section title={closed ? "Cash count" : "Close the day"}>
        {s.openCount > 0 && (
          <Link href="/tabs" className="mb-3 block rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn">
            {s.openCount} tab{s.openCount === 1 ? " is" : "s are"} still unpaid ({fmtMoney(s.unpaid)}). That money is not in
            the drawer yet. Tap to collect.
          </Link>
        )}
        <CloseDayForm date={date} expectedCash={expectedCash} closed={closed} />
      </Section>

      <Section title={`All sales (${sales.length})`}>
        {sales.length === 0 ? (
          <Empty>No sales this day.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {sales.map((sale) => {
              const canVoid = !sale.voided && (me.role === "admin" || (sale.staff_id === me.id && !closed));
              return (
                <li key={sale.id} className={`py-3 ${sale.voided ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">
                        {fmtTime(sale.created_at)} · {nameById.get(sale.staff_id) ?? "Unknown"}
                        {sale.status === "open" ? (
                          <span className="ml-2 rounded-md bg-warn/20 px-1.5 py-0.5 text-[11px] font-semibold text-warn">
                            UNPAID TAB
                          </span>
                        ) : (
                          <span className="ml-2 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
                            {paymentLabel(sale.payment_method ?? "")}
                          </span>
                        )}
                        {sale.voided && (
                          <span className="ml-1 rounded-md bg-bad/20 px-1.5 py-0.5 text-[11px] font-medium text-bad">VOID</span>
                        )}
                      </div>
                      {sale.customer_name && <div className="text-sm font-medium text-ink/90">{sale.customer_name}</div>}
                      <div className="mt-0.5 text-sm text-muted">
                        {sale.sale_items
                          .map(
                            (i) =>
                              `${i.qty}× ${i.name}${
                                i.list_price != null && i.list_price !== i.unit_price ? ` @ ${fmtMoney(i.unit_price)}` : ""
                              }`
                          )
                          .join(", ")}
                      </div>
                      {sale.status === "paid" &&
                        sale.paid_at &&
                        new Date(sale.paid_at).getTime() - new Date(sale.created_at).getTime() > 60_000 && (
                          <div className="mt-0.5 text-xs text-good">Tab paid · {fmtDateTime(sale.paid_at)}</div>
                        )}
                      {sale.note && <div className="mt-0.5 text-xs text-ink/70">Note: {sale.note}</div>}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`tabular font-bold ${sale.voided ? "line-through" : ""}`}>{fmtMoney(sale.total)}</div>
                      {sale.tip > 0 && <div className="tabular text-[11px] text-muted">tip {fmtMoney(sale.tip)}</div>}
                      {canVoid && (
                        <div className="mt-1">
                          <VoidButton saleId={sale.id} />
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {recent.length > 0 && (
        <Section title="Recent closed days">
          <ul className="tabular divide-y divide-line text-sm">
            {recent.map((a) => (
              <li key={a.business_date}>
                <Link href={`/audit?date=${a.business_date}`} className="flex justify-between py-2">
                  <span>{fmtDay(a.business_date)}</span>
                  <span className={a.difference === 0 ? "text-good" : a.difference > 0 ? "text-warn" : "text-bad"}>
                    {a.difference === 0 ? "Matched" : `${a.difference > 0 ? "+" : ""}${fmtMoney(a.difference)}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
