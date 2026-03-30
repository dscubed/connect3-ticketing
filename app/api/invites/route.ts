import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/* ================================================================
   GET /api/invites
   Returns all collaboration invites (event_hosts) for the current user.
   Query params:
     - status: filter by host status (default: all)
================================================================ */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status"); // e.g. "pending"

    let query = supabaseAdmin
      .from("event_hosts")
      .select(
        `id, event_id, inviter_id, status, sort_order,
         events:event_id(id, name, start, end, is_online, category, status, event_images(url, sort_order)),
         inviter:inviter_id(id, first_name, last_name, avatar_url)`,
      )
      .eq("profile_id", user.id)
      .in("status", ["pending", "accepted"])
      .order("sort_order", { ascending: true });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch invites:", error);
      return NextResponse.json(
        { error: "Failed to fetch invites" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/invites error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
