"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addStaff, updateStaff } from "@/app/actions";

export function AddStaffForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      ref={formRef}
      className="space-y-3"
      action={(form) => {
        setError("");
        setDone("");
        start(async () => {
          const res = await addStaff(form);
          if (!res.ok) return setError(res.error);
          setDone(`${form.get("name")} was added.`);
          formRef.current?.reset();
          router.refresh();
        });
      }}
    >
      <input name="name" className="field" placeholder="Name" required maxLength={60} />
      <input name="email" type="email" className="field" placeholder="Email" required autoCapitalize="none" autoCorrect="off" />
      <select name="role" className="field" defaultValue="staff">
        <option value="staff">Staff (can sell, restock, close day)</option>
        <option value="admin">Admin (can do everything)</option>
      </select>
      {error && <p className="rounded-xl bg-bad/15 px-3 py-2 text-sm text-bad">{error}</p>}
      {done && <p className="rounded-xl bg-good/15 px-3 py-2 text-sm text-good">{done}</p>}
      <button className="btn-gold w-full" disabled={pending}>
        {pending ? "Adding..." : "Add person"}
      </button>
    </form>
  );
}

export function StaffActions({ id, role, active }: { id: string; role: "admin" | "staff"; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(patch: { role?: "admin" | "staff"; active?: boolean }, question: string) {
    if (!confirm(question)) return;
    start(async () => {
      const res = await updateStaff(id, patch);
      if (!res.ok) alert(res.error);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button
        className="btn-ghost py-2 text-sm"
        disabled={pending}
        onClick={() =>
          run(
            { role: role === "admin" ? "staff" : "admin" },
            role === "admin" ? "Make this person regular staff?" : "Make this person an admin?"
          )
        }
      >
        {role === "admin" ? "Make staff" : "Make admin"}
      </button>
      <button
        className={`btn-ghost py-2 text-sm ${active ? "text-bad" : "text-good"}`}
        disabled={pending}
        onClick={() =>
          run(
            { active: !active },
            active ? "Turn off this person? They won't be able to use the app." : "Turn this person back on?"
          )
        }
      >
        {active ? "Turn off" : "Turn on"}
      </button>
    </div>
  );
}
