import type { TicketTier } from "./types";

/**
 * Returns a human-readable pricing label:
 *  - No tiers → "Free"
 *  - All tiers $0 → "Free"
 *  - 1 tier → "$5"
 *  - Multiple tiers → "$5 – $10" (min – max)
 *  - Mix of free + paid → "$0 – $10"
 */
export function formatPricingLabel(tiers: Pick<TicketTier, "price">[]): string {
  if (tiers.length === 0) return "Free";

  const prices = tiers.map((t) => t.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  if (max === 0) return "Free";

  const fmt = (n: number) =>
    n === 0 ? "$0" : `$${n % 1 === 0 ? n : n.toFixed(2)}`;

  if (min === max) return fmt(min);

  return `${fmt(min)} – ${fmt(max)}`;
}

/**
 * Validates if a ticket tier has all required fields.
 * Returns null if valid, or an error message if invalid.
 */
export function validateTicketTier(tier: TicketTier): string | null {
  if (!tier.name || !tier.name.trim()) {
    return "Ticket name is required";
  }
  if (
    tier.quantity !== null &&
    tier.quantity !== undefined &&
    tier.quantity <= 0
  ) {
    return "Quantity must be greater than 0 when provided";
  }

  // Validate offer window if any offer date is provided
  if (
    tier.offerStartDate ||
    tier.offerStartTime ||
    tier.offerEndDate ||
    tier.offerEndTime
  ) {
    if (
      !tier.offerStartDate ||
      !tier.offerStartTime ||
      !tier.offerEndDate ||
      !tier.offerEndTime
    ) {
      return "Offer window requires both start and end date/time";
    }

    const start = new Date(`${tier.offerStartDate}T${tier.offerStartTime}`);
    const end = new Date(`${tier.offerEndDate}T${tier.offerEndTime}`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "Offer window dates are invalid";
    }

    if (end <= start) {
      return "Offer window end must be after start";
    }
  }

  return null;
}
