import { MapPin } from "lucide-react";
import type { LocationData, PreviewInputProps } from "../shared/types";

type LocationDisplayProps = PreviewInputProps<LocationData>;

/** Read-only location display — shows name + address, or "TBA" when empty. */
export function LocationDisplay({ value }: LocationDisplayProps) {
  const hasValue = !!value.displayName;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" />
      {hasValue ? (
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 text-base font-medium">
            {value.displayName}
          </span>
          {value.address && (
            <span className="truncate text-sm text-muted-foreground">
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
