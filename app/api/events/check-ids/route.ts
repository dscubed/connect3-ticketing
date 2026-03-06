import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/events/check-ids?ids=abc&ids=def
 *
 * Returns which of the given IDs already exist as events.
 * Used by the Instagram import flow to mark already-imported posts.
 */
export async function GET(request: NextRequest) {
  try {
    /* ── Auth check ── */
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ids = searchParams.getAll("ids");

    if (ids.length === 0) {
      return NextResponse.json({ existingIds: [] });
    }

    // Cap to prevent abuse
    const capped = ids.slice(0, 100);

    const { data, error } = await supabaseAdmin
      .from("events")
      .select("id")
      .in("id", capped);

    if (error) {
      console.error("check-ids error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const existingIds = (data ?? []).map((row) => row.id);
    return NextResponse.json({ existingIds });
  } catch (error) {
    console.error("GET /api/events/check-ids error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
