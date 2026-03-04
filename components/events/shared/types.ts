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
  /** Latitude from geocoding — present when selected from search results */
  lat?: number;
  /** Longitude from geocoding — present when selected from search results */
  lon?: number;
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

/** A single event link (e.g. website, social, registration). */
export interface EventLink {
  id: string;
  url: string;
  title: string; // optional display title — empty string = show URL only
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

/* ── Event page theme ── */

export type ThemeMode = "light" | "dark" | "adaptive";
export type ThemeLayout = "card" | "classic";
export type ThemeAccent =
  | "none"
  | "yellow"
  | "cyan"
  | "purple"
  | "orange"
  | "green"
  | "custom";

export interface EventTheme {
  mode: ThemeMode;
  layout: ThemeLayout;
  accent: ThemeAccent;
  /** Hex colour used when accent === "custom" */
  accentCustom?: string;
  /** Solid background colour (card layout only). */
  bgColor?: string;
}

export const DEFAULT_THEME: EventTheme = {
  mode: "adaptive",
  layout: "card",
  accent: "none",
};

/**
 * Map an accent value to a CSS gradient string.
 * The gradient fades from the accent colour at the top to transparent,
 * so the underlying page background shows through.
 */
export function getAccentGradient(
  accent: ThemeAccent,
  isDark: boolean,
  customHex?: string,
): string | null {
  if (accent === "none") return null;

  const opacity = isDark ? 0.25 : 0.18;

  if (accent === "custom") {
    const hex = customHex || "#888888";
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `linear-gradient(to bottom, rgba(${r},${g},${b},${opacity}) 0%, transparent 45%)`;
  }

  const colorMap: Record<Exclude<ThemeAccent, "none" | "custom">, string> = {
    yellow: `rgba(234,179,8,${opacity})`,
    cyan: `rgba(6,182,212,${opacity})`,
    purple: `rgba(168,85,247,${opacity})`,
    orange: `rgba(249,115,22,${opacity})`,
    green: `rgba(34,197,94,${opacity})`,
  };

  return `linear-gradient(to bottom, ${colorMap[accent]} 0%, transparent 45%)`;
}

/**
 * Resolved color tokens for a given theme mode.
 * All values are Tailwind class strings.
 */
export interface ThemeColors {
  /** Primary text — e.g. "text-white" in dark, "text-black" in light */
  text: string;
  /** Muted/secondary text */
  textMuted: string;
  /** Card / surface background */
  cardBg: string;
  /** Card border */
  cardBorder: string;
  /** Input background */
  inputBg: string;
  /** Input border */
  inputBorder: string;
  /** Placeholder text */
  placeholder: string;
  /** Hover background for interactive items */
  hoverBg: string;
  /** Hover text for interactive items */
  hoverText: string;
  /** Page background */
  pageBg: string;
  /** Separator / divider colour */
  separator: string;
  /** Whether this is a dark surface */
  isDark: boolean;
}

/** Resolve a ThemeMode to concrete Tailwind class tokens. */
export function getThemeColors(mode: ThemeMode): ThemeColors {
  if (mode === "dark") {
    return {
      text: "text-white",
      textMuted: "text-neutral-400",
      cardBg: "bg-neutral-800",
      cardBorder: "border-neutral-700",
      inputBg: "bg-neutral-700",
      inputBorder: "border-neutral-600",
      placeholder: "placeholder:text-neutral-400",
      hoverBg: "hover:bg-neutral-700",
      hoverText: "hover:text-white",
      pageBg: "bg-neutral-900",
      separator: "bg-neutral-700",
      isDark: true,
    };
  }
  if (mode === "light") {
    return {
      text: "text-black",
      textMuted: "text-neutral-500",
      cardBg: "bg-white",
      cardBorder: "border-neutral-200",
      inputBg: "bg-white",
      inputBorder: "border-neutral-300",
      placeholder: "placeholder:text-neutral-400",
      hoverBg: "hover:bg-neutral-100",
      hoverText: "hover:text-black",
      pageBg: "bg-white",
      separator: "",
      isDark: false,
    };
  }
  // adaptive — use shadcn defaults (empty strings = no overrides)
  return {
    text: "",
    textMuted: "text-muted-foreground",
    cardBg: "",
    cardBorder: "",
    inputBg: "",
    inputBorder: "",
    placeholder: "",
    hoverBg: "hover:bg-muted",
    hoverText: "hover:text-foreground",
    pageBg: "bg-background",
    separator: "",
    isDark: false,
  };
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
  /** External links (website, socials, etc.). */
  links: EventLink[];
  /** Page appearance customization. */
  theme: EventTheme;
}
