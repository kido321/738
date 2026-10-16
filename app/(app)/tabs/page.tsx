import { requireStaff } from "@/lib/auth";
import { getOpenTabs, getStaffList } from "@/lib/data";
import { businessDate, fmtDay, fmtMoney } from "@/lib/format";
import { PageTitle } from "@/components/ui";
import { TabCard } from "@/components/TabsClient";

export default async function TabsPage() {
  const me = await requireStaff();
  const [tabs, staff] = await Promise.all([getOpenTabs(), getStaffList()]);
  const nameById = new Map(staff.map((s) => [s.id, s.name]));
  const today = businessDate();
  const owed = tabs.reduce((sum, t) => sum + t.total, 0);
  const older = tabs.filter((t) => t.business_date < today);

  return (
    <>
      <PageTitle title="Open Tabs" sub="Orders taken, not paid yet" />

      <div className="mb-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-line bg-surface p-3.5">
          <div className="text-xs uppercase tracking-wide text-muted">Still owed</div>
          <div className={`tabular mt-1 text-xl font-bold ${owed ? "text-warn" : ""}`}>{fmtMoney(owed)}</div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-3.5">
          <div className="text-xs uppercase tracking-wide text-muted">Open tabs</div>
          <div className="tabular mt-1 text-xl font-bold">{tabs.length}</div>
          {older.length > 0 && <div className="text-xs text-bad">{older.length} from past nights</div>}
        </div>
      </div>

      {tabs.length === 0 ? (
        <div className="card text-center">
          <div className="mb-1 text-3xl">✅</div>
          <p className="font-semibold">Everyone paid</p>
          <p className="text-sm text-muted">
            To start a tab, add items on Sell, then pick &ldquo;Tab · pay later&rdquo; at checkout.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tabs.map((t) => (
            <TabCard
              key={t.id}
              tab={t}
              takenBy={nameById.get(t.staff_id) ?? "Unknown"}
              dayLabel={t.business_date === today ? "Tonight" : fmtDay(t.business_date)}
              pastNight={t.business_date < today}
              canVoid={me.role === "admin" || t.staff_id === me.id}
            />
          ))}
        </div>
      )}
    </>
  );
}
