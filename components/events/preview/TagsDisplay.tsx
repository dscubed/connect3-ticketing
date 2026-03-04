"use client";

import { useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { TagPill } from "../shared/EventPills";
import type { PreviewInputProps } from "../shared/types";

type TagsDisplayProps = PreviewInputProps<string[]>;

/** Read-only tags display — truncates to 2 (mobile) or 4 (desktop) with a +N badge. */
export function TagsDisplay({ value }: TagsDisplayProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const limit = isMobile ? 2 : 4;
  const visible = value.slice(0, limit);
  const overflow = value.length - limit;

  if (value.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm text-muted-foreground">No tags selected</span>
      </div>
    );
  }

  const overflowBadge = overflow > 0 && (
    <span
      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-foreground/20 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      onClick={() => isMobile && setIsOpen(true)}
    >
      +{overflow}
    </span>
  );

  const allTags = (
    <div className="flex flex-wrap gap-1.5">
      {value.map((tag) => (
        <TagPill key={tag} tag={tag} />
      ))}
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((tag) => (
        <TagPill key={tag} tag={tag} />
      ))}

      {overflow > 0 &&
        (isMobile ? (
          <>
            {overflowBadge}
            <ResponsiveModal
              open={isOpen}
              onOpenChange={setIsOpen}
              title="Tags"
            >
              {allTags}
            </ResponsiveModal>
          </>
        ) : (
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>{overflowBadge}</HoverCardTrigger>
            <HoverCardContent className="w-auto max-w-xs p-3" align="start">
              {allTags}
            </HoverCardContent>
          </HoverCard>
        ))}
    </div>
  );
}
