"use client";

import type { TicketTier } from "../shared/types";
import { PricingPicker } from "../create/PricingPicker";
import { PricingDisplay } from "../preview/PricingDisplay";

interface EventPricingFieldProps {
  mode: "edit" | "preview";
  value: TicketTier[];
  onChange?: (value: TicketTier[]) => void;
}

export function EventPricingField({
  mode,
  value,
  onChange,
}: EventPricingFieldProps) {
  if (mode === "preview") return <PricingDisplay value={value} />;
  return <PricingPicker value={value} onChange={onChange ?? (() => {})} />;
}
