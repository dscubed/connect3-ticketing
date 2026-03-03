"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Plus,
  HelpCircle,
  Backpack,
  Mic,
  Building2,
  Check,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SECTION_TYPES, SECTION_META, type SectionType } from "./types";

const ICON_MAP: Record<SectionType, React.ElementType> = {
  faq: HelpCircle,
  "what-to-bring": Backpack,
  panelists: Mic,
  companies: Building2,
};

interface AddSectionButtonProps {
  /** Section types already added (greyed out / disabled) */
  activeSections: SectionType[];
  onAdd: (type: SectionType) => void;
  /** Show a pinging blue dot on the button */
  showAttentionBadge?: boolean;
  isDark?: boolean;
}

export function AddSectionButton({
  activeSections,
  onAdd,
  showAttentionBadge,
  isDark,
}: AddSectionButtonProps) {
  const [open, setOpen] = useState(false);

  const availableTypes = SECTION_TYPES.filter(
    (t) => !activeSections.includes(t),
  );

  // Nothing left to add
  if (availableTypes.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          {showAttentionBadge && (
            <span className="absolute -right-1 -top-1 z-10 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
            </span>
          )}
          <Button
            variant="outline"
            className={cn(
              "w-full gap-2",
              isDark &&
                "border-neutral-600 text-neutral-300 hover:bg-neutral-700 hover:text-white",
            )}
          >
            <Plus className="h-4 w-4" />
            Add Section
          </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-64 p-1",
          isDark && "border-neutral-700 bg-neutral-800",
        )}
        align="center"
      >
        {SECTION_TYPES.map((type) => {
          const meta = SECTION_META[type];
          const Icon = ICON_MAP[type];
          const alreadyAdded = activeSections.includes(type);

          return (
            <button
              key={type}
              type="button"
              disabled={alreadyAdded}
              onClick={() => {
                onAdd(type);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                isDark
                  ? "hover:bg-neutral-700 text-neutral-100"
                  : "hover:bg-muted",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isDark ? "text-neutral-400" : "text-muted-foreground",
                )}
              />
              <div className="flex-1">
                <div className="font-medium">{meta.label}</div>
                <div
                  className={cn(
                    "text-xs",
                    isDark ? "text-neutral-400" : "text-muted-foreground",
                  )}
                >
                  {meta.description}
                </div>
              </div>
              {alreadyAdded && (
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isDark ? "text-neutral-400" : "text-muted-foreground",
                  )}
                />
              )}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
