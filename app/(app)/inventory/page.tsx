import { requireStaff } from "@/lib/auth";
import { getMovements, getProducts, getStaffList } from "@/lib/data";
import { fmtDateTime, fmtMoney } from "@/lib/format";
import { PageTitle, Section, Stat, Empty } from "@/components/ui";
import { InventoryClient } from "@/components/InventoryClient";

export default async function InventoryPage() {
  const me = await requireStaff();
  const [products, movements, staff] = await Promise.all([getProducts(), getMovements(25), getStaffList()]);
  const nameById = new Map(staff.map((s) => [s.id, s.name]));
  const productName = new Map(products.map((p) => [p.id, p.name]));

  const tracked = products.filter((p) => p.active && p.track_stock);
  const low = tracked.filter((p) => p.stock <= p.low_stock_at);
  const stockValue = tracked.reduce((sum, p) => sum + Math.max(0, p.stock) * p.cost, 0);

  return (
    <>
      <PageTitle title="Inventory" sub={`${products.filter((p) => p.active).length} items on the menu`} />

      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <Stat label="Tracked" value={String(tracked.length)} />
        <Stat label="Low" value={String(low.length)} tone={low.length ? "bad" : "good"} />
        <Stat label="Stock cost" value={fmtMoney(stockValue)} />
      </div>

      <InventoryClient products={products} isAdmin={me.role === "admin"} />

      <Section title="Stock history">
        {movements.length === 0 ? (
          <Empty>No restocks or counts yet.</Empty>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {movements.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="font-medium">{productName.get(m.product_id) ?? "Deleted item"}</div>
                  <div className="text-xs text-muted">
                    {m.reason === "restock" ? "Restock" : m.reason === "void" ? "Voided sale" : "Count fix"} ·{" "}
                    {nameById.get(m.staff_id ?? "") ?? "Unknown"} · {fmtDateTime(m.created_at)}
                    {m.note && m.reason !== "void" ? ` · ${m.note}` : ""}
                  </div>
                </div>
                <span className={`tabular shrink-0 font-semibold ${m.change > 0 ? "text-good" : "text-bad"}`}>
                  {m.change > 0 ? "+" : ""}
                  {m.change}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
