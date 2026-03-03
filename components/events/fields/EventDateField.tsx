"use client";

import type { DateTimeData } from "../shared/types";
import { DatePicker } from "../create/DatePicker";
import { DateDisplay } from "../preview/DateDisplay";

interface EventDateFieldProps {
  mode: "edit" | "preview";
  value: DateTimeData;
  onChange?: (value: DateTimeData) => void;
}

export function EventDateField({ mode, value, onChange }: EventDateFieldProps) {
  if (mode === "preview") return <DateDisplay value={value} />;
  return <DatePicker value={value} onChange={onChange ?? (() => {})} />;
}
