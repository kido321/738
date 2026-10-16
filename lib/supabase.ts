import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Legacy keys are JWTs. Read the role inside so we can catch the anon key.
function legacyRole(key: string) {
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
    return payload.role as string | undefined;
  } catch {
    return undefined;
  }
}

// Server-only client. Uses the secret key, so it must never reach the phone.
// Every page and action checks the Clerk user before calling this.
export function db() {
  if (client) return client;
  // Accept the URL with or without /rest/v1/ on the end.
  const url = process.env.SUPABASE_URL?.trim()
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) {
    throw new Error("SUPABASE_URL or SUPABASE_SECRET_KEY is missing in .env.local. Add them, then restart npm run dev.");
  }
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) {
    throw new Error("SUPABASE_URL looks wrong. It should look like https://abcdxyz.supabase.co");
  }
  if (key.startsWith("sb_publishable_") || legacyRole(key) === "anon") {
    throw new Error(
      "SUPABASE_SECRET_KEY is the publishable/anon key. Use the Secret key (sb_secret_...) or the service_role key instead, then restart npm run dev."
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
