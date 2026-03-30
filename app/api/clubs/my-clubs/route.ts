import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/* ================================================================
   GET /api/clubs/my-clubs
   Returns all clubs where the current user is an accepted admin.
   Includes club profile info and optionally a count of their events.
   Query params:
     - include_events: "true" to also return event summaries per club
================================================================ */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const includeEvents = searchParams.get("include_events") === "true";

    /* Fetch all clubs where the user is an accepted admin */
    const { data: adminRows, error } = await supabaseAdmin
      .from("club_admins")
      .select(
        `id, club_id, role, status, created_at,
         club:club_id(id, first_name, last_name, avatar_url, account_type)`,
      )
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch my clubs:", error);
      return NextResponse.json(
        { error: "Failed to fetch clubs" },
        { status: 500 },
      );
    }

    /* If include_events, also fetch event counts per club */
    if (includeEvents && adminRows && adminRows.length > 0) {
      const clubIds = adminRows.map((r) => r.club_id);

      /* Get events for all clubs the user admins */
      const { data: events } = await supabaseAdmin
        .from("events")
        .select(
          "id, name, start, end, status, category, is_online, created_at, creator_profile_id, event_images(url, sort_order)",
        )
        .in("creator_profile_id", clubIds)
        .order("created_at", { ascending: false });

      /* Group events by club */
      const eventsByClub: Record<string, typeof events> = {};
      for (const event of events ?? []) {
        const key = event.creator_profile_id;
        if (key) {
          if (!eventsByClub[key]) eventsByClub[key] = [];
          eventsByClub[key]!.push(event);
        }
      }

      const clubs = adminRows.map((row) => ({
        ...row,
        events: eventsByClub[row.club_id] ?? [],
        event_count: (eventsByClub[row.club_id] ?? []).length,
      }));

      return NextResponse.json({ data: clubs });
    }

    return NextResponse.json({ data: adminRows });
  } catch (error) {
    console.error("GET /api/clubs/my-clubs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
