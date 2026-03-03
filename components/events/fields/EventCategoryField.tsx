"use client";

import { CategoryPicker } from "../create/CategoryPicker";
import { CategoryDisplay } from "../preview/CategoryDisplay";

interface EventCategoryFieldProps {
  mode: "edit" | "preview";
  value: string;
  onChange?: (value: string) => void;
}

export function EventCategoryField({
  mode,
  value,
  onChange,
}: EventCategoryFieldProps) {
  if (mode === "preview") return <CategoryDisplay value={value} />;
  return <CategoryPicker value={value} onChange={onChange ?? (() => {})} />;
}
