"use client";

import type { LocationData } from "../shared/types";
import { LocationPicker } from "../create/LocationPicker";
import { LocationDisplay } from "../preview/LocationDisplay";

interface EventLocationFieldProps {
  mode: "edit" | "preview";
  value: LocationData;
  onChange?: (value: LocationData) => void;
}

export function EventLocationField({
  mode,
  value,
  onChange,
}: EventLocationFieldProps) {
  if (mode === "preview") return <LocationDisplay value={value} />;
  return <LocationPicker value={value} onChange={onChange ?? (() => {})} />;
}
