import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client with the service-role key.
 * Use this ONLY in server-side code (API routes, server actions).
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
);
