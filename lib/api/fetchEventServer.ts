import { supabaseAdmin } from "@/lib/supabase/admin";

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
  capacity: number | null;
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
    label: string;
    price: number;
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
    .eq("id", eventId);

  if (requirePublished) {
    query = query.eq("status", "published");
  }

  const { data: event, error } = await query.single();

  if (error || !event) return null;

  const [images, hosts, tiers, links, theme, sections, creatorProfile] =
    await Promise.all([
      supabaseAdmin
        .from("event_images")
        .select("id, url, sort_order")
        .eq("event_id", eventId)
        .order("sort_order"),
      supabaseAdmin
        .from("event_hosts")
        .select(
          "profile_id, status, profiles:profile_id(id, first_name, avatar_url)",
        )
        .eq("event_id", eventId)
        .order("sort_order"),
      supabaseAdmin
        .from("event_ticket_tiers")
        .select("id, label, price, sort_order")
        .eq("event_id", eventId)
        .order("sort_order"),
      supabaseAdmin
        .from("event_links")
        .select("id, url, title, sort_order")
        .eq("event_id", eventId)
        .order("sort_order"),
      supabaseAdmin
        .from("event_themes")
        .select("mode, layout, accent, accent_custom, bg_color")
        .eq("event_id", eventId)
        .single(),
      supabaseAdmin
        .from("event_sections")
        .select("id, type, data, sort_order")
        .eq("event_id", eventId)
        .order("sort_order"),
      supabaseAdmin
        .from("profiles")
        .select("id, first_name, avatar_url")
        .eq("id", event.creator_profile_id)
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
    capacity: event.capacity,
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
    return { allowed: false, reason: "not_authenticated" };
  }

  const event = await fetchEventServer(eventId, { requirePublished: false });

  if (!event) {
    return { allowed: false, reason: "not_found" };
  }

  // Creator always has access
  if (event.creator_profile_id === userId) {
    return { allowed: true, event };
  }

  // Accepted/confirmed collaborators have access
  const isHost = event.hosts.some(
    (h) =>
      h.profile_id === userId &&
      (h.status === "accepted" || h.status === "confirmed"),
  );

  if (isHost) {
    return { allowed: true, event };
  }

  return { allowed: false, reason: "forbidden" };
}
