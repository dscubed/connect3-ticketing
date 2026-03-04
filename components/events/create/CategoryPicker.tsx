"use client";

import { useState } from "react";
import { ResponsivePopover } from "@/components/ui/responsive-popover";
import { Check } from "lucide-react";
import type { EditInputProps } from "../shared/types";

const EVENT_CATEGORIES = [
  "Social",
  "Academic",
  "Sports",
  "Music",
  "Arts & Culture",
  "Networking",
  "Workshop",
  "Fundraiser",
  "Other",
] as const;

type CategoryPickerProps = EditInputProps<string>;

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <ResponsivePopover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          className={`inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors hover:bg-muted ${
            value
              ? "border-foreground/20 font-medium text-foreground"
              : "border-muted-foreground/30 text-muted-foreground"
          }`}
        >
          {value || "Select Category"}
        </button>
      }
      contentClassName="w-44 p-1"
      align="start"
    >
      <div className="overflow-y-auto md:max-h-none">
        {EVENT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              onChange(cat);
              setOpen(false);
            }}
            className="flex w-full items-center justify-between rounded-sm px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted"
          >
            {cat}
            {value === cat && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
        ))}
      </div>
    </ResponsivePopover>
  );
}
