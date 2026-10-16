import Link from "next/link";

export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="truncate text-[13px] text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Stat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "gold" | "warn";
  sub?: string;
}) {
  const color =
    tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "gold" ? "text-gold" : tone === "warn" ? "text-warn" : "";
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className="truncate text-[11px] font-medium text-muted">{label}</div>
      <div className={`tabular text-lg leading-tight font-bold tracking-tight ${color}`}>{value}</div>
      {sub && <div className="truncate text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

export function StatGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 }) {
  return <div className={`mb-3 grid gap-2 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>{children}</div>;
}

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="card mb-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold tracking-wide text-ink/90 uppercase">{title}</h2>
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
    <div className="py-1">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
        <span className="truncate font-medium">
          {label}
          {sub && <span className="ml-1.5 text-[11px] text-muted">{sub}</span>}
        </span>
        <span className="tabular shrink-0 font-semibold">{right}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Pills({ items, active }: { items: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <div className="no-scrollbar -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4">
      {items.map((i) => (
        <Link key={i.key} href={i.href} className={active === i.key ? "chip-on" : "chip"}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-1.5 text-[13px] text-muted">{children}</p>;
}

// Bottom sheet used for checkout, tabs and forms.
export function Sheet({
  children,
  onClose,
  locked,
}: {
  children: React.ReactNode;
  onClose: () => void;
  locked?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/70 backdrop-blur-[2px]" onClick={() => !locked && onClose()}>
      <div
        className="sheet-in pb-safe mx-auto max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border-t border-line bg-surface px-4 pt-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-surface-3" />
        {children}
      </div>
    </div>
  );
}
