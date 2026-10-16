import { requireStaff } from "@/lib/auth";
import { getOpenTabs, getProducts, getStaffList } from "@/lib/data";
import { businessDate, fmtDay, fmtMoney } from "@/lib/format";
import { PageTitle, Stat, StatGrid } from "@/components/ui";
import { TabCard } from "@/components/TabsClient";

export default async function TabsPage() {
  const me = await requireStaff();
  const [tabs, staff, products] = await Promise.all([getOpenTabs(), getStaffList(), getProducts({ activeOnly: true })]);
  const nameById = new Map(staff.map((s) => [s.id, s.name]));
  const today = businessDate();
  const owed = tabs.reduce((sum, t) => sum + t.total, 0);
  const older = tabs.filter((t) => t.business_date < today);

  return (
    <>
      <PageTitle title="Open tabs" sub="Taken, not paid yet" />

      <StatGrid>
        <Stat label="Still owed" value={fmtMoney(owed)} tone={owed ? "warn" : undefined} />
        <Stat
          label="Open tabs"
          value={String(tabs.length)}
          sub={older.length ? `${older.length} from past nights` : undefined}
          tone={older.length ? "bad" : undefined}
        />
      </StatGrid>

      {tabs.length === 0 ? (
        <div className="card py-6 text-center">
          <div className="mb-1 text-2xl">✓</div>
          <p className="font-semibold">Everyone paid</p>
          <p className="text-[13px] text-muted">To start a tab, add items on Sell and pick a tab at checkout.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tabs.map((t) => (
            <TabCard
              key={t.id}
              tab={t}
              products={products}
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
