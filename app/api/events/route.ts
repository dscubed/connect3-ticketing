import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
);

/**
 * GET /api/events
 *
 * Fetches events for a given creator (organisation).
 *
 * Query params:
 *   - creator_id: UUID of the organisation profile
 *   - limit: max results (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creator_id");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    if (!creatorId) {
      return NextResponse.json(
        { error: "creator_id is required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("events")
      .select(
        "id, name, description, start, end, thumbnail, is_online, capacity, category, published_at",
      )
      .eq("creator_profile_id", creatorId)
      .order("start", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Events fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Events route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
