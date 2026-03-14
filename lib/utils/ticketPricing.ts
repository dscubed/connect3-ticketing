export interface TicketTierInput {
  memberVerification?: boolean;
  name: string;
  price: number;
  quantity?: number | null;
  offerStartDate?: string;
  offerStartTime?: string;
  offerEndDate?: string;
  offerEndTime?: string;
}

export function validateTicketTierInput(tier: TicketTierInput): string | null {
  if (!tier.name || !tier.name.trim()) {
    return "Ticket name is required";
  }

  if (
    typeof tier.price !== "number" ||
    Number.isNaN(tier.price) ||
    tier.price < 0
  ) {
    return "Ticket price must be a valid non-negative number";
  }

  if (
    tier.quantity !== null &&
    tier.quantity !== undefined &&
    (!Number.isInteger(tier.quantity) || tier.quantity <= 0)
  ) {
    return "Ticket quantity must be a positive integer when provided";
  }

  // Validate offer window if any offer field is provided
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

/** Validates event-level capacity (total tickets). */
export function validateEventCapacity(capacity: unknown): string | null {
  if (capacity === null || capacity === undefined) return null;
  if (
    typeof capacity !== "number" ||
    !Number.isInteger(capacity) ||
    capacity <= 0
  ) {
    return "Event capacity must be a positive integer when provided";
  }
  return null;
}
