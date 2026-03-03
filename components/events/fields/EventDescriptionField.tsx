"use client";

import { Textarea } from "@/components/ui/textarea";
import { SectionWrapper } from "../preview/SectionWrapper";
import type { ThemeLayout } from "../shared/types";
import { cn } from "@/lib/utils";

interface EventDescriptionFieldProps {
  mode: "edit" | "preview";
  value: string;
  onChange?: (value: string) => void;
  layout?: ThemeLayout;
  isDark?: boolean;
}

export function EventDescriptionField({
  mode,
  value,
  onChange,
  layout = "card",
  isDark,
}: EventDescriptionFieldProps) {
  return (
    <SectionWrapper title="Event Description" layout={layout} isDark={isDark}>
      {mode === "preview" ? (
        <p
          className={`whitespace-pre-wrap text-sm leading-relaxed ${
            value ? "text-foreground/90" : "italic text-muted-foreground"
          }`}
        >
          {value || "No description provided"}
        </p>
      ) : (
        <Textarea
          placeholder="Tell people what your event is about..."
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          rows={6}
          className={cn(
            "resize-none",
            isDark &&
              "border-neutral-600 bg-neutral-700 text-neutral-100 placeholder:text-neutral-400",
          )}
        />
      )}
    </SectionWrapper>
  );
}
