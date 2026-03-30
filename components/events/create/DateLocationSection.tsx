"use client";

import { useState, useMemo, useCallback } from "react";
import { nanoid } from "nanoid";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  MapPin,
  Pencil,
  Globe,
  Info,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocationPicker } from "./LocationPicker";
import { OccurrenceEditor } from "./OccurrenceEditor";
import type {
  LocationData,
  LocationType,
  OccurrenceFormData,
  Venue,
} from "../shared/types";
import { useEventEditor } from "../shared/EventEditorContext";

/* ── Timezone helpers ── */
const POPULAR_TIMEZONES = [
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Perth",
  "Australia/Adelaide",
  "Pacific/Auckland",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Pacific/Honolulu",
] as const;

function tzLabel(tz: string): string {
  try {
    const now = new Date();
    const short = now.toLocaleString("en-AU", {
      timeZone: tz,
      timeZoneName: "short",
    });
    const parts = short.split(/\s/);
    const abbrev = parts[parts.length - 1] ?? "";
    const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
    return `${city} (${abbrev})`;
  } catch {
    return tz;
  }
}

/** Format time string HH:MM to h:mm AM/PM */
function formatTime12(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/* ── Venue display helpers ── */
function venueDisplayLabel(venue: Venue): string {
  if (venue.type === "online") return venue.onlineLink || "Online";
  if (venue.type === "tba") return "TBA";
  return venue.location.displayName || "Unnamed venue";
}

function venueTypeLabel(type: LocationType): string {
  switch (type) {
    case "physical":
      return "Physical";
    case "custom":
      return "Custom";
    case "online":
      return "Online";
    case "tba":
      return "TBA";
  }
}

/* ══════════════════════════════════════════════════
   Venue Card
   ══════════════════════════════════════════════════ */

interface VenueCardProps {
  venue: Venue;
  onEdit: () => void;
  onRemove: () => void;
}

function VenueCard({ venue, onEdit, onRemove }: VenueCardProps) {
  return (
    <div className="group flex items-start justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {venue.type === "online" ? (
            <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-sm font-medium">
            {venueDisplayLabel(venue)}
          </span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {venueTypeLabel(venue.type)}
          </span>
        </div>
        {venue.type !== "online" &&
          venue.type !== "tba" &&
          venue.location.address && (
            <p className="mt-0.5 truncate pl-5 text-xs text-muted-foreground">
              {venue.location.address}
            </p>
          )}
      </div>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   Add Venue Panel
   ══════════════════════════════════════════════════ */

interface AddVenuePanelProps {
  onAdd: (venue: Venue) => void;
  onCancel: () => void;
  editingVenue?: Venue | null;
  /** Hide the TBA tab when real venues already exist */
  hideTba?: boolean;
}

function AddVenuePanel({ onAdd, onCancel, editingVenue, hideTba }: AddVenuePanelProps) {
  const [venueType, setVenueType] = useState<LocationType>(
    editingVenue?.type === "tba" && hideTba
      ? "physical"
      : (editingVenue?.type ?? "physical"),
  );
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [locationData, setLocationData] = useState<LocationData>(
    editingVenue?.location ?? { displayName: "", address: "" },
  );
  const [onlineLink, setOnlineLink] = useState(editingVenue?.onlineLink ?? "");

  const handleConfirm = useCallback(() => {
    const venue: Venue = {
      id: editingVenue?.id ?? nanoid(),
      type: venueType,
      location: locationData,
      onlineLink: venueType === "online" ? onlineLink : undefined,
    };
    onAdd(venue);
  }, [editingVenue, venueType, locationData, onlineLink, onAdd]);

  const canConfirm =
    venueType === "tba" || venueType === "online"
      ? !!onlineLink.trim()
      : !!locationData.displayName.trim();

  return (
    <div className="space-y-3 rounded-md border border-dashed p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">
          {editingVenue ? "Edit venue" : "Add venue"}
        </Label>
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <Tabs
        value={venueType}
        onValueChange={(v) => setVenueType(v as LocationType)}
      >
        <TabsList className="w-full">
          <TabsTrigger value="physical" className="flex-1 text-xs">
            Physical
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex-1 text-xs">
            Custom
          </TabsTrigger>
          <TabsTrigger value="online" className="flex-1 text-xs">
            Online
          </TabsTrigger>
          {!hideTba && (
            <TabsTrigger value="tba" className="flex-1 text-xs">
              TBA
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="physical" className="mt-3 space-y-2">
          {locationData.displayName ? (
            <div className="flex items-start justify-between gap-2 rounded-md border bg-muted/50 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {locationData.displayName}
                </p>
                {locationData.address && (
                  <p className="truncate text-xs text-muted-foreground">
                    {locationData.address}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocationPickerOpen(true)}
              >
                Change
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocationPickerOpen(true)}
            >
              <MapPin className="mr-1.5 h-3.5 w-3.5" />
              Search location
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Search for an address or paste a Google Maps link.
          </p>
        </TabsContent>

        <TabsContent value="custom" className="mt-3 space-y-3">
          <div>
            <Label className="text-xs">Venue name</Label>
            <Input
              className="mt-1"
              placeholder="e.g. Town Hall Room 3"
              value={locationData.displayName}
              onChange={(e) =>
                setLocationData({
                  ...locationData,
                  displayName: e.target.value,
                  lat: undefined,
                  lon: undefined,
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Address (optional)</Label>
            <Input
              className="mt-1"
              placeholder="e.g. 123 Main St, Sydney"
              value={locationData.address}
              onChange={(e) =>
                setLocationData({
                  ...locationData,
                  address: e.target.value,
                  lat: undefined,
                  lon: undefined,
                })
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="online" className="mt-3 space-y-3">
          <div>
            <Label className="text-xs">Meeting link</Label>
            <div className="mt-1 flex items-center gap-2">
              <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                placeholder="e.g. https://zoom.us/j/123456789"
                value={onlineLink}
                onChange={(e) => setOnlineLink(e.target.value)}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tba" className="mt-3">
          <p className="text-sm text-muted-foreground">
            Location will be announced later.
          </p>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={venueType !== "tba" && !canConfirm}
        >
          {editingVenue ? "Update" : "Add"}
        </Button>
      </div>

      {/* Location picker modal for physical venues */}
      <LocationPicker
        open={locationPickerOpen}
        onOpenChange={setLocationPickerOpen}
        value={locationData}
        onChange={(loc) => {
          setLocationData(loc);
          setLocationPickerOpen(false);
        }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════
   DateLocationSection (main export)
   ══════════════════════════════════════════════════ */

export function DateLocationSection() {
  const { form, setForm, markDirty } = useEventEditor();
  const { timezone, occurrences, locationType, location, onlineLink, venues } = form;

  const onTimezoneChange = (tz: string) => {
    setForm((prev) => ({ ...prev, timezone: tz }));
    markDirty("event", "location");
  };

  const onLocationChange = (partial: {
    locationType?: LocationType;
    location?: LocationData;
    onlineLink?: string;
  }) => {
    setForm((prev) => ({
      ...prev,
      ...partial,
      isOnline: (partial.locationType ?? prev.locationType) === "online",
    }));
    markDirty("event", "location");
  };

  const onVenuesChange = (updated: Venue[]) => {
    setForm((prev) => ({ ...prev, venues: updated }));
    markDirty("event", "location");
  };

  const onOccurrencesChange = (occs: OccurrenceFormData[]) => {
    const sorted = [...occs].sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        a.startTime.localeCompare(b.startTime),
    );
    const first = sorted[0];
    setForm((prev) => ({
      ...prev,
      occurrences: occs,
      isRecurring: occs.length > 1,
      startDate: first?.startDate ?? "",
      startTime: first?.startTime ?? "",
      endDate: first?.endDate ?? "",
      endTime: first?.endTime ?? "",
    }));
    markDirty("event", "occurrences", "location");
  };
  const [occEditorOpen, setOccEditorOpen] = useState(false);
  const [addingVenue, setAddingVenue] = useState(false);
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);

  /* ── Occurrence summary ── */
  const occurrenceSummary = useMemo(() => {
    if (occurrences.length === 0) return null;
    const sorted = [...occurrences].sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
    const first = sorted[0];
    try {
      const d = parseISO(first.startDate);
      const dateStr = format(d, "EEE do MMM yyyy");
      const timeStr = formatTime12(first.startTime);
      const label = first.name ? `${first.name} — ${dateStr}` : `${dateStr}, ${timeStr}`;
      const rest = sorted.length - 1;
      return `${label}${rest > 0 ? ` + ${rest} more` : ""}`;
    } catch {
      return `${sorted.length} occurrence${sorted.length !== 1 ? "s" : ""}`;
    }
  }, [occurrences]);

  const editingVenue = editingVenueId
    ? (venues.find((v) => v.id === editingVenueId) ?? null)
    : null;

  /* ── Venue CRUD ── */
  const handleAddVenue = useCallback(
    (venue: Venue) => {
      let updated: Venue[];
      if (editingVenueId) {
        // Update existing
        updated = venues.map((v) => (v.id === venue.id ? venue : v));
        setEditingVenueId(null);
      } else {
        // Add new
        updated = [...venues, venue];
      }
      // Auto-remove TBA venues when a real venue is added/updated
      if (venue.type !== "tba") {
        updated = updated.filter((v) => v.type !== "tba" || v.id === venue.id);
      }
      onVenuesChange(updated);
      setAddingVenue(false);

      // Sync primary location from first physical/custom venue for backward compat
      syncPrimaryLocation(updated);
    },
    [editingVenueId, venues, onVenuesChange],
  );

  const handleRemoveVenue = useCallback(
    (id: string) => {
      let updated = venues.filter((v) => v.id !== id);
      // Always keep at least one venue — replace with TBA if empty
      if (updated.length === 0) {
        updated = [
          {
            id: nanoid(),
            type: "tba" as LocationType,
            location: { displayName: "", address: "" },
          },
        ];
      }
      onVenuesChange(updated);
      // Also remove venue references from occurrences
      const updatedOccs = occurrences.map((occ) =>
        occ.venueIds?.includes(id)
          ? { ...occ, venueIds: occ.venueIds.filter((vid) => vid !== id) }
          : occ,
      );
      onOccurrencesChange(updatedOccs);
      syncPrimaryLocation(updated);
    },
    [venues, occurrences, onVenuesChange, onOccurrencesChange],
  );

  /** Keep the legacy single-location fields in sync with the first relevant venue */
  function syncPrimaryLocation(updatedVenues: Venue[]) {
    const physical = updatedVenues.find(
      (v) => v.type === "physical" || v.type === "custom",
    );
    const online = updatedVenues.find((v) => v.type === "online");

    if (physical) {
      onLocationChange({
        locationType: physical.type,
        location: physical.location,
        onlineLink: online?.onlineLink ?? onlineLink,
      });
    } else if (online) {
      onLocationChange({
        locationType: "online",
        location: { displayName: "", address: "" },
        onlineLink: online.onlineLink ?? "",
      });
    } else if (updatedVenues.length === 0) {
      onLocationChange({
        locationType: "tba",
        location: { displayName: "", address: "" },
        onlineLink: "",
      });
    }
  }

  return (
    <div className="space-y-5 pt-4">
      {/* ═══════════════════ DATE & TIME ═══════════════════ */}
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          Date &amp; time
        </h3>

        {/* Timezone */}
        <div>
          <Label className="text-xs text-muted-foreground">Timezone</Label>
          <Select
            value={timezone}
            onValueChange={onTimezoneChange}
          >
            <SelectTrigger className="mt-1 w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POPULAR_TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tzLabel(tz)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Occurrences summary / editor trigger */}
        <div className="space-y-2">
          {occurrences.length > 0 ? (
            <button
              type="button"
              onClick={() => setOccEditorOpen(true)}
              className="flex w-full items-center gap-2 rounded-md border bg-muted/50 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
            >
              <span className="flex-1">{occurrenceSummary}</span>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOccEditorOpen(true)}
            >
              Add date &amp; time
            </Button>
          )}
          {occurrences.length > 1 && (
            <div className="flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Ticket types, prices, and capacities will apply to all
                occurrences.
              </span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* ═══════════════════ VENUES ═══════════════════ */}
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Venues
        </h3>

        {/* Venue list */}
        {venues.length > 0 && (
          <div className="space-y-1.5">
            {venues.map((v) => (
              <VenueCard
                key={v.id}
                venue={v}
                onEdit={() => {
                  setEditingVenueId(v.id);
                  setAddingVenue(true);
                }}
                onRemove={() => handleRemoveVenue(v.id)}
              />
            ))}
          </div>
        )}

        {/* Add venue panel / button */}
        {addingVenue ? (
          <AddVenuePanel
            onAdd={handleAddVenue}
            onCancel={() => {
              setAddingVenue(false);
              setEditingVenueId(null);
            }}
            editingVenue={editingVenue}
            hideTba={venues.some((v) => v.type !== "tba")}
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingVenueId(null);
              setAddingVenue(true);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add venue
          </Button>
        )}

        {venues.length === 0 && !addingVenue && (
          <p className="text-xs text-muted-foreground">
            Add at least one venue for your event.
          </p>
        )}
      </div>

      {/* ── Modals ── */}
      <OccurrenceEditor
        open={occEditorOpen}
        onOpenChange={setOccEditorOpen}
        occurrences={occurrences}
        timezone={timezone}
        venues={venues}
        onChange={onOccurrencesChange}
      />
    </div>
  );
}
