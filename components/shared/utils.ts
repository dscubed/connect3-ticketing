/** Formats a date string as "TBA" if null, otherwise returns the formatted date */

export { type AvatarProfile, type EventCardDetails } from "@/lib/types/events";

export const formatDateTBA = (dateStr: string | null) => {
  if (!dateStr) return "TBA";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
  });
};

/** Formats a Unix timestamp as a date string */
export function formatDateTimestamp(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
