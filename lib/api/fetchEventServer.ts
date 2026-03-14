import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClubAdminRow } from "@/lib/auth/clubAdmin";

/**
 * Minimal event data for the public event page (server-side only).
 * Fetches directly from Supabase — no API round-trip.
 */
export interface PublicEventData {
  id: string;
  name: string | null;
  description: string | null;
  start: string | null;
  end: string | null;
  timezone: string | null;
  is_online: boolean;
  category: string | null;
  tags: string[] | null;
  status: string;
  thumbnail: string | null;
  event_capacity: number | null;
  creator_profile_id: string;
  location: {
    venue: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  images: { id: string; url: string; sort_order: number }[];
  hosts: {
    profile_id: string;
    status: string;
    profiles: {
      id: string;
      first_name: string;
      avatar_url: string | null;
    } | null;
  }[];
  ticket_tiers: {
    id: string;
    member_verification: boolean;
    name: string;
    price: number;
    quantity: number | null;
    sort_order: number;
  }[];
  links: {
    id: string;
    url: string;
    title: string | null;
    sort_order: number;
  }[];
  theme: {
    mode: string;
    layout: string;
    accent: string;
    accent_custom: string | null;
    bg_color: string | null;
  } | null;
  sections: { id: string; type: string; data: unknown; sort_order: number }[];
  creator_profile: {
    id: string;
    first_name: string;
    avatar_url: string | null;
  } | null;
  ticketing: {
    enabled: boolean;
  } | null;
}

/**
 * Fetch a single event by ID (server-side).
 * By default only returns published events (safe for public pages).
 * Pass `requirePublished: false` to fetch any status (for owner/edit checks).
 */
export async function fetchEventServer(
  eventId: string,
  { requirePublished = true }: { requirePublished?: boolean } = {},
): Promise<PublicEventData | null> {
  let query = supabaseAdmin
    .from("events")
    .select("*, event_locations(*)")
    .or(`id.eq.${eventId},url_slug.eq.${eventId}`);

  if (requirePublished) {
    query = query.eq("status", "published");
  }

  const { data: event, error } = await query.single();

  if (error || !event) return null;

  const [
    images,
    hosts,
    tiers,
    links,
    theme,
    sections,
    creatorProfile,
    ticketing,
  ] = await Promise.all([
    supabaseAdmin
      .from("event_images")
      .select("id, url, sort_order")
      .eq("event_id", event.id)
      .order("sort_order"),
    supabaseAdmin
      .from("event_hosts")
      .select(
        "profile_id, status, profiles:profile_id(id, first_name, avatar_url)",
      )
      .eq("event_id", event.id)
      .order("sort_order"),
    supabaseAdmin
      .from("event_ticket_tiers")
      .select("id, member_verification, name, price, quantity, sort_order")
      .eq("event_id", event.id)
      .order("sort_order"),
    supabaseAdmin
      .from("event_links")
      .select("id, url, title, sort_order")
      .eq("event_id", event.id)
      .order("sort_order"),
    supabaseAdmin
      .from("event_themes")
      .select("mode, layout, accent, accent_custom, bg_color")
      .eq("event_id", event.id)
      .single(),
    supabaseAdmin
      .from("event_sections")
      .select("id, type, data, sort_order")
      .eq("event_id", event.id)
      .order("sort_order"),
    supabaseAdmin
      .from("profiles")
      .select("id, first_name, avatar_url")
      .eq("id", event.creator_profile_id)
      .single(),
    supabaseAdmin
      .from("event_ticketing")
      .select("enabled")
      .eq("event_id", event.id)
      .single(),
  ]);

  const loc = event.event_locations;

  return {
    id: event.id,
    name: event.name,
    description: event.description,
    start: event.start,
    end: event.end,
    timezone: event.timezone,
    is_online: event.is_online,
    category: event.category,
    tags: event.tags,
    status: event.status,
    thumbnail: event.thumbnail,
    event_capacity: event.event_capacity,
    creator_profile_id: event.creator_profile_id,
    location: loc
      ? {
          venue: loc.venue,
          address: loc.address,
          latitude: loc.latitude,
          longitude: loc.longitude,
        }
      : null,
    images: images.data ?? [],
    hosts: (hosts.data ?? []) as unknown as PublicEventData["hosts"],
    ticket_tiers: tiers.data ?? [],
    links: links.data ?? [],
    theme: theme.data ?? null,
    sections: sections.data ?? [],
    creator_profile: creatorProfile.data ?? null,
    ticketing: ticketing.data ?? null,
  };
}

/**
 * Return IDs of all published events — used by generateStaticParams.
 */
export async function getAllPublishedEventIds(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("status", "published");

  return (data ?? []).map((e) => e.id);
}

/**
 * Check whether a user has edit access to an event.
 * Returns { allowed: true } if the user is the creator or an accepted host.
 * Returns { allowed: false, reason } otherwise.
 */
export async function checkEventEditAccess(
  eventId: string,
  userId: string | null,
): Promise<
  | { allowed: true; event: PublicEventData }
  | { allowed: false; reason: "not_authenticated" | "not_found" | "forbidden" }
> {
  if (!userId) {
    console.log("[checkEventEditAccess] No userId — not authenticated");
    return { allowed: false, reason: "not_authenticated" };
  }

  console.log("[checkEventEditAccess] eventId:", eventId, "userId:", userId);

  const event = await fetchEventServer(eventId, { requirePublished: false });

  if (!event) {
    console.log("[checkEventEditAccess] Event not found");
    return { allowed: false, reason: "not_found" };
  }

  console.log(
    "[checkEventEditAccess] event.creator_profile_id:",
    event.creator_profile_id,
  );

  // Creator always has access
  if (event.creator_profile_id === userId) {
    console.log("[checkEventEditAccess] User is creator → allowed");
    return { allowed: true, event };
  }

  // Accepted collaborators have access
  const isHost = event.hosts.some(
    (h) => h.profile_id === userId && h.status === "accepted",
  );

  if (isHost) {
    console.log("[checkEventEditAccess] User is accepted host → allowed");
    return { allowed: true, event };
  }

  // Club admins have access — check both the creator org AND any collaborator orgs
  // 1) Check if the event creator is a club the user admins
  if (event.creator_profile_id) {
    console.log(
      "[checkEventEditAccess] Checking club admin for creator — clubId:",
      event.creator_profile_id,
      "userId:",
      userId,
    );
    const adminRow = await getClubAdminRow(event.creator_profile_id, userId);
    console.log(
      "[checkEventEditAccess] creator adminRow:",
      JSON.stringify(adminRow),
    );
    if (adminRow) {
      console.log(
        "[checkEventEditAccess] User is club admin of creator → allowed",
      );
      return { allowed: true, event };
    }
  }

  // 2) Check if any accepted collaborator is a club the user admins
  const collaboratorIds = event.hosts
    .filter((h) => h.status === "accepted")
    .map((h) => h.profile_id);
  if (collaboratorIds.length > 0) {
    console.log(
      "[checkEventEditAccess] Checking club admin for collaborators:",
      collaboratorIds,
    );
    for (const collabId of collaboratorIds) {
      const adminRow = await getClubAdminRow(collabId, userId);
      if (adminRow) {
        console.log(
          "[checkEventEditAccess] User is admin of collaborator club",
          collabId,
          "→ allowed",
        );
        return { allowed: true, event };
      }
    }
  }

  console.log("[checkEventEditAccess] No match → forbidden");
  return { allowed: false, reason: "forbidden" };
}

