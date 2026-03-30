"use client";

import { LinksPicker } from "../create/LinksPicker";
import { LinksDisplay } from "../preview/LinksDisplay";
import { useEventEditor } from "../shared/EventEditorContext";

export function EventLinksField() {
  const { viewMode: mode, form, updateField } = useEventEditor();
  if (mode === "preview") return <LinksDisplay value={form.links} />;
  return <LinksPicker value={form.links} onChange={(v) => updateField("links", v)} />;
}
