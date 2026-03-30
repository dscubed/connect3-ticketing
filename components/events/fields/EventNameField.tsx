"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEventEditor } from "../shared/EventEditorContext";

export function EventNameField() {
  const { viewMode: mode, form, updateField, colors } = useEventEditor();
  const className = colors.text;

  if (mode === "preview") {
    return (
      <h1
        className={cn(
          "text-2xl font-bold tracking-tight sm:text-4xl truncate",
          className,
        )}
      >
        {form.name || "Untitled Event"}
      </h1>
    );
  }

  return (
    <Input
      placeholder="Event Name"
      value={form.name}
      onChange={(e) => updateField("name", e.target.value)}
      className={cn(
        "h-auto border-0 bg-transparent px-0 text-2xl! font-bold tracking-tight placeholder:text-muted-foreground/40 focus-visible:ring-0 sm:text-4xl!",
        className,
      )}
    />
  );
}
