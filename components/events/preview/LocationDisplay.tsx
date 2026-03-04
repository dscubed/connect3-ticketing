"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { MapPin } from "lucide-react";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import type { LocationData, PreviewInputProps } from "../shared/types";

const LocationMap = dynamic(
  () =>
    import("../create/LocationMap").then((mod) => ({
      default: mod.LocationMap,
    })),
  { ssr: false },
);

type LocationDisplayProps = PreviewInputProps<LocationData>;

/** Read-only location display — shows name + address, or "TBA" when empty. */
export function LocationDisplay({ value }: LocationDisplayProps) {
  const hasValue = !!value.displayName;
  const hasCoords =
    value.lat != null &&
    value.lon != null &&
    !isNaN(value.lat) &&
    !isNaN(value.lon);
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  const content = hasValue ? (
    <div className="flex min-w-0 flex-col gap-0.5 max-w-full">
      <span className="truncate text-sm font-medium sm:text-base">
        {value.displayName}
      </span>
      {value.address && (
        <span className="truncate text-xs text-muted-foreground sm:text-sm">
          {value.address}
        </span>
      )}
    </div>
  ) : (
    <span className="text-base text-muted-foreground">TBA</span>
  );

  const hoverCardBody = (
    <>
      {hasCoords && (
        <LocationMap
          lat={value.lat!}
          lon={value.lon!}
          height={140}
          className="rounded-md overflow-hidden"
        />
      )}
      <p className="text-sm font-medium">{value.displayName}</p>
      {value.address && (
        <p className="mt-0.5 text-xs text-muted-foreground">{value.address}</p>
      )}
      {hasCoords && (
        <p className="mt-0.5 text-[10px] text-muted-foreground/60">
          {value.lat!.toFixed(6)}, {value.lon!.toFixed(6)}
        </p>
      )}
    </>
  );

  return (
    <div className="flex min-w-0 items-center gap-3">
      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      {hasValue ? (
        <HoverCard open={isOpen} onOpenChange={setIsOpen}>
          <HoverCardTrigger asChild>
            <div
              className="min-w-0 cursor-pointer"
              onClick={() => isMobile && setIsOpen(!isOpen)}
            >
              {content}
            </div>
          </HoverCardTrigger>
          <HoverCardContent
            className="mx-8 w-[calc(100vw-4rem)] max-w-sm space-y-2 p-3"
            align="start"
          >
            {hoverCardBody}
          </HoverCardContent>
        </HoverCard>
      ) : (
        content
      )}
    </div>
  );
}
