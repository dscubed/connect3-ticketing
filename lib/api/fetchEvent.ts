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

/* ── Raw shapes from the API ── */

interface RawImage {
  id: string;
  url: string;
  sort_order: number;
}

interface RawHost {
  profile_id: string;
  sort_order: number;
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

  if (data.start) {
    const d = new Date(data.start);
    startDate = d.toISOString().slice(0, 10); // YYYY-MM-DD
    startTime = d.toTimeString().slice(0, 5); // HH:MM
  }
  if (data.end) {
    const d = new Date(data.end);
    endDate = d.toISOString().slice(0, 10);
    endTime = d.toTimeString().slice(0, 5);
  }

  /* ── Location ── */
  const loc = data.event_locations;
  const location: LocationData = {
    displayName: loc?.venue ?? "",
    address: loc?.address ?? "",
    lat: loc?.latitude ?? undefined,
    lon: loc?.longitude ?? undefined,
  };

  /* ── Hosts ── */
  const hostIds = data.hosts
    .filter((h) => h.profile_id !== data.creator_profile_id)
    .map((h) => h.profile_id);
  const hostsData: ClubProfile[] = data.hosts
    .filter((h) => h.profiles && h.profile_id !== data.creator_profile_id)
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
    file: null,
    preview: img.url,
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
    timezone: data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    location,
    isOnline: data.is_online,
    category: data.category ?? "",
    tags: data.tags ?? [],
    hostIds,
    imageFiles: [],
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
  };
}
