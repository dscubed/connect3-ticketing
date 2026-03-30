"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

interface UseEventTicketingOptions {
  eventId: string | undefined;
  initialEnabled?: boolean;
  /** Number of ticket tiers — enable is blocked when 0. */
  pricingCount?: number;
}

/**
 * Manages ticketing enable/disable state.
 * Shared between EventForm and CheckoutForm.
 */
export function useEventTicketing({
  eventId,
  initialEnabled = false,
  pricingCount = 0,
}: UseEventTicketingOptions) {
  const [ticketingEnabled, setTicketingEnabled] = useState(initialEnabled);
  const [ticketingChanging, setTicketingChanging] = useState(false);

  const enableTicketing = useCallback(async () => {
    if (!eventId) return;
    if (pricingCount === 0) {
      toast.error("Add at least one ticket tier before enabling ticketing.");
      return;
    }
    setTicketingChanging(true);
    try {
      const res = await fetch(`/api/events/${eventId}/ticketing`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      setTicketingEnabled(true);
      toast.success("Ticketing enabled!");
    } catch {
      toast.error("Failed to enable ticketing.");
    } finally {
      setTicketingChanging(false);
    }
  }, [eventId, pricingCount]);

  const disableTicketing = useCallback(async () => {
    if (!eventId) return;
    setTicketingChanging(true);
    try {
      const res = await fetch(`/api/events/${eventId}/ticketing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      if (!res.ok) throw new Error("Failed");
      setTicketingEnabled(false);
      toast.success("Ticketing disabled.");
    } catch {
      toast.error("Failed to disable ticketing.");
    } finally {
      setTicketingChanging(false);
    }
  }, [eventId]);

  return {
    ticketingEnabled,
    setTicketingEnabled,
    ticketingChanging,
    enableTicketing,
    disableTicketing,
  };
}
