import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "./supabase";
import type { Staff } from "./types";

export type StaffCheck = { staff: Staff | null; problem: string | null };

function dbProblem(error: { message?: string; code?: string } | null) {
  if (!error) return null;
  const msg = error.message ?? "Unknown database error";
  if (error.code === "42P01" || /relation .*staff.* does not exist|Could not find the table/i.test(msg)) {
    return "The database tables are missing. Run supabase/schema.sql in the Supabase SQL Editor.";
  }
  if (error.code === "42501" || /row-level security|permission denied/i.test(msg)) {
    return "Supabase blocked the request. SUPABASE_SECRET_KEY must be the Secret key (sb_secret_...) or the service_role key, not the publishable or anon key.";
  }
  if (/Invalid API key|JWT|apikey/i.test(msg)) {
    return "Supabase did not accept the key. Check SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local, then restart npm run dev.";
  }
  return `Database error: ${msg}`;
}

// Finds the staff row for the signed-in Clerk user.
// - Already linked: match by Clerk user id.
// - Added by an admin: match by email, then link the Clerk id.
// - Very first person to sign in: becomes the admin.
// - Anyone else: no access (sent to /pending).
export const checkStaff = cache(async (): Promise<StaffCheck> => {
  const { userId } = await auth();
  if (!userId) return { staff: null, problem: null };

  let sb;
  try {
    sb = db();
  } catch (e) {
    return { staff: null, problem: (e as Error).message };
  }

  const linked = await sb.from("staff").select("*").eq("clerk_user_id", userId).maybeSingle();
  if (linked.error) return { staff: null, problem: dbProblem(linked.error) };
  if (linked.data) return { staff: linked.data as Staff, problem: null };

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) {
    return { staff: null, problem: "Your account has no email. Sign out and sign in with an email address." };
  }

  const invited = await sb.from("staff").select("*").eq("email", email).maybeSingle();
  if (invited.error) return { staff: null, problem: dbProblem(invited.error) };

  if (invited.data) {
    if (invited.data.clerk_user_id && invited.data.clerk_user_id !== userId) {
      return {
        staff: null,
        problem: `The email ${email} is already linked to a different login. Ask the admin to fix it in Supabase.`,
      };
    }
    const updated = await sb
      .from("staff")
      .update({ clerk_user_id: userId })
      .eq("id", invited.data.id)
      .select("*")
      .single();
    if (updated.error) return { staff: null, problem: dbProblem(updated.error) };
    return { staff: updated.data as Staff, problem: null };
  }

  const counted = await sb.from("staff").select("id", { count: "exact", head: true });
  if (counted.error) return { staff: null, problem: dbProblem(counted.error) };

  if (counted.count === 0) {
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || email.split("@")[0];
    const owner = await sb
      .from("staff")
      .insert({ clerk_user_id: userId, email, name, role: "admin" })
      .select("*")
      .single();
    if (owner.error) return { staff: null, problem: dbProblem(owner.error) };
    return { staff: owner.data as Staff, problem: null };
  }

  return { staff: null, problem: null };
});

export async function getStaff(): Promise<Staff | null> {
  return (await checkStaff()).staff;
}

export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) {
    const { userId } = await auth();
    redirect(userId ? "/pending" : "/sign-in");
  }
  if (!staff.active) redirect("/pending");
  return staff;
}

export async function requireAdmin(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== "admin") throw new Error("Only an admin can do this.");
  return staff;
}
