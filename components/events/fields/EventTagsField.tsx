"use client";

import { TagsPicker } from "../create/TagsPicker";
import { TagsDisplay } from "../preview/TagsDisplay";
import { useEventEditor } from "../shared/EventEditorContext";

export function EventTagsField() {
  const { viewMode: mode, form, updateField } = useEventEditor();
  if (mode === "preview") return <TagsDisplay value={form.tags} />;
  return <TagsPicker value={form.tags} onChange={(v) => updateField("tags", v)} />;
}
