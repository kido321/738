import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { dayRange, getProducts, getSales, getStaffList, summarize } from "@/lib/data";
import { addDays, businessDate, fmtDay, fmtMoney } from "@/lib/format";
import { CATEGORIES, PAYMENT_METHODS } from "@/lib/config";
import { BarRow, Empty, PageTitle, Pills, Section, Stat } from "@/components/ui";

const RANGES = [
  { key: "today", label: "Tonight" },
  { key: "yesterday", label: "Last night" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireStaff();
  const { range: rawRange } = await searchParams;
  const range = RANGES.some((r) => r.key === rawRange) ? rawRange! : "today";

  const today = businessDate();
  let start = today;
  let end = today;
  if (range === "yesterday") start = end = addDays(today, -1);
  if (range === "7d") start = addDays(today, -6);
  if (range === "30d") start = addDays(today, -29);

  const [sales, products, staff] = await Promise.all([getSales(start, end), getProducts(), getStaffList()]);
  const s = summarize(sales, products, staff);
  const lowStock = products.filter((p) => p.active && p.track_stock && p.stock <= p.low_stock_at);
  const multiDay = start !== end;
  const days = multiDay ? dayRange(start, end) : [];
  const maxDay = Math.max(0, ...days.map((d) => s.byDay.get(d) ?? 0));
  const maxStaff = Math.max(0, ...s.byStaff.map((x) => x.total));
  const maxCat = Math.max(0, ...[...s.byCategory.values()].map((x) => x.total));
  const topItems = s.topItems.slice(0, 8);
  const maxItem = Math.max(0, ...topItems.map((x) => x.total));

  return (
    <>
      <PageTitle title="Stats" sub={multiDay ? `${fmtDay(start)} – ${fmtDay(end)}` : fmtDay(start, true)} />
      <Pills items={RANGES.map((r) => ({ ...r, href: `/dashboard?range=${r.key}` }))} active={range} />

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Stat label="Total sales" value={fmtMoney(s.revenue)} tone="gold" />
        <Stat label="Orders" value={String(s.count)} />
        <Stat label="Paid" value={fmtMoney(s.collected)} tone="good" />
        <Stat label={`Unpaid tabs (${s.openCount})`} value={fmtMoney(s.unpaid)} tone={s.unpaid ? "bad" : undefined} />
        <Stat label="Avg order" value={fmtMoney(s.avg)} />
        <Stat label="Discounts given" value={fmtMoney(s.discounts)} />
        <Stat label="Voided" value={String(s.voidedCount)} tone={s.voidedCount ? "bad" : undefined} />
        <Stat label="Est. profit" value={fmtMoney(s.estProfit)} tone={s.estProfit >= 0 ? "good" : "bad"} />
      </div>

      {lowStock.length > 0 && (
        <Link href="/inventory" className="mb-3 block rounded-xl border border-warn/40 bg-warn/10 p-3.5">
          <div className="mb-1 text-sm font-semibold text-warn">Low stock ({lowStock.length})</div>
          <div className="text-sm text-ink/80">
            {lowStock
              .slice(0, 6)
              .map((p) => `${p.name} (${p.stock})`)
              .join(" · ")}
            {lowStock.length > 6 ? " ..." : ""}
          </div>
        </Link>
      )}

      {multiDay && (
        <Section title="Sales by day">
          <div className="flex h-36 items-end gap-1">
            {days.map((d) => {
              const v = s.byDay.get(d) ?? 0;
              const h = maxDay > 0 ? Math.max(v > 0 ? 4 : 1, (v / maxDay) * 100) : 1;
              return (
                <div key={d} className="flex h-full flex-1 flex-col justify-end" title={`${fmtDay(d)}: ${fmtMoney(v)}`}>
                  <div className={`rounded-t ${v > 0 ? "bg-gold" : "bg-surface-2"}`} style={{ height: `${h}%` }} />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted">
            <span>{fmtDay(start)}</span>
            <span>Best: {fmtMoney(maxDay)}</span>
            <span>{fmtDay(end)}</span>
          </div>
        </Section>
      )}

      <Section title="Sales by staff">
        {s.byStaff.length === 0 ? (
          <Empty>No sales yet.</Empty>
        ) : (
          s.byStaff.map((x) => (
            <BarRow key={x.id} label={x.name} sub={`${x.count} orders${x.unpaid ? ` · ${fmtMoney(x.unpaid)} unpaid` : ""}`} value={x.total} max={maxStaff} right={fmtMoney(x.total)} />
          ))
        )}
      </Section>

      <Section title="By category">
        {s.byCategory.size === 0 ? (
          <Empty>No sales yet.</Empty>
        ) : (
          CATEGORIES.filter((c) => s.byCategory.has(c.key)).map((c) => {
            const v = s.byCategory.get(c.key)!;
            return <BarRow key={c.key} label={c.label} sub={`${v.qty} sold`} value={v.total} max={maxCat} right={fmtMoney(v.total)} />;
          })
        )}
      </Section>

      <Section title="Top items">
        {topItems.length === 0 ? (
          <Empty>No sales yet.</Empty>
        ) : (
          topItems.map((x) => <BarRow key={`${x.category}|${x.name}`} label={x.name} sub={`× ${x.qty}`} value={x.total} max={maxItem} right={fmtMoney(x.total)} />)
        )}
      </Section>

      <Section title="Paid by">
        <div className="grid grid-cols-3 gap-2 text-center">
          {PAYMENT_METHODS.map((m) => {
            const v = s.byPayment.get(m.key);
            return (
              <div key={m.key} className="rounded-xl bg-surface-2 p-2.5">
                <div className="text-xs text-muted">{m.label}</div>
                <div className="tabular font-bold">{fmtMoney(v?.total ?? 0)}</div>
                <div className="text-[11px] text-muted">{v?.count ?? 0} orders</div>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
