"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ThemeAccent } from "@/components/events/shared/types";
import { TooltipContent, TooltipTrigger, Tooltip } from "../ui/tooltip";
import { toast } from "sonner";

/* ── Accent → solid colour mapping ── */
const ACCENT_SOLID_MAP: Record<
  Exclude<ThemeAccent, "none" | "custom">,
  string
> = {
  yellow: "#eab308",
  cyan: "#06b6d4",
  purple: "#a855f7",
  orange: "#f97316",
  green: "#22c55e",
};

function getAccentButtonStyle(
  accent: ThemeAccent,
  customHex?: string,
): React.CSSProperties | undefined {
  if (accent === "none") return undefined;
  if (accent === "custom") {
    const hex = customHex || "#888888";
    return { backgroundColor: hex, color: "#fff", borderColor: hex };
  }
  const color = ACCENT_SOLID_MAP[accent];
  return { backgroundColor: color, color: "#fff", borderColor: color };
}

interface TicketingButtonProps {
  eventId: string;
  /** "edit" = shows "Setup Ticketing"; "preview" = shows "Get Tickets" or hidden */
  mode: "edit" | "preview";
  accent?: ThemeAccent;
  accentCustom?: string;
  isDark?: boolean;
  draft?: boolean;
  /** Whether the event has at least one ticket tier. Defaults to true. */
  hasTiers?: boolean;
  /** Whether the button is in edit form. Defaults to false. */
  editor?: boolean;
  /** Callback fired when the button is clicked but has no tiers */
  onNoTiersClick?: () => void;
  /** Whether ticketing is initialized */
  ticketingEnabled?: boolean | null;
}

/**
 * Sticky bottom button for ticketing.
 *
 * Desktop: centered card-style container that blends with the theme.
 * Mobile:  full-width sticky footer bar.
 */
export function TicketingButton({
  eventId,
  mode,
  accent = "none",
  accentCustom,
  isDark = false,
  draft = false,
  hasTiers = true,
  editor = false,
  onNoTiersClick,
  ticketingEnabled = null,
}: TicketingButtonProps) {
  const router = useRouter();

  // Track our own state only if null is provided
  const [fetchedTicketingEnabled, setFetchedTicketingEnabled] = useState<
    boolean | null
  >(null);
  const [didFetch, setDidFetch] = useState(false);

  useEffect(() => {
    // If the prop is explicitly set, we do not need to fetch.
    if (ticketingEnabled !== null) {
      return;
    }

    if (didFetch) return;

    // Only fetch if not provided via props
    let isMounted = true;
    fetch(`/api/events/${eventId}/ticketing`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted) {
          setFetchedTicketingEnabled(!!json.data?.ticketing?.enabled);
          setDidFetch(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setFetchedTicketingEnabled(false);
          setDidFetch(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [eventId, ticketingEnabled, didFetch]);

  // Use the prop if valid, otherwise fallback to the fetched state
  const finalTicketingEnabled =
    ticketingEnabled !== null ? ticketingEnabled : fetchedTicketingEnabled;
  if (finalTicketingEnabled === null && mode === "edit") {
    // We only show a loading state if we're in edit mode.
    return null;
  }
  const isSetUp = finalTicketingEnabled === true;

  /* Preview mode: only show if ticketing is set up */
  if (mode === "preview" && !isSetUp) return null;

  const label =
    mode === "edit"
      ? isSetUp
        ? "Edit Checkout"
        : "Setup Ticketing"
      : "Get Tickets";

  const accentStyle = getAccentButtonStyle(accent, accentCustom);
  const loading = finalTicketingEnabled === null;
  const disabled = loading || (mode === "preview" && draft);
  const tooltip = !hasTiers
    ? "Add at least one ticket tier to enable checkout"
    : draft
      ? "Publish your event to enable checkout"
      : undefined;

  const handleClick = () => {
    if (!hasTiers) {
      if (onNoTiersClick) {
        onNoTiersClick();
      } else {
        toast.error(
          editor
            ? "Add at least one ticket tier to enable checkout"
            : "Event has no tickets",
        );
      }
      return;
    }

    if (editor) {
      router.push(`/events/${eventId}/checkout/edit`);
    } else {
      router.push(`/events/${eventId}/checkout`);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full">
            {/* Mobile: full-width footer bar */}
            <div
              className={cn(
                "flex w-full items-center justify-center border-t px-4 py-3 backdrop-blur-xl sm:hidden",
                isDark
                  ? "bg-neutral-800/90 border-neutral-700"
                  : "bg-background/90 border-border",
              )}
            >
              <Button
                size="lg"
                className={cn(
                  "w-full gap-2 rounded-lg",
                  !accentStyle &&
                    "bg-foreground text-background hover:bg-foreground/90",
                )}
                style={accentStyle}
                onClick={handleClick}
                disabled={disabled}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
              </Button>
            </div>

            {/* Desktop: card-style pill */}
            <div
              className={cn(
                "hidden sm:block rounded-xl border px-3 py-2 shadow-lg backdrop-blur-xl",
                isDark
                  ? "bg-neutral-800/80 border-neutral-700/60"
                  : "bg-background/80 border-border/60",
              )}
            >
              <Button
                size="lg"
                className={cn(
                  "gap-2 rounded-lg px-10",
                  !accentStyle &&
                    "bg-foreground text-background hover:bg-foreground/90",
                )}
                style={accentStyle}
                onClick={handleClick}
                disabled={disabled}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
              </Button>
            </div>
          </div>
        </TooltipTrigger>
        {tooltip && <TooltipContent sideOffset={4}>{tooltip}</TooltipContent>}
      </Tooltip>
    </div>
  );
}
