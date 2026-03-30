"use client";

import { PricingPicker } from "../create/PricingPicker";
import { PricingDisplay } from "../preview/PricingDisplay";
import { useEventEditor } from "../shared/EventEditorContext";

interface EventPricingFieldProps {
  onAfterSave?: () => void;
  modalOpen?: boolean;
  onModalOpenChange?: (open: boolean) => void;
}

export function EventPricingField({
  onAfterSave,
  modalOpen,
  onModalOpenChange,
}: EventPricingFieldProps) {
  const { viewMode: mode, form, updateField, ticketingEnabled } = useEventEditor();

  if (mode === "preview") return <PricingDisplay value={form.pricing} />;

  return (
    <PricingPicker
      value={form.pricing}
      onChange={(tiers) => updateField("pricing", tiers)}
      eventCapacity={form.eventCapacity}
      onEventCapacityChange={(cap) => updateField("eventCapacity", cap)}
      eventStartDate={form.startDate}
      eventStartTime={form.startTime}
      onAfterSave={onAfterSave}
      modalOpen={modalOpen}
      onModalOpenChange={onModalOpenChange}
      ticketingEnabled={ticketingEnabled}
    />
  );
}
