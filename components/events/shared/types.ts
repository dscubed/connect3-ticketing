/* ── Generic base props ── */

/** Base props for an editable form input — value in, change callback out. */
export interface EditInputProps<T> {
  value: T;
  onChange: (value: T) => void;
}

/** Base props for a read-only preview display. */
export interface PreviewInputProps<T> {
  value: T;
}

/* ── Shared event types ── */

export interface DateTimeData {
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endDate: string;
  endTime: string;
  timezone: string; // IANA tz
}

export interface LocationData {
  displayName: string;
  address: string;
}

export interface ClubProfile {
  id: string;
  first_name: string;
  avatar_url: string | null;
}

/** A single ticket tier (e.g. Early Bird – $10). */
export interface TicketTier {
  id: string;
  label: string; // e.g. "Early Bird", "Members", custom text
  price: number; // 0 = free
}

/** Pre-defined ticket-type labels users can pick. */
export const PRESET_TICKET_TYPES = [
  "All",
  "Early Bird",
  "Members",
  "Non-Members",
] as const;

/** Composite value for the hosts form input (ids + cached profile objects). */
export interface HostsValue {
  ids: string[];
  data: ClubProfile[];
}

/** An image in the event photo carousel. */
export interface CarouselImage {
  id: string;
  file: File | null; // null for pre-existing server images
  preview: string; // blob URL or server URL
}

export interface EventFormData {
  name: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timezone: string;
  location: LocationData;
  isOnline: boolean;
  category: string;
  tags: string[];
  hostIds: string[];
  imageFiles: File[];
  /** Ticket pricing tiers — empty array means "Free". */
  pricing: TicketTier[];
}
