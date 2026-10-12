import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Service-role client. Bypasses RLS, so only use it for the narrow operations the anon key
 * cannot perform (sending invites, finding an invitee by email, removing an account), and
 * only after checking the caller may do them. Never import from client code.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
