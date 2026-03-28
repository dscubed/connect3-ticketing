import type {
  EventFormData,
  CarouselImage,
  TicketTier,
  EventLink,
  EventTheme,
  LocationData,
  LocationType,
  OccurrenceFormData,
  ClubProfile,
  Venue,
} from "@/components/events/shared/types";
import { DEFAULT_THEME } from "@/components/events/shared/types";
import type { SectionData } from "@/components/events/sections/types";
import { splitUtcTimestampInTimeZone } from "@/lib/utils/timezone";

/* ── Raw shapes from the API ── */

interface RawImage {
  id: string;
  url: string;
  sort_order: number;
}

interface RawHost {
  profile_id: string;
  sort_order: number;
  status: string;
  inviter_id: string | null;
  profiles: {
    id: string;
    first_name: string;
    avatar_url: string | null;
  } | null;
}

interface RawTicketTier {
  id: string;
  member_verification: boolean;
  name: string;
  price: number;
  quantity: number | null;
  offer_start: string | null;
  offer_end: string | null;
  sort_order: number;
}

interface RawLink {
  id: string;
  url: string;
  title: string | null;
  sort_order: number;
}

interface RawTheme {
  mode: string;
  layout: string;
  accent: string;
  accent_custom: string | null;
  bg_color: string | null;
}

interface RawSection {
  id: string;
  type: string;
  data: unknown;
  sort_order: number;
}

interface RawLocation {
  id: string;
  venue: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface RawOccurrence {
  id: string;
  name: string | null;
  start: string;
  end: string | null;
}

interface RawEvent {
  id: string;
  name: string | null;
  description: string | null;
  start: string | null;
  end: string | null;
  timezone: string | null;
  is_online: boolean;
  location_type: string | null;
  online_link: string | null;
  is_recurring: boolean;
  category: string | null;
  tags: string[] | null;
  status: string;
  url_slug: string | null;
  creator_profile_id: string;
  event_capacity: number | null;
  event_locations: RawLocation | null;
  images: RawImage[];
  hosts: RawHost[];
  ticket_tiers: RawTicketTier[];
  links: RawLink[];
  theme: RawTheme | null;
  sections: RawSection[];
  occurrences: RawOccurrence[];
  ticketing: { enabled: boolean } | null;
}

export interface FetchedEventData {
  formData: Partial<EventFormData>;
  existingImages: string[];
  carouselImages: CarouselImage[];
  hostsData: ClubProfile[];
  sections: SectionData[];
  creatorProfileId: string;
  creatorProfile?: ClubProfile;
  urlSlug?: string | null;
  status: "draft" | "published" | "archived";
  ticketingEnabled: boolean;
}

/**
 * Fetch a single event by ID and transform it into the shape
 * needed by EventForm.
 */
export async function fetchEvent(eventId: string): Promise<FetchedEventData> {
  const res = await fetch(`/api/events/${eventId}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load event (${res.status})`);
  }

  const { data } = (await res.json()) as { data: RawEvent };

  /* ── Parse dates ── */
  let startDate = "";
  let startTime = "";
  let endDate = "";
  let endTime = "";
  const eventTimeZone =
    data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (data.start) {
    const parts = splitUtcTimestampInTimeZone(data.start, eventTimeZone);
    startDate = parts.date;
    startTime = parts.time;
  }
  if (data.end) {
    const parts = splitUtcTimestampInTimeZone(data.end, eventTimeZone);
    endDate = parts.date;
    endTime = parts.time;
  }

  /* ── Location ── */
  const loc = data.event_locations;
  const location: LocationData = {
    displayName: loc?.venue ?? "",
    address: loc?.address ?? "",
    lat: loc?.latitude ?? undefined,
    lon: loc?.longitude ?? undefined,
  };

  /* ── Location type (derive from is_online + location_id if column is null) ── */
  let locationType: LocationType = (data.location_type as LocationType) ?? "tba";
  if (!data.location_type) {
    if (data.is_online) locationType = "online";
    else if (data.event_locations) locationType = "physical";
    else locationType = "tba";
  }

  /* ── Venues (derive from legacy single-location for backward compat) ── */
  const venues: Venue[] = [];
  if (locationType === "online") {
    venues.push({
      id: loc?.id ?? "venue-online",
      type: "online",
      location: { displayName: "", address: "" },
      onlineLink: data.online_link ?? "",
    });
  } else if (locationType !== "tba" && location.displayName) {
    venues.push({
      id: loc?.id ?? "venue-primary",
      type: locationType,
      location,
    });
  }

