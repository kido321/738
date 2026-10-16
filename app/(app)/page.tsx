import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getOpenTabs, getProducts, getSales } from "@/lib/data";
import { businessDate, fmtMoney } from "@/lib/format";
import { SellScreen } from "@/components/SellScreen";

export default async function SellPage() {
  const staff = await requireStaff();
  const today = businessDate();
  const [products, mySales, openTabs] = await Promise.all([
    getProducts({ activeOnly: true }),
    getSales(today, today, { staffId: staff.id }),
    getOpenTabs(),
  ]);
  const myTotal = mySales.reduce((sum, s) => sum + s.total, 0);
  const owed = openTabs.reduce((sum, s) => sum + s.total, 0);

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-muted">My sales tonight</div>
          <div className="tabular text-xl font-bold">{fmtMoney(myTotal)}</div>
          <div className="text-xs text-muted">{mySales.length} orders</div>
        </div>
        <Link
          href="/tabs"
          className={`rounded-2xl border px-4 py-3 ${
            openTabs.length ? "border-warn/40 bg-warn/10" : "border-line bg-surface"
          }`}
        >
          <div className="text-xs uppercase tracking-wide text-muted">Open tabs</div>
          <div className={`tabular text-xl font-bold ${openTabs.length ? "text-warn" : ""}`}>{fmtMoney(owed)}</div>
          <div className="text-xs text-muted">
            {openTabs.length} unpaid {openTabs.length ? "→" : ""}
          </div>
        </Link>
      </div>
      <SellScreen
        products={products}
        openTabs={openTabs.map((t) => ({ id: t.id, customer_name: t.customer_name, total: t.total }))}
      />
    </>
  );
}
