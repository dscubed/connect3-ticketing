"use client";

import { TagsPicker } from "../create/TagsPicker";
import { TagsDisplay } from "../preview/TagsDisplay";

interface EventTagsFieldProps {
  mode: "edit" | "preview";
  value: string[];
  onChange?: (value: string[]) => void;
}

export function EventTagsField({ mode, value, onChange }: EventTagsFieldProps) {
  if (mode === "preview") return <TagsDisplay value={value} />;
  return <TagsPicker value={value} onChange={onChange ?? (() => {})} />;
}
