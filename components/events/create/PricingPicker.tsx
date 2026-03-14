"use client";

import { useState } from "react";
import { Tags } from "lucide-react";
import { PricingModal } from "./PricingModal";
import type { TicketTier, EditInputProps } from "../shared/types";
import { formatPricingLabel } from "../shared/pricingUtils";

interface PricingPickerProps extends EditInputProps<TicketTier[]> {
  eventCapacity?: number | null;
  onEventCapacityChange?: (cap: number | null) => void;
  eventStartDate?: string;
  eventStartTime?: string;
  /** Called after tiers are saved — use to immediately flush pending auto-saves */
  onAfterSave?: () => void;
  modalOpen?: boolean;
  onModalOpenChange?: (open: boolean) => void;
  /** Whether ticketing is initialized */
  ticketingEnabled: boolean;
}

/**
 * Inline pricing display that opens a modal to manage ticket tiers.
 * Uses the Tags icon. Shows "Free", "$5", or "$5 – $10" depending on tiers.
 */
export function PricingPicker({
  value,
  onChange,
  eventCapacity,
  onEventCapacityChange,
  eventStartDate,
  eventStartTime,
  onAfterSave,
  modalOpen: controlledModalOpen,
  onModalOpenChange,
  ticketingEnabled,
}: PricingPickerProps) {
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const modalOpen = controlledModalOpen ?? internalModalOpen;
  const setModalOpen = onModalOpenChange ?? setInternalModalOpen;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="group flex items-center gap-3 rounded-md transition-colors hover:bg-muted/60 -ml-2 px-2 py-1"
      >
        <Tags className="h-5 w-5 shrink-0 text-muted-foreground" />
        <span className="text-base text-muted-foreground group-hover:text-foreground transition-colors">
          {formatPricingLabel(value)}
        </span>
      </button>

      <PricingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        value={value}
        eventCapacity={eventCapacity}
        eventStartDate={eventStartDate}
        eventStartTime={eventStartTime}
        onSave={(tiers, cap) => {
          onChange(tiers);
          onEventCapacityChange?.(cap);
          onAfterSave?.();
        }}
        ticketingEnabled={ticketingEnabled}
      />
    </>
  );
}
