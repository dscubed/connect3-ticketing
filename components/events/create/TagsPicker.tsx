"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Plus } from "lucide-react";
import { TagPill } from "../shared/EventPills";
import type { EditInputProps } from "../shared/types";

const AVAILABLE_TAGS = [
  "Free",
  "Paid",
  "Food & Drinks",
  "Outdoor",
  "Indoor",
  "Live Music",
  "Networking",
  "Career",
  "Party",
  "Cultural",
  "Competition",
  "Charity",
  "Tech",
  "Study",
] as const;

type TagsPickerProps = EditInputProps<string[]>;

export function TagsPicker({ value, onChange }: TagsPickerProps) {
  const [open, setOpen] = useState(false);

  const toggleTag = (tag: string) => {
    if (value.includes(tag)) {
      onChange(value.filter((t) => t !== tag));
    } else {
      onChange([...value, tag]);
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Selected tag pills */}
      {value.map((tag) => (
        <TagPill key={tag} tag={tag} onRemove={() => removeTag(tag)} />
      ))}

      {/* Add tag button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1" align="start">
          <div className="max-h-52 overflow-y-auto">
            {AVAILABLE_TAGS.map((tag) => {
              const selected = value.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="flex w-full items-center justify-between rounded-sm px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  {tag}
                  {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
