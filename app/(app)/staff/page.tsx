import { requireStaff } from "@/lib/auth";
import { getProducts, getSales, getStaffList, summarize } from "@/lib/data";
import { addDays, businessDate, fmtMoney } from "@/lib/format";
import { PageTitle, Section } from "@/components/ui";
import { AddStaffForm, StaffActions } from "@/components/StaffClient";

export default async function StaffPage() {
  const me = await requireStaff();
  const today = businessDate();
  const [staff, products, week] = await Promise.all([
    getStaffList(),
    getProducts(),
    getSales(addDays(today, -6), today),
  ]);
  const tonight = summarize(
    week.filter((s) => s.business_date === today),
    products,
    staff
  );
  const weekSum = summarize(week, products, staff);
  const tonightBy = new Map(tonight.byStaff.map((x) => [x.id, x]));
  const weekBy = new Map(weekSum.byStaff.map((x) => [x.id, x]));
  const isAdmin = me.role === "admin";

  return (
    <>
      <PageTitle title="Staff" sub={`${staff.filter((s) => s.active).length} active`} />

      <div className="space-y-3">
        {staff.map((s) => {
          const t = tonightBy.get(s.id);
          const w = weekBy.get(s.id);
          return (
            <div key={s.id} className={`card ${s.active ? "" : "opacity-60"}`}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/15 font-bold text-gold">
                    {s.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {s.name}
                      {s.id === me.id && <span className="text-muted"> (you)</span>}
                    </div>
                    <div className="truncate text-xs text-muted">{s.email}</div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                      s.role === "admin" ? "bg-gold/20 text-gold" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {s.role === "admin" ? "Admin" : "Staff"}
                  </span>
                  {!s.active && <span className="text-[11px] text-bad">Turned off</span>}
                  {s.active && !s.clerk_user_id && <span className="text-[11px] text-warn">Not signed in yet</span>}
                </div>
              </div>
              <div className="tabular grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-surface-2 p-2">
                  <div className="text-[11px] text-muted">Tonight</div>
                  <div className="font-bold">{fmtMoney(t?.total ?? 0)}</div>
                  <div className="text-[11px] text-muted">{t?.count ?? 0} orders</div>
                </div>
                <div className="rounded-xl bg-surface-2 p-2">
                  <div className="text-[11px] text-muted">7 days</div>
                  <div className="font-bold">{fmtMoney(w?.total ?? 0)}</div>
                  <div className="text-[11px] text-muted">{w?.count ?? 0} orders</div>
                </div>
                <div className="rounded-xl bg-surface-2 p-2">
                  <div className="text-[11px] text-muted">Unpaid tabs</div>
                  <div className={`font-bold ${w?.unpaid ? "text-warn" : ""}`}>{fmtMoney(w?.unpaid ?? 0)}</div>
                  <div className="text-[11px] text-muted">avg {fmtMoney(w && w.count ? w.total / w.count : 0)}</div>
                </div>
              </div>
              {isAdmin && s.id !== me.id && <StaffActions id={s.id} role={s.role} active={s.active} />}
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <div className="mt-4">
          <Section title="Add a person">
            <p className="mb-3 text-sm text-muted">
              Add their email here. Then they open the app, sign up with that same email, and they are in.
            </p>
            <AddStaffForm />
          </Section>
        </div>
      )}
    </>
  );
}
