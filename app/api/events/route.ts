import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getClubAdminRow } from "@/lib/auth/clubAdmin";
import type { EventCardDetails, AvatarProfile } from "@/lib/types/events";
import { buildUtcTimestamp } from "@/lib/utils/timezone";
import {
  validateTicketTierInput,
  validateEventCapacity,
  type TicketTierInput,
} from "@/lib/utils/ticketPricing";

/* ── Types matching the JSON payload ── */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface TicketTierPayload extends TicketTierInput {}
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

/* ── Helper: Fetch collaborators for an event ── */
async function getEventCollaborators(
  eventId: string,
): Promise<AvatarProfile[] | null> {
  const { data, error } = await supabaseAdmin
    .from("event_hosts")
    .select("profile:profile_id(id, first_name, avatar_url)")
    .eq("event_id", eventId)
    .eq("status", "accepted");

  if (error) {
    console.error("Failed to fetch collaborators for event", eventId, error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data
    .map((row) => {
      const p = row.profile as unknown as AvatarProfile | null;
      if (!p) return null;
      return { id: p.id, first_name: p.first_name, avatar_url: p.avatar_url };
    })
    .filter((p): p is AvatarProfile => p !== null);
}

/* ── Helper: Transform raw event row to EventCardDetails ── */
async function transformToEventCardDetails(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any,
): Promise<EventCardDetails> {
  const collaborators = await getEventCollaborators(event.id);

  // Supabase FK join: profiles is returned as a single object for to-one relations
  const profile = event.profiles as unknown as AvatarProfile;

  // Supabase FK join: location is returned as a single object for to-one relations
  const location = event.event_locations as unknown as { venue: string } | null;

  return {
    id: event.id,
    name: event.name,
    start: event.start,
    thumbnail: event.thumbnail,
    is_online: event.is_online,
    status: event.status,
    category: event.category,
    location_name: location?.venue ?? null,
    host: {
      id: profile.id,
      first_name: profile.first_name,
      avatar_url: profile.avatar_url,
    },
    collaborators,
  };
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
     - ids: comma-separated event IDs — when provided with club_id, returns only
             matching events that belong to the club (no pagination, preserves order)
     - recent: "true" — returns the user's recently edited events.
               If club_id is provided, scoped to that club.
               If no club_id, returns across ALL the user's events.
================================================================ */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creator_id");
    const clubId = searchParams.get("club_id");
    const statusFilter = searchParams.get("status");
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const idsParam = searchParams.get("ids"); // comma-separated event IDs
    const recentParam = searchParams.get("recent");

    /* ── Mode 0: Cross-club recent edits (no club_id required) ── */
    if (recentParam === "true" && !clubId) {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: recentRows, error: recentErr } = await supabaseAdmin
        .from("recent_event_edits")
        .select("event_id")
        .eq("user_id", user.id)
        .order("edited_at", { ascending: false })
        .limit(limit);

      if (recentErr) {
        console.error("Recent edits fetch error:", recentErr);
        return NextResponse.json({ error: recentErr.message }, { status: 500 });
      }

      const recentIds = (recentRows ?? []).map((r) => r.event_id);
      if (recentIds.length === 0) {
        return NextResponse.json({ data: [] });
      }

      const { data, error } = await supabaseAdmin
        .from("events")
        .select(
          "id, name, start, thumbnail, is_online, category, status, profiles!creator_profile_id(id, first_name, avatar_url), event_locations(venue)",
        )
        .in("id", recentIds);

      if (error) {
        console.error("Events recent-fetch error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Preserve recent order and transform
      const byId = new Map((data ?? []).map((e) => [e.id, e]));
      const ordered = recentIds
        .filter((id) => byId.has(id))
        .map((id) => byId.get(id)!);

      // Transform to EventCardDetails format
      const transformed = await Promise.all(
        ordered.map((event) => transformToEventCardDetails(event)),
      );

      return NextResponse.json({ data: transformed });
    }

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

      /* ── Sub-mode: recently edited events for this user + club ── */
      if (recentParam === "true") {
        // Get recent event IDs for the current user, ordered by edited_at desc
        const { data: recentRows, error: recentErr } = await supabaseAdmin
          .from("recent_event_edits")
          .select("event_id")
          .eq("user_id", user.id)
          .order("edited_at", { ascending: false })
          .limit(20);

        if (recentErr) {
          console.error("Recent views fetch error:", recentErr);
          return NextResponse.json(
            { error: recentErr.message },
            { status: 500 },
          );
        }

        const recentIds = (recentRows ?? []).map((r) => r.event_id);
        if (recentIds.length === 0) {
          return NextResponse.json({ data: [] });
        }

        // Fetch those events, but only the ones that belong to this club
        const clubEventFilter =
          collabEventIds.length > 0
            ? `creator_profile_id.eq.${clubId},id.in.(${collabEventIds.join(",")})`
            : `creator_profile_id.eq.${clubId}`;

        const { data, error } = await supabaseAdmin
          .from("events")
          .select(
            "id, name, start, thumbnail, is_online, category, status, profiles!creator_profile_id(id, first_name, avatar_url), event_locations(venue)",
          )
          .in("id", recentIds)
          .or(clubEventFilter);

        if (error) {
          console.error("Events recent-fetch error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Preserve the recent order (most recently viewed first)
        const byId = new Map((data ?? []).map((e) => [e.id, e]));
        const ordered = recentIds
          .filter((id) => byId.has(id))
          .map((id) => byId.get(id)!)
          .slice(0, limit);

        const transformed = await Promise.all(
          ordered.map((event) => transformToEventCardDetails(event)),
        );
        return NextResponse.json({ data: transformed });
      }

      /* ── Sub-mode: fetch specific event IDs ── */
      if (idsParam) {
        const requestedIds = idsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 50); // cap

        if (requestedIds.length === 0) {
          return NextResponse.json({ data: [] });
        }

        // Only return events that belong to this club AND match the IDs
        const clubEventFilter =
          collabEventIds.length > 0
            ? `creator_profile_id.eq.${clubId},id.in.(${collabEventIds.join(",")})`
            : `creator_profile_id.eq.${clubId}`;

        const { data, error } = await supabaseAdmin
          .from("events")
          .select(
            "id, name, start, thumbnail, is_online, category, status, profiles!creator_profile_id(id, first_name, avatar_url), event_locations(venue)",
          )
          .in("id", requestedIds)
          .or(clubEventFilter);

        if (error) {
          console.error("Events ids-fetch error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Preserve the order of the requested IDs
        const byId = new Map((data ?? []).map((e) => [e.id, e]));
        const ordered = requestedIds
          .filter((id) => byId.has(id))
          .map((id) => byId.get(id)!);

        const transformed = await Promise.all(
          ordered.map((event) => transformToEventCardDetails(event)),
        );
        return NextResponse.json({ data: transformed });
      }

      /* ── Sub-mode: paginated list ── */

      let query = supabaseAdmin
        .from("events")
        .select(
          "id, name, start, thumbnail, is_online, category, status, created_at, profiles!creator_profile_id(id, first_name, avatar_url), event_locations(venue)",
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

      const transformed = await Promise.all(
        items.map((event) => transformToEventCardDetails(event)),
      );
      return NextResponse.json({ data: transformed, hasMore, nextCursor });
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
        "id, name, start, thumbnail, is_online, category, status, created_at, profiles!creator_profile_id(id, first_name, avatar_url), event_locations(venue)",
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

    const transformed = await Promise.all(
      items.map((event) => transformToEventCardDetails(event)),
    );
    return NextResponse.json({ data: transformed, hasMore, nextCursor });
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
    const locationType: string = body.locationType ?? (isOnline ? "online" : "tba");
    const onlineLink: string | null = body.onlineLink || null;
    const isRecurring: boolean = body.isRecurring ?? false;
    const category: string | null = body.category || null;
    const tags: string[] = body.tags ?? [];
    const pricing: TicketTierPayload[] = body.pricing ?? [];

    const eventCapacityInput: number | null = body.eventCapacity ?? null;
    let eventCapacity = eventCapacityInput;

    if (pricing.length > 0) {
      const sumQuantities = pricing.reduce((sum, tier) => {
        return sum + (tier.quantity ?? 0);
      }, 0);
      if (eventCapacity !== null && sumQuantities > eventCapacity) {
        eventCapacity = sumQuantities;
      }
    }

    const links: EventLinkPayload[] = body.links ?? [];
    const theme: ThemePayload | null = body.theme ?? null;
    const location: LocationPayload | null = body.location ?? null;
    const imageUrls: string[] = body.imageUrls ?? [];
    const sections: SectionPayload[] = body.sections ?? [];
    const occurrencesInput: { startDate: string; startTime: string; endDate: string; endTime: string }[] = body.occurrences ?? [];

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

    const capError = validateEventCapacity(eventCapacity);
    if (capError) {
      return NextResponse.json({ error: capError }, { status: 400 });
    }

    /* ── Build start / end timestamps ── */
    const startTs = buildUtcTimestamp(startDate, startTime, timezone);
    const endTs = buildUtcTimestamp(endDate, endTime, timezone);

    /* ── Insert location ── */
    let locationId: string | null = null;
    if (location?.displayName && (locationType === "physical" || locationType === "custom")) {
      const { data: loc, error: locErr } = await supabaseAdmin
        .from("event_locations")
        .insert({
          venue: location.displayName,
          address: location.address || null,
          latitude: locationType === "physical" ? (location.lat ?? null) : null,
          longitude: locationType === "physical" ? (location.lon ?? null) : null,
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
      is_online: locationType === "online",
      location_type: locationType,
      online_link: locationType === "online" ? onlineLink : null,
      is_recurring: isRecurring,
      thumbnail,
      location_id: locationId,
      category,
      tags,
      timezone,
      event_capacity: eventCapacity,
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
      for (const tier of pricing) {
        const validationError = validateTicketTierInput(tier);
        if (validationError) {
          return NextResponse.json({ error: validationError }, { status: 400 });
        }
      }

      const rows = pricing.map((t, i) => ({
        event_id: eventId,
        member_verification: t.memberVerification ?? false,
        name: t.name,
        price: t.price,
        quantity: t.quantity ?? null,
        offer_start: buildUtcTimestamp(
          t.offerStartDate,
          t.offerStartTime,
          timezone,
        ),
        offer_end: buildUtcTimestamp(t.offerEndDate, t.offerEndTime, timezone),
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

    /* ── Set theme columns on the events row ── */
    if (theme) {
      const { error } = await supabaseAdmin.from("events").update({
        theme_mode: theme.mode,
        theme_layout: theme.layout,
        theme_accent: theme.accent,
        theme_accent_custom: theme.accentCustom || null,
        theme_bg_color: theme.bgColor || null,
      }).eq("id", eventId);
      if (error) console.error("theme columns update error:", error);
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

    /* ── Insert occurrences ── */
    if (occurrencesInput.length > 0) {
      const occRows = occurrencesInput.map((o) => ({
        event_id: eventId,
        start: buildUtcTimestamp(o.startDate, o.startTime, timezone),
        end: buildUtcTimestamp(o.endDate, o.endTime, timezone),
      }));
      const { error } = await supabaseAdmin.from("event_occurrences").insert(occRows);
      if (error) console.error("event_occurrences insert error:", error);
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
