import { requireStaff } from "@/lib/auth";
import { getProducts, getSales } from "@/lib/data";
import { businessDate, fmtMoney } from "@/lib/format";
import { SellScreen } from "@/components/SellScreen";

export default async function SellPage() {
  const staff = await requireStaff();
  const today = businessDate();
  const [products, mySales] = await Promise.all([
    getProducts({ activeOnly: true }),
    getSales(today, today, { staffId: staff.id }),
  ]);
  const myTotal = mySales.reduce((sum, s) => sum + s.total, 0);

  return (
    <>
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">My sales tonight</div>
          <div className="tabular text-xl font-bold">{fmtMoney(myTotal)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-muted">Orders</div>
          <div className="tabular text-xl font-bold">{mySales.length}</div>
        </div>
      </div>
      <SellScreen products={products} />
    </>
  );
}
