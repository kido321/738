import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getOpenTabs, getStaffList } from "@/lib/data";
import { businessDate, fmtDay, fmtMoney, fmtTime } from "@/lib/format";
import { PageTitle, Stat, StatGrid } from "@/components/ui";

export default async function TabsPage() {
  await requireStaff();
  const [tabs, staff] = await Promise.all([getOpenTabs(), getStaffList()]);
  const nameById = new Map(staff.map((s) => [s.id, s.name]));
  const today = businessDate();
  const owed = tabs.reduce((sum, t) => sum + t.total, 0);
  const older = tabs.filter((t) => t.business_date < today);

  return (
    <>
      <PageTitle title="Open tabs" sub="Tap a person to see their tab" />

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
          <p className="text-[13px] text-muted">To start a tab, add items on Sell and pick &ldquo;Tab · pay later&rdquo;.</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-line bg-surface">
          {tabs.map((t) => {
            const past = t.business_date < today;
            const count = t.sale_items.reduce((n, i) => n + i.qty, 0);
            return (
              <li key={t.id} className="border-b border-line/70 last:border-0">
                <Link href={`/tabs/${t.id}`} className="flex items-center gap-3 px-3 py-2.5 active:bg-surface-2">
                  <div
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      past ? "bg-bad/15 text-bad" : "bg-warn/15 text-warn"
                    }`}
                  >
                    {(t.customer_name ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">{t.customer_name || "No name"}</div>
                    <div className="truncate text-[11.5px] text-muted">
                      <span className={past ? "font-semibold text-bad" : ""}>
                        {past ? fmtDay(t.business_date) : "Tonight"}
                      </span>{" "}
                      · {fmtTime(t.created_at)} · {count} item{count === 1 ? "" : "s"} · {nameById.get(t.staff_id) ?? "Unknown"}
                    </div>
                  </div>
                  <div className="tabular shrink-0 text-base font-bold text-warn">{fmtMoney(t.total)}</div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
