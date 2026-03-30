"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { format, parseISO } from "date-fns";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CalendarDays, MapPin, Globe, ExternalLink } from "lucide-react";
import type { DateTimeData, OccurrenceFormData, Venue } from "../shared/types";
import { useEventEditor } from "../shared/EventEditorContext";

const LocationMap = dynamic(
  () =>
    import("../create/LocationMap").then((mod) => ({
      default: mod.LocationMap,
    })),
  { ssr: false },
);

/* ── Helpers ── */

function formatTime12(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDateFull(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "EEEE do MMMM yyyy");
  } catch {
    return dateStr;
  }
}

function formatTimeRange(startTime: string, endTime: string): string {
  const s = formatTime12(startTime);
  const e = formatTime12(endTime);
  if (s && e) return `${s} – ${e}`;
  if (s) return s;
  return "All day";
}

function getTzAbbrev(timezone: string): string {
  if (!timezone) return "";
  try {
    const parts = new Date()
      .toLocaleString("en-AU", { timeZone: timezone, timeZoneName: "short" })
      .split(/\s/);
    return parts[parts.length - 1] ?? "";
  } catch {
    return "";
  }
}

/* ── Collapsible Venue Detail ── */

function VenueAccordionItem({
  venue,
  itemValue,
}: {
  venue: Venue;
  itemValue: string;
}) {
  const hasCoords =
    venue.location.lat != null &&
    venue.location.lon != null &&
    !isNaN(venue.location.lat) &&
    !isNaN(venue.location.lon);

  if (venue.type === "online") {
    return (
      <AccordionItem value={itemValue} className="border-b-0">
        <AccordionTrigger className="py-2 text-sm hover:no-underline">
          <div className="flex items-center gap-2 text-left">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">Online</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-2 pl-6">
          {venue.onlineLink && (
            <a
              href={venue.onlineLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline break-all"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              {venue.onlineLink}
            </a>
          )}
        </AccordionContent>
      </AccordionItem>
    );
  }

  if (venue.type === "tba") {
    return (
      <div className="flex items-center gap-2 py-2 pl-0.5">
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Location to be announced
        </span>
      </div>
    );
  }

  // Physical / custom venue — collapsible to show map
  return (
    <AccordionItem value={itemValue} className="border-b-0">
      <AccordionTrigger className="py-2 text-sm hover:no-underline">
        <div className="flex items-center gap-2 text-left min-w-0">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <span className="font-medium truncate block">
              {venue.location.displayName || "Unnamed venue"}
            </span>
            {venue.location.address && (
              <span className="text-xs text-muted-foreground truncate block">
                {venue.location.address}
              </span>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-2">
        {hasCoords && (
          <LocationMap
            lat={venue.location.lat!}
            lon={venue.location.lon!}
            height={160}
            className="rounded-md overflow-hidden"
          />
        )}
        {!hasCoords && venue.location.address && (
          <p className="text-xs text-muted-foreground pl-6">
            {venue.location.address}
          </p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

/* ── Inline venue list (non-collapsible, for inside occurrence items) ── */

function VenueInlineList({ venues }: { venues: Venue[] }) {
  return (
    <Accordion type="multiple" className="w-full">
      {venues.map((v) => (
        <VenueAccordionItem key={v.id} venue={v} itemValue={`inline-${v.id}`} />
      ))}
    </Accordion>
  );
}

/* ── Main export ── */

interface EventDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventDetailModal({ open, onOpenChange }: EventDetailModalProps) {
  const { form } = useEventEditor();
  const dateTime: DateTimeData = {
    startDate: form.startDate,
    startTime: form.startTime,
    endDate: form.endDate,
    endTime: form.endTime,
    timezone: form.timezone,
  };
  const venues: Venue[] = form.venues;
  const occurrences: OccurrenceFormData[] = form.occurrences;
  const realVenues = useMemo(
    () => venues.filter((v) => v.type !== "tba"),
    [venues],
  );
  const displayVenues = realVenues.length > 0 ? realVenues : venues;

  // If no occurrences exist, synthesize one from dateTime for backward compat
  const effectiveOccurrences = useMemo(() => {
    if (occurrences.length > 0) return occurrences;
    if (!dateTime.startDate) return [];
    return [
      {
        id: "legacy-single",
        startDate: dateTime.startDate,
        startTime: dateTime.startTime,
        endDate: dateTime.endDate,
        endTime: dateTime.endTime,
      },
    ] as OccurrenceFormData[];
  }, [occurrences, dateTime]);

  const sortedOccurrences = useMemo(
    () =>
      [...effectiveOccurrences].sort(
        (a, b) =>
          a.startDate.localeCompare(b.startDate) ||
          a.startTime.localeCompare(b.startTime),
      ),
    [effectiveOccurrences],
  );

  const venueMap = useMemo(() => {
    const m = new Map<string, Venue>();
    for (const v of venues) m.set(v.id, v);
    return m;
  }, [venues]);

  const tzAbbrev = getTzAbbrev(dateTime.timezone);

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Event details"
      className="max-w-lg"
    >
      <div className="overflow-y-auto max-h-[70vh] pr-1">
        {sortedOccurrences.length === 0 ? (
          /* No date info at all */
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Date to be announced
              </p>
            </div>
            <Accordion type="multiple" className="w-full">
              {displayVenues.map((v) => (
                <VenueAccordionItem key={v.id} venue={v} itemValue={v.id} />
              ))}
            </Accordion>
          </div>
        ) : (
          /* Occurrence-based accordion — works for 1 or many */
          <Accordion
            type="multiple"
            defaultValue={
              sortedOccurrences.length === 1 ? [sortedOccurrences[0].id] : []
            }
            className="w-full"
          >
            {sortedOccurrences.map((occ, i) => {
              const occVenueIds = occ.venueIds ?? [];
              const occVenues = occVenueIds
                .map((vid) => venueMap.get(vid))
                .filter(Boolean) as Venue[];
              // If occurrence has no specific venues, show all event venues
              const shownVenues =
                occVenues.length > 0 ? occVenues : displayVenues;

              return (
                <AccordionItem key={occ.id} value={occ.id}>
                  <AccordionTrigger className="py-2.5 text-sm hover:no-underline">
                    <div className="flex items-center gap-2 text-left">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium shrink-0">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="font-semibold block truncate">
                          {occ.name && `${occ.name} - `}
                          {formatDateFull(occ.startDate)}
                        </span>
                        <span className="text-xs text-muted-foreground block">
                          {formatTimeRange(occ.startTime, occ.endTime)}
                          {tzAbbrev && ` ${tzAbbrev}`}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 pl-7">
                    {occ.endDate && occ.endDate !== occ.startDate && (
                      <p className="mb-2 text-xs text-muted-foreground">
                        Ends {formatDateFull(occ.endDate)}
                      </p>
                    )}
                    {/* Venues inside this occurrence — collapsible for maps */}
                    <VenueInlineList venues={shownVenues} />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </ResponsiveModal>
  );
}