  /* ── Occurrences ── */
  const occurrences: OccurrenceFormData[] = (data.occurrences ?? []).map((o) => {
    const s = splitUtcTimestampInTimeZone(o.start, eventTimeZone);
    const e = o.end
      ? splitUtcTimestampInTimeZone(o.end, eventTimeZone)
      : { date: s.date, time: "" };
    return {
      id: o.id,
      name: o.name ?? undefined,
      startDate: s.date,
      startTime: s.time,
      endDate: e.date,
      endTime: e.time,
    };
  });

  // Legacy backward compat: synthesize one occurrence from the event's
  // start/end dates when the DB has no occurrences yet.
  if (occurrences.length === 0 && startDate) {
    occurrences.push({
      id: `legacy-${data.id}`,
      startDate,
      startTime,
      endDate,
      endTime,
    });
  }

  /* ── Creator profile (fetch separately — owner is not in event_hosts) ── */
  let creatorProfile: ClubProfile | undefined;
  try {
    const profileRes = await fetch(
      `/api/profiles/fetch?id=${data.creator_profile_id}&select=id,first_name,avatar_url`,
    );
    if (profileRes.ok) {
      const { data: profileData } = await profileRes.json();
      if (profileData) {
        creatorProfile = {
          id: profileData.id,
          first_name: profileData.first_name,
          avatar_url: profileData.avatar_url,
        };
      }
    }
  } catch {
    // Best effort — will fall back to undefined
  }

  /* ── Hosts (owner is NOT in event_hosts, all hosts here are other clubs) ── */
  const hostIds = data.hosts
    .filter((h) => h.status === "pending" || h.status === "accepted")
    .map((h) => h.profile_id);
  const hostsData: ClubProfile[] = data.hosts
    .filter(
      (h) => h.profiles && (h.status === "pending" || h.status === "accepted"),
    )
    .map((h) => ({
      id: h.profiles!.id,
      first_name: h.profiles!.first_name,
      avatar_url: h.profiles!.avatar_url,
    }));

  /* ── Pricing / ticket tiers ── */
  const pricing: TicketTier[] = data.ticket_tiers.map((t) => ({
    ...(t.offer_start
      ? (() => {
          const split = splitUtcTimestampInTimeZone(
            t.offer_start,
            data.timezone,
          );
          return {
            offerStartDate: split.date,
            offerStartTime: split.time,
          };
        })()
      : {}),
    ...(t.offer_end
      ? (() => {
          const split = splitUtcTimestampInTimeZone(t.offer_end, data.timezone);
          return {
            offerEndDate: split.date,
            offerEndTime: split.time,
          };
        })()
      : {}),
    id: t.id,
    memberVerification: !!t.member_verification,
    name: t.name,
    price: t.price,
    quantity: t.quantity,
  }));

  /* ── Links ── */
  const eventLinks: EventLink[] = data.links.map((l) => ({
    id: l.id,
    url: l.url,
    title: l.title ?? "",
  }));

  /* ── Theme ── */
  const theme: EventTheme = data.theme
    ? {
        mode: data.theme.mode as EventTheme["mode"],
        layout: data.theme.layout as EventTheme["layout"],
        accent: data.theme.accent as EventTheme["accent"],
        accentCustom: data.theme.accent_custom ?? undefined,
        bgColor: data.theme.bg_color ?? undefined,
      }
    : { ...DEFAULT_THEME };

  /* ── Images ── */
  const existingImages = data.images.map((i) => i.url);
  const carouselImages: CarouselImage[] = data.images.map((img) => ({
    id: img.id,
    url: img.url,
  }));

  /* ── Sections ── */
  const sections: SectionData[] = data.sections.map((s) => ({
    type: s.type,
    ...(s.data as object),
  })) as SectionData[];

  /* ── Assemble form data ── */
  const formData: Partial<EventFormData> = {
    name: data.name ?? "",
    description: data.description ?? "",
    startDate,
    startTime,
    endDate,
    endTime,
    timezone: eventTimeZone,
    location,
    isOnline: data.is_online,
    locationType,
    onlineLink: data.online_link ?? "",
    venues,
    isRecurring: occurrences.length > 1,
    occurrences,
    category: data.category ?? "",
    tags: data.tags ?? [],
    hostIds,
    imageUrls: existingImages,
    pricing,
    eventCapacity: data.event_capacity ?? null,
    links: eventLinks,
    theme,
  };

  return {
    formData,
    existingImages,
    carouselImages,
    hostsData,
    sections,
    creatorProfileId: data.creator_profile_id,
    creatorProfile,
    status: (data.status ?? "draft") as "draft" | "published" | "archived",
    urlSlug: data.url_slug,
    ticketingEnabled: !!data.ticketing?.enabled,
  };
}
