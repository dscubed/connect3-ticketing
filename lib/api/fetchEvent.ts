import type {
  EventFormData,
  CarouselImage,
  TicketTier,
  EventLink,
  EventTheme,
  LocationData,
  ClubProfile,
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
  label: string;
  price: number;
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

interface RawEvent {
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
  creator_profile_id: string;
  event_locations: RawLocation | null;
  images: RawImage[];
  hosts: RawHost[];
  ticket_tiers: RawTicketTier[];
  links: RawLink[];
  theme: RawTheme | null;
  sections: RawSection[];
}

export interface FetchedEventData {
  formData: Partial<EventFormData>;
  existingImages: string[];
  carouselImages: CarouselImage[];
  hostsData: ClubProfile[];
  sections: SectionData[];
  creatorProfileId: string;
  creatorProfile?: ClubProfile;
  status: "draft" | "published" | "archived";
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
    id: t.id,
    label: t.label,
    price: t.price,
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
    category: data.category ?? "",
    tags: data.tags ?? [],
    hostIds,
    imageUrls: existingImages,
    pricing,
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
  };
}
