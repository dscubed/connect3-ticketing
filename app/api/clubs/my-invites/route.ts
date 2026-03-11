import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/* ================================================================
   GET /api/clubs/my-invites
   Returns all pending club admin invites for the current user.
   Used by the notification/invite section on both dashboards.
================================================================ */
export async function GET() {
  try {
    /* Auth check */
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* Fetch all pending admin invites for this user */
    const { data, error } = await supabaseAdmin
      .from("club_admins")
      .select(
        `id, club_id, role, status, invited_by, created_at,
         club:club_id(id, first_name, last_name, avatar_url),
         inviter:invited_by(id, first_name, last_name, avatar_url)`,
      )
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch club invites:", error);
      return NextResponse.json(
        { error: "Failed to fetch invites" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/clubs/my-invites error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
