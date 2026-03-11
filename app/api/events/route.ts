import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getClubAdminRow, getAdminClubIds } from "@/lib/auth/clubAdmin";

/* ── Types matching the JSON payload ── */

interface TicketTierPayload {
  label: string;
  price: number;
}
interface EventLinkPayload {
  url: string;
  title: string;
}
interface ThemePayload {
  mode: string;
  layout: string;
  accent: string;
  accentCustom?: string;
  bgColor?: string;
}
interface LocationPayload {
  displayName: string;
  address: string;
  lat?: number;
  lon?: number;
}
interface SectionPayload {
  type: string;
  data: unknown;
}

/* ================================================================
   GET /api/events
   Fetches events for a given creator (or collaborator).
   Query params:
     - creator_id: UUID of the organisation profile
     - club_id: (optional) UUID of the club — for club admins fetching a club's events
     - status: filter by event status ("draft" | "published" | "archived")
     - cursor: ISO timestamp for cursor-based pagination (returns events before this)
     - limit: max results (default: 20)
================================================================ */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creator_id");
    const clubId = searchParams.get("club_id");
    const statusFilter = searchParams.get("status");
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    /* ── Mode 1: Club admin fetching a specific club's events ── */
    if (clubId) {
      /* Auth check — caller must be logged in */
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      /* Verify the caller is either the club owner or an accepted admin */
      const isOwner = clubId === user.id;
      if (!isOwner) {
        const adminRow = await getClubAdminRow(clubId, user.id);
        if (!adminRow) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      /* Fetch events owned by the club + events where club is collaborator */
      const { data: collabRows } = await supabaseAdmin
        .from("event_hosts")
        .select("event_id")
        .eq("profile_id", clubId)
        .eq("status", "accepted");
      const collabEventIds = (collabRows ?? []).map((r) => r.event_id);

      let query = supabaseAdmin
        .from("events")
        .select(
          "id, name, description, start, end, thumbnail, is_online, capacity, category, published_at, status, created_at, creator_profile_id",
        )
        .or(
          collabEventIds.length > 0
            ? `creator_profile_id.eq.${clubId},id.in.(${collabEventIds.join(",")})`
            : `creator_profile_id.eq.${clubId}`,
        )
        .order("created_at", { ascending: false })
        .limit(limit + 1);

      if (statusFilter) query = query.eq("status", statusFilter);
      if (cursor) query = query.lt("created_at", cursor);

      const { data, error } = await query;
      if (error) {
        console.error("Events fetch error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const hasMore = (data?.length ?? 0) > limit;
      const items = hasMore ? data!.slice(0, limit) : (data ?? []);
      const nextCursor = hasMore ? items[items.length - 1].created_at : null;
      return NextResponse.json({ data: items, hasMore, nextCursor });
    }

    /* ── Mode 2: Original — creator_id based ── */
    if (!creatorId) {
      return NextResponse.json(
        { error: "creator_id or club_id is required" },
        { status: 400 },
      );
    }

    /* First, get event IDs where the user is an accepted collaborator */
    const { data: collabRows } = await supabaseAdmin
      .from("event_hosts")
      .select("event_id")
      .eq("profile_id", creatorId)
      .eq("status", "accepted");
    const collabEventIds = (collabRows ?? []).map((r) => r.event_id);

    let query = supabaseAdmin
      .from("events")
      .select(
        "id, name, description, start, end, thumbnail, is_online, capacity, category, published_at, status, created_at, creator_profile_id",
      )
      .or(
        collabEventIds.length > 0
          ? `creator_profile_id.eq.${creatorId},id.in.(${collabEventIds.join(",")})`
          : `creator_profile_id.eq.${creatorId}`,
      )
      .order("created_at", { ascending: false })
      .limit(limit + 1); // fetch one extra to determine hasMore

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Events fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const hasMore = (data?.length ?? 0) > limit;
    const items = hasMore ? data!.slice(0, limit) : (data ?? []);
    const nextCursor = hasMore ? items[items.length - 1].created_at : null;

    return NextResponse.json({ data: items, hasMore, nextCursor });
  } catch (error) {
    console.error("Events route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/* ================================================================
   POST /api/events
   Creates a new event with all associated records.
   Accepts JSON body. All images are already uploaded as URLs.
================================================================ */
export async function POST(request: NextRequest) {
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

    /* ── Parse JSON body ── */
    const body = await request.json();

    const eventId: string = body.id;
    const eventStatus: string = body.status ?? "draft";
    const name: string = body.name ?? "";
    const description: string | null = body.description || null;
    const startDate: string = body.startDate;
    const startTime: string = body.startTime;
    const endDate: string | null = body.endDate || null;
    const endTime: string | null = body.endTime || null;
    const timezone: string | null = body.timezone || null;
    const isOnline: boolean = body.isOnline ?? false;
    const category: string | null = body.category || null;
    const tags: string[] = body.tags ?? [];
    const hostIds: string[] = body.hostIds ?? [];
    const pricing: TicketTierPayload[] = body.pricing ?? [];
    const links: EventLinkPayload[] = body.links ?? [];
    const theme: ThemePayload | null = body.theme ?? null;
    const location: LocationPayload | null = body.location ?? null;
    const imageUrls: string[] = body.imageUrls ?? [];
    const sections: SectionPayload[] = body.sections ?? [];

    /* Name is required only when publishing */
    if (eventStatus === "published" && !name) {
      return NextResponse.json(
        { error: "Event name is required" },
        { status: 400 },
      );
    }
    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 },
      );
    }

    /* ── Build start / end timestamps ── */
    const startTs =
      startDate && startTime
        ? new Date(`${startDate}T${startTime}`).toISOString()
        : null;
    const endTs =
      endDate && endTime
        ? new Date(`${endDate}T${endTime}`).toISOString()
        : null;

    /* ── Insert location ── */
    let locationId: string | null = null;
    if (location?.displayName && !isOnline) {
      const { data: loc, error: locErr } = await supabaseAdmin
        .from("event_locations")
        .insert({
          venue: location.displayName,
          address: location.address || null,
          latitude: location.lat ?? null,
          longitude: location.lon ?? null,
        })
        .select("id")
        .single();
      if (locErr) throw new Error(`Location insert failed: ${locErr.message}`);
      locationId = loc.id;
    }

    /* ── Determine the creator_profile_id ──
       If club_id is provided, verify the user is a club admin and
       set the event's creator to the club, not the user. */
    const clubId: string | null = body.clubId || null;
    let creatorProfileId = user.id;
    if (clubId) {
      const adminRow = await getClubAdminRow(clubId, user.id);
      const isOwner = clubId === user.id;
      if (!isOwner && !adminRow) {
        return NextResponse.json(
          { error: "You are not an admin of this club" },
          { status: 403 },
        );
      }
      creatorProfileId = clubId;
    }

    /* ── Insert event row ── */
    const thumbnail = imageUrls[0] ?? null;
    const { error: eventErr } = await supabaseAdmin.from("events").insert({
      id: eventId,
      name,
      description,
      start: startTs,
      end: endTs,
      creator_profile_id: creatorProfileId,
      status: eventStatus,
      published_at:
        eventStatus === "published" ? new Date().toISOString() : null,
      is_online: isOnline,
      thumbnail,
      location_id: locationId,
      category,
      tags,
      timezone,
      source: "connect3",
    });
    if (eventErr) throw new Error(`Event insert failed: ${eventErr.message}`);

    /* ── Insert carousel images ── */
    if (imageUrls.length > 0) {
      const rows = imageUrls.map((url, i) => ({
        event_id: eventId,
        url,
        sort_order: i,
      }));
      const { error } = await supabaseAdmin.from("event_images").insert(rows);
      if (error) console.error("event_images insert error:", error);
    }

    /* ── Hosts are managed through the invite flow ── */
    /* Collaborators are added via POST /api/events/[id]/invites
       which creates event_hosts rows with status='pending'. */

    /* ── Insert ticket tiers ── */
    if (pricing.length > 0) {
      const rows = pricing.map((t, i) => ({
        event_id: eventId,
        label: t.label,
        price: t.price,
        sort_order: i,
      }));
      const { error } = await supabaseAdmin
        .from("event_ticket_tiers")
        .insert(rows);
      if (error) console.error("event_ticket_tiers insert error:", error);
    }

    /* ── Insert links ── */
    if (links.length > 0) {
      const rows = links.map((l, i) => ({
        event_id: eventId,
        url: l.url,
        title: l.title || null,
        sort_order: i,
      }));
      const { error } = await supabaseAdmin.from("event_links").insert(rows);
      if (error) console.error("event_links insert error:", error);
    }

    /* ── Insert theme ── */
    if (theme) {
      const { error } = await supabaseAdmin.from("event_themes").insert({
        event_id: eventId,
        mode: theme.mode,
        layout: theme.layout,
        accent: theme.accent,
        accent_custom: theme.accentCustom || null,
        bg_color: theme.bgColor || null,
      });
      if (error) console.error("event_themes insert error:", error);
    }

    /* ── Insert sections ── */
    if (sections.length > 0) {
      const rows = sections.map((s, i) => ({
        event_id: eventId,
        type: s.type,
        data: s.data,
        sort_order: i,
      }));
      const { error } = await supabaseAdmin.from("event_sections").insert(rows);
      if (error) console.error("event_sections insert error:", error);
    }

    return NextResponse.json(
      { id: eventId, message: "Event created" },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/events error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
