"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check } from "lucide-react";

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

interface EventCategoryPickerProps {
  value: string;
  onChange: (category: string) => void;
}

export function EventCategoryPicker({
  value,
  onChange,
}: EventCategoryPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
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
      </PopoverContent>
    </Popover>
  );
}
