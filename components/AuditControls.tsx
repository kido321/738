"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeDay, reopenDay, voidSale } from "@/app/actions";
import { fmtMoney, toNum } from "@/lib/format";

export function DatePicker({ value, max }: { value: string; max: string }) {
  const router = useRouter();
  return (
    <input
      type="date"
      className="field w-auto py-2"
      value={value}
      max={max}
      onChange={(e) => e.target.value && router.push(`/audit?date=${e.target.value}`)}
    />
  );
}

export function CloseDayForm({ date, expectedCash, closed }: { date: string; expectedCash: number; closed: boolean }) {
  const router = useRouter();
  const [counted, setCounted] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const diff = counted === "" ? null : toNum(Number(counted) - expectedCash);

  return (
    <form
      action={(form) => {
        setError("");
        start(async () => {
          const res = await closeDay(form);
          if (!res.ok) setError(res.error);
          else {
            setCounted("");
            router.refresh();
          }
        });
      }}
      className="space-y-3"
    >
      <input type="hidden" name="date" value={date} />
      <div className="flex justify-between text-sm">
        <span className="text-muted">Cash expected in drawer</span>
        <span className="tabular font-semibold">{fmtMoney(expectedCash)}</span>
      </div>
      <div>
        <label className="label" htmlFor="counted_cash">
          Cash counted
        </label>
        <input
          id="counted_cash"
          name="counted_cash"
          className="field"
          inputMode="decimal"
          placeholder="0.00"
          required
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
        />
      </div>
      {diff !== null && (
        <div className={`tabular text-sm font-semibold ${diff === 0 ? "text-good" : diff > 0 ? "text-warn" : "text-bad"}`}>
          {diff === 0 ? "Drawer matches" : diff > 0 ? `Over by ${fmtMoney(diff)}` : `Short by ${fmtMoney(-diff)}`}
        </div>
      )}
      <div>
        <label className="label" htmlFor="notes">
          Notes
        </label>
        <textarea id="notes" name="notes" rows={2} className="field" placeholder="Anything to remember about tonight" />
      </div>
      {error && <p className="rounded-xl bg-bad/15 px-3 py-2 text-sm text-bad">{error}</p>}
      <button className="btn-gold w-full py-3" disabled={pending}>
        {pending ? "Saving..." : closed ? "Update count" : "Close the day"}
      </button>
    </form>
  );
}

export function ReopenButton({ date }: { date: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="text-sm font-semibold text-gold"
      disabled={pending}
      onClick={() => {
        if (!confirm("Reopen this day? The cash count will be removed.")) return;
        start(async () => {
          const res = await reopenDay(date);
          if (!res.ok) alert(res.error);
          router.refresh();
        });
      }}
    >
      {pending ? "..." : "Reopen"}
    </button>
  );
}

export function VoidButton({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="rounded-lg border border-bad/40 px-2.5 py-1 text-xs font-semibold text-bad"
      disabled={pending}
      onClick={() => {
        if (!confirm("Void this sale? Stock will be put back.")) return;
        start(async () => {
          const res = await voidSale(saleId);
          if (!res.ok) alert(res.error);
          router.refresh();
        });
      }}
    >
      {pending ? "..." : "Void"}
    </button>
  );
}
