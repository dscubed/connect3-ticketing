"use client";

import { CategoryPicker } from "../create/CategoryPicker";
import { CategoryDisplay } from "../preview/CategoryDisplay";
import { useEventEditor } from "../shared/EventEditorContext";

export function EventCategoryField() {
  const { viewMode: mode, form, updateField } = useEventEditor();
  if (mode === "preview") return <CategoryDisplay value={form.category} />;
  return <CategoryPicker value={form.category} onChange={(v) => updateField("category", v)} />;
}
