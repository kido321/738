import Link from "next/link";

export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "gold" }) {
  const color = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "gold" ? "text-gold" : "";
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`tabular mt-1 text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="card mb-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

// Horizontal bar row: label, bar, value
export function BarRow({ label, value, max, right, sub }: { label: string; value: number; max: number; right: string; sub?: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate font-medium">
          {label}
          {sub && <span className="ml-1.5 text-xs text-muted">{sub}</span>}
        </span>
        <span className="tabular shrink-0 font-semibold">{right}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Pills({ items, active }: { items: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
            active === i.key ? "bg-gold text-gold-ink" : "border border-line bg-surface"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-muted">{children}</p>;
}
