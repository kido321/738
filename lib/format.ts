// Shared helpers that work on both server and phone.

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function fmtMoney(n: number | string | null | undefined) {
  return money.format(Number(n ?? 0));
}

export function toNum(n: number | string | null | undefined) {
  return Math.round(Number(n ?? 0) * 100) / 100;
}

export function timeZone() {
  return process.env.NEXT_PUBLIC_TIMEZONE || "America/Los_Angeles";
}

export function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone(),
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone(),
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

// "2026-10-15" -> "Thu, Oct 15"
export function fmtDay(date: string, long = false) {
  const d = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(long ? { year: "numeric" } : {}),
  }).format(d);
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// A party night runs past midnight, so the "business day" starts at
// BUSINESS_DAY_START_HOUR (default 11 AM). A sale at 2 AM Saturday counts
// for Friday night.
export function businessDate(at: Date = new Date()) {
  const startHour = Number(process.env.NEXT_PUBLIC_BUSINESS_DAY_START_HOUR ?? 11);
  const shifted = new Date(at.getTime() - startHour * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

export function isDateString(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
