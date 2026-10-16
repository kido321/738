"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Sell", icon: SellIcon },
  { href: "/dashboard", label: "Dashboard", icon: ChartIcon },
  { href: "/audit", label: "Audit", icon: AuditIcon },
  { href: "/inventory", label: "Inventory", icon: BoxIcon },
  { href: "/staff", label: "Staff", icon: StaffIcon },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur">
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {tabs.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium ${
                  active ? "text-gold" : "text-muted"
                }`}
              >
                <Icon />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const svg = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function SellIcon() {
  return (
    <svg {...svg}>
      <path d="M8 3h8l-1 6a3 3 0 0 1-6 0L8 3Z" />
      <path d="M12 12v8M8 21h8" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg {...svg}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}
function AuditIcon() {
  return (
    <svg {...svg}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}
function BoxIcon() {
  return (
    <svg {...svg}>
      <path d="M3 7l9-4 9 4-9 4-9-4Z" />
      <path d="M3 7v10l9 4 9-4V7M12 11v10" />
    </svg>
  );
}
function StaffIcon() {
  return (
    <svg {...svg}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M17 14.5a5 5 0 0 1 4.5 5" />
    </svg>
  );
}
