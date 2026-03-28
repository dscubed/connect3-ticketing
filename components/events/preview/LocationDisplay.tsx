"use client";

import { MapPin } from "lucide-react";
import type { LocationData, PreviewInputProps } from "../shared/types";

type LocationDisplayProps = PreviewInputProps<LocationData> & {
  /** Number of additional venues beyond the displayed one */
  extraVenues?: number;
};

/** Read-only location display — shows name + address, or "TBA" when empty. */
export function LocationDisplay({ value, extraVenues = 0 }: LocationDisplayProps) {
  const hasValue = !!value.displayName;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      {hasValue ? (
        <div className="flex min-w-0 flex-col gap-0.5 max-w-full">
          <span className="truncate text-sm font-medium sm:text-base">
            {value.displayName}
            {extraVenues > 0 && (
              <span className="ml-1 font-normal text-muted-foreground">
                + {extraVenues} more
              </span>
            )}
          </span>
          {value.address && extraVenues === 0 && (
            <span className="truncate text-xs text-muted-foreground sm:text-sm">
              {value.address}
            </span>
          )}
        </div>
      ) : (
        <span className="text-base text-muted-foreground">TBA</span>
      )}
    </div>
  );
}
