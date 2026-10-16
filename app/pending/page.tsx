import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { checkStaff } from "@/lib/auth";

export default async function PendingPage() {
  const { staff, problem } = await checkStaff();
  if (staff?.active) redirect("/");

  return (
    <main className="pt-safe flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-5xl">{problem ? "⚠️" : "🔒"}</div>
      <h1 className="text-xl font-bold">{problem ? "Setup problem" : "No access yet"}</h1>
      {problem ? (
        <p className="max-w-sm rounded-xl bg-bad/15 px-4 py-3 text-sm text-bad">{problem}</p>
      ) : (
        <p className="max-w-xs text-muted">
          {staff && !staff.active
            ? "Your account was turned off. Ask the admin to turn it back on."
            : "Ask the admin to add your email on the Staff page, then open the app again."}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <Link href="/" prefetch={false} className="btn-gold">
          Try again
        </Link>
        <SignOutButton redirectUrl="/sign-in">
          <button className="btn-ghost">Sign out</button>
        </SignOutButton>
      </div>
    </main>
  );
}
