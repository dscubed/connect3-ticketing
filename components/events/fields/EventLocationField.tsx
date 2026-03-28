"use client";

import type { LocationData } from "../shared/types";
import { LocationPicker } from "../create/LocationPicker";
import { LocationDisplay } from "../preview/LocationDisplay";

interface EventLocationFieldProps {
  mode: "edit" | "preview";
  value: LocationData;
  onChange?: (value: LocationData) => void;
  /** Number of additional venues beyond the displayed one */
  extraVenues?: number;
}

export function EventLocationField({
  mode,
  value,
  onChange,
  extraVenues,
}: EventLocationFieldProps) {
  if (mode === "preview")
    return <LocationDisplay value={value} extraVenues={extraVenues} />;
  return <LocationPicker value={value} onChange={onChange ?? (() => {})} />;
}
