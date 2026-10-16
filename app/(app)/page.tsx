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
      <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface">
        <div className="px-3 py-2">
          <div className="text-[11px] font-medium text-muted">My sales tonight</div>
          <div className="tabular text-base leading-tight font-bold">
            {fmtMoney(myTotal)} <span className="text-[11px] font-medium text-muted">· {mySales.length}</span>
          </div>
        </div>
        <Link href="/tabs" className="border-l border-line px-3 py-2 active:bg-surface-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-muted">
            Open tabs <span aria-hidden>›</span>
          </div>
          <div className={`tabular text-base leading-tight font-bold ${openTabs.length ? "text-warn" : ""}`}>
            {fmtMoney(owed)} <span className="text-[11px] font-medium text-muted">· {openTabs.length}</span>
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
