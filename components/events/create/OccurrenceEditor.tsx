"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { nanoid } from "nanoid";
import {
  format,
  addDays,
  addWeeks,
  addMonths,
  isBefore,
  isSameDay,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from "date-fns";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Trash2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  Globe,
  Pencil,
} from "lucide-react";
import type { OccurrenceFormData, Venue } from "../shared/types";

type Frequency = "once" | "daily" | "weekly" | "monthly";

interface OccurrenceEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  occurrences: OccurrenceFormData[];
  timezone: string;
  venues: Venue[];
  onChange: (occurrences: OccurrenceFormData[]) => void;
}

/** Format time string HH:MM to h:mm AM/PM */
function formatTime12(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Format time range — handles missing start/end gracefully */
function formatTimeRange(startTime: string, endTime: string): string {
  const s = formatTime12(startTime);
  const e = formatTime12(endTime);
  if (s && e) return `${s} - ${e}`;
  if (s) return s;
  return "All day";
}

/** Chip label for calendar cells */
function formatChipLabel(occ: OccurrenceFormData): string {
  if (occ.name) return occ.name;
  const s = formatTime12(occ.startTime);
  const e = formatTime12(occ.endTime);
  if (s && e) return `${s} - ${e}`;
  if (s) return s;
  return "All day";
}

/** Format date for display e.g. "Sat 28th Mar 2026" */
function formatDateFull(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    return format(d, "EEE do MMM yyyy");
  } catch {
    return dateStr;
  }
}

/* ── Venue label helper ── */
function venueLabel(venue: Venue): string {
  if (venue.type === "online") return venue.onlineLink || "Online";
  if (venue.type === "tba") return "TBA";
  return venue.location.displayName || "Unnamed venue";
}

function venueIcon(venue: Venue) {
  if (venue.type === "online") return <Globe className="h-3 w-3 shrink-0" />;
  return <MapPin className="h-3 w-3 shrink-0" />;
}

/* ══════════════════════════════════════════════════
   Monthly Grid Calendar
   ══════════════════════════════════════════════════ */

interface MonthGridProps {
  month: Date;
  occurrencesByDate: Map<string, OccurrenceFormData[]>;
  selectedDate: string | null;
  editingId: string | null;
  onDayClick: (dateStr: string) => void;
  onOccurrenceClick: (occ: OccurrenceFormData) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function MonthGrid({
  month,
  occurrencesByDate,
  selectedDate,
  editingId,
  onDayClick,
  onOccurrenceClick,
}: MonthGridProps) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [month]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  return (
    <div className="w-full">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="px-1 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
          {week.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, month);
            const today = isToday(day);
            const dayOccs = occurrencesByDate.get(dateStr) ?? [];
            const isSelected = selectedDate === dateStr;
            const hasEditingOcc = editingId
              ? dayOccs.some((o) => o.id === editingId)
              : false;

            return (
              <div
                key={dateStr}
                role="button"
                tabIndex={0}
                onClick={() => onDayClick(dateStr)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onDayClick(dateStr);
                  }
                }}
                className={`relative min-h-[72px] border-r last:border-r-0 p-1 text-left transition-colors cursor-pointer
                  ${!inMonth ? "bg-muted/30 text-muted-foreground/40" : ""}
                  ${isSelected ? "bg-accent/50" : "hover:bg-muted/50"}
                  ${hasEditingOcc ? "ring-2 ring-inset ring-primary" : ""}
                `}
              >
                {/* Day number */}
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs
                    ${today ? "bg-primary text-primary-foreground font-semibold" : ""}
                    ${!inMonth ? "opacity-40" : ""}
                  `}
                >
                  {day.getDate()}
                </span>

                {/* Occurrence chips */}
                {dayOccs.length > 0 && (
                  <div className="mt-0.5 flex flex-col gap-px">
                    {dayOccs.slice(0, 2).map((occ) => (
                      <div
                        key={occ.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOccurrenceClick(occ);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            e.preventDefault();
                            onOccurrenceClick(occ);
                          }
                        }}
                        className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight transition-colors cursor-pointer
                          ${occ.id === editingId
                            ? "bg-primary text-primary-foreground"
                            : "bg-foreground/80 text-background hover:bg-foreground"
                          }
                        `}
                      >
                        {formatChipLabel(occ)}
                      </div>
                    ))}
                    {dayOccs.length > 2 && (
                      <span className="px-1 text-[10px] text-muted-foreground">
                        +{dayOccs.length - 2} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   Occurrence List (right panel idle state)
   ══════════════════════════════════════════════════ */

interface OccurrenceListProps {
  occurrences: OccurrenceFormData[];
  venues: Venue[];
  onSelect: (occ: OccurrenceFormData) => void;
  onAdd: () => void;
}

function OccurrenceList({
  occurrences,
  venues,
  onSelect,
  onAdd,
}: OccurrenceListProps) {
  const sorted = useMemo(
    () =>
      [...occurrences].sort(
        (a, b) =>
          a.startDate.localeCompare(b.startDate) ||
          a.startTime.localeCompare(b.startTime),
      ),
    [occurrences],
  );

  const venueMap = useMemo(() => {
    const m = new Map<string, Venue>();
    for (const v of venues) m.set(v.id, v);
    return m;
  }, [venues]);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
        <div>
          <p className="text-sm font-medium">No occurrences yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click a date on the calendar or use the button below to add one.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          Add occurrence
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {sorted.length} occurrence{sorted.length !== 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onAdd}>
          Add
        </Button>
      </div>

      <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
        {sorted.map((occ) => {
          const occVenues =
            occ.venueIds
              ?.map((vid) => venueMap.get(vid))
              .filter(Boolean) as Venue[] | undefined;

          return (
            <button
              key={occ.id}
              type="button"
              onClick={() => onSelect(occ)}
              className="group flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  {occ.name && (
                    <span className="text-sm font-semibold block truncate">
                      {occ.name}
                    </span>
                  )}
                  <span className="text-sm font-medium">
                    {formatDateFull(occ.startDate)}
                  </span>
                </div>
                <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <span className="text-xs text-muted-foreground">
                {formatTimeRange(occ.startTime, occ.endTime)}
              </span>
              {occVenues && occVenues.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {occVenues.map((v) => (
                    <span
                      key={v.id}
                      className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {venueIcon(v)}
                      {venueLabel(v)}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   Venue Picker (multi-select checkboxes)
   ══════════════════════════════════════════════════ */

interface VenuePickerProps {
  venues: Venue[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function VenuePicker({ venues, selectedIds, onChange }: VenuePickerProps) {
  if (venues.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No venues added yet. Add venues in the Date &amp; Location section.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {venues.map((v) => {
        const checked = selectedIds.includes(v.id);
        return (
          <label
            key={v.id}
            className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors hover:bg-muted/50 cursor-pointer"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(c) => {
                if (c) {
                  onChange([...selectedIds, v.id]);
                } else {
                  onChange(selectedIds.filter((id) => id !== v.id));
                }
              }}
            />
            <span className="flex items-center gap-1.5 min-w-0">
              {venueIcon(v)}
              <span className="truncate">{venueLabel(v)}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   Main OccurrenceEditor
   ══════════════════════════════════════════════════ */

export function OccurrenceEditor({
  open,
  onOpenChange,
  occurrences,
  venues,
  onChange,
}: OccurrenceEditorProps) {
  // Local working copy
  const [local, setLocal] = useState<OccurrenceFormData[]>(occurrences);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  // Panel state: null = idle (show list), "add" = adding, string = editing ID
  const [panelMode, setPanelMode] = useState<null | "add" | string>(null);

  // Form fields
  const [occName, setOccName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("once");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);

  // Track whether repeat-until input is focused (for calendar click → fill)
  const repeatUntilFocused = useRef(false);

  const editingId = panelMode !== null && panelMode !== "add" ? panelMode : null;

  const resetPanel = useCallback(() => {
    setPanelMode(null);
    setOccName("");
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setFrequency("once");
    setRepeatUntil("");
    setSelectedVenueIds([]);
  }, []);

  const openAddPanel = useCallback(
    (dateStr?: string) => {
      setPanelMode("add");
      setOccName("");
      setStartDate(dateStr ?? "");
      setEndDate("");
      setStartTime("");
      setEndTime("");
      setFrequency("once");
      setRepeatUntil("");
      // Default to all venues if only one
      setSelectedVenueIds(venues.length === 1 ? [venues[0].id] : []);
    },
    [venues],
  );

  const openEditPanel = useCallback((occ: OccurrenceFormData) => {
    setPanelMode(occ.id);
    setOccName(occ.name ?? "");
    setStartDate(occ.startDate);
    setStartTime(occ.startTime);
    setEndDate(occ.endDate);
    setEndTime(occ.endTime);
    setFrequency("once");
    setRepeatUntil("");
    setSelectedVenueIds(occ.venueIds ?? []);
    // Navigate calendar to this occurrence's month
    try {
      setCurrentMonth(parseISO(occ.startDate));
    } catch {
      // ignore
    }
  }, []);

  // Sync local state when modal opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setLocal(occurrences);
        resetPanel();
        setCurrentMonth(new Date());
      }
      onOpenChange(isOpen);
    },
    [occurrences, onOpenChange, resetPanel],
  );

  /** Map from date string to occurrences */
  const dateOccMap = useMemo(() => {
    const map = new Map<string, OccurrenceFormData[]>();
    for (const o of local) {
      const existing = map.get(o.startDate) ?? [];
      existing.push(o);
      map.set(o.startDate, existing);
    }
    return map;
  }, [local]);

  /* ── Calendar nav ── */
  const prevMonth = useCallback(
    () => setCurrentMonth((m) => addMonths(m, -1)),
    [],
  );
  const nextMonth = useCallback(
    () => setCurrentMonth((m) => addMonths(m, 1)),
    [],
  );

  /* ── Day click ── */
  function handleDayClick(dateStr: string) {
    // If repeat-until is focused, fill that field instead of normal behavior
    if (repeatUntilFocused.current) {
      setRepeatUntil(dateStr);
      return;
    }

    const dayOccs = dateOccMap.get(dateStr);
    if (dayOccs && dayOccs.length > 0) {
      // If there's exactly one occurrence, edit it directly
      if (dayOccs.length === 1) {
        openEditPanel(dayOccs[0]);
      } else {
        // Multiple — go to add mode on that date, user can pick from list
        openAddPanel(dateStr);
      }
    } else {
      openAddPanel(dateStr);
    }
  }

  /* ── Add ── */
  function handleAdd() {
    if (!startDate) return;

    const newOccs: OccurrenceFormData[] = [];

    if (frequency === "once") {
      newOccs.push({
        id: nanoid(),
        name: occName.trim() || undefined,
        startDate,
        startTime,
        endDate,
        endTime,
        venueIds: selectedVenueIds.length > 0 ? selectedVenueIds : undefined,
      });
    } else {
      const until = repeatUntil
        ? parseISO(repeatUntil)
        : addMonths(parseISO(startDate), 3);
      let current = parseISO(startDate);
      const advanceFn =
        frequency === "daily"
          ? (d: Date) => addDays(d, 1)
          : frequency === "weekly"
            ? (d: Date) => addWeeks(d, 1)
            : (d: Date) => addMonths(d, 1);

      while (isBefore(current, until) || isSameDay(current, until)) {
        const ds = format(current, "yyyy-MM-dd");
        const dayDiff =
          startDate && endDate && startDate !== endDate
            ? Math.round(
                (parseISO(endDate).getTime() -
                  parseISO(startDate).getTime()) /
                  86400000,
              )
            : 0;
        const endDateStr =
          dayDiff > 0 ? format(addDays(current, dayDiff), "yyyy-MM-dd") : "";

        newOccs.push({
          id: nanoid(),
          startDate: ds,
          startTime,
          endDate: endDateStr,
          endTime,
          venueIds: selectedVenueIds.length > 0 ? selectedVenueIds : undefined,
        });
        current = advanceFn(current);
      }
    }

    setLocal((prev) => [...prev, ...newOccs]);
    resetPanel();
  }

  /* ── Update ── */
  function handleUpdate() {
    if (!editingId || !startDate) return;
    setLocal((prev) =>
      prev.map((o) =>
        o.id === editingId
          ? {
              ...o,
              name: occName.trim() || undefined,
              startDate,
              startTime,
              endDate,
              endTime,
              venueIds:
                selectedVenueIds.length > 0 ? selectedVenueIds : undefined,
            }
          : o,
      ),
    );
    resetPanel();
  }

  /* ── Delete ── */
  function handleDelete() {
    if (!editingId) return;
    setLocal((prev) => prev.filter((o) => o.id !== editingId));
    resetPanel();
  }

  /* ── Save ── */
  function handleSave() {
    onChange(local);
    onOpenChange(false);
  }

  const selectedDate = startDate || null;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={handleOpenChange}
      title="Manage occurrences"
      className="sm:max-w-5xl"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-0 max-h-[80vh]">
        {/* ═══ LEFT: Calendar Grid ═══ */}
        <div className="flex-1 min-w-0 overflow-y-auto sm:border-r sm:pr-0">
          {/* Month nav */}
          <div className="flex items-center justify-between px-2 pb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-md p-1.5 transition-colors hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-sm font-semibold">
              {format(currentMonth, "MMMM yyyy")}
            </h3>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-md p-1.5 transition-colors hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <MonthGrid
            month={currentMonth}
            occurrencesByDate={dateOccMap}
            selectedDate={selectedDate}
            editingId={editingId}
            onDayClick={handleDayClick}
            onOccurrenceClick={openEditPanel}
          />
        </div>

        {/* ═══ RIGHT: Panel ═══ */}
        <div className="w-full shrink-0 space-y-4 border-t pt-4 sm:w-80 sm:border-t-0 sm:pl-5 sm:pt-0 overflow-y-auto">
          {panelMode === null ? (
            /* ── Idle: occurrence list ── */
            <OccurrenceList
              occurrences={local}
              venues={venues}
              onSelect={openEditPanel}
              onAdd={() => openAddPanel()}
            />
          ) : (
            /* ── Add / Edit form ── */
            <>
              <h3 className="text-sm font-semibold">
                {editingId ? "Edit occurrence" : "Add occurrences"}
              </h3>

              <div className="space-y-3">
                {/* Name (optional) */}
                <div>
                  <Label className="text-xs">
                    Name <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    className="mt-1"
                    placeholder="e.g. Pitch Day, Competition Day 1"
                    value={occName}
                    onChange={(e) => setOccName(e.target.value)}
                  />
                </div>

                {/* Start */}
                <div>
                  <Label className="text-xs">
                    Start from <span className="text-destructive">*</span>
                  </Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (endDate && endDate < e.target.value)
                          setEndDate(e.target.value);
                      }}
                      className="flex-1"
                    />
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      placeholder="Optional"
                      className="w-28"
                    />
                  </div>
                </div>

                {/* End */}
                <div>
                  <Label className="text-xs">End at</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-28"
                    />
                  </div>
                </div>

                {/* Frequency (add mode only) */}
                {!editingId && (
                  <>
                    <div>
                      <Label className="text-xs">
                        How often will this time slot occur?
                      </Label>
                      <Tabs
                        value={frequency}
                        onValueChange={(v) => setFrequency(v as Frequency)}
                        className="mt-1"
                      >
                        <TabsList className="w-full">
                          <TabsTrigger value="once" className="flex-1 text-xs">
                            Once
                          </TabsTrigger>
                          <TabsTrigger value="daily" className="flex-1 text-xs">
                            Daily
                          </TabsTrigger>
                          <TabsTrigger
                            value="weekly"
                            className="flex-1 text-xs"
                          >
                            Weekly
                          </TabsTrigger>
                          <TabsTrigger
                            value="monthly"
                            className="flex-1 text-xs"
                          >
                            Monthly
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>

                    {frequency !== "once" && (
                      <div>
                        <Label className="text-xs">
                          Repeat until{" "}
                          <span className="font-normal text-muted-foreground">
                            (click a date on the calendar)
                          </span>
                        </Label>
                        <Input
                          type="date"
                          value={repeatUntil}
                          min={startDate}
                          onChange={(e) => setRepeatUntil(e.target.value)}
                          onFocus={() => {
                            repeatUntilFocused.current = true;
                          }}
                          onBlur={() => {
                            // Small delay so calendar click fires first
                            setTimeout(() => {
                              repeatUntilFocused.current = false;
                            }, 200);
                          }}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Venue picker — hide TBA venues */}
                {venues.filter((v) => v.type !== "tba").length > 0 && (
                  <div>
                    <Label className="text-xs">Venue(s)</Label>
                    <div className="mt-1">
                      <VenuePicker
                        venues={venues.filter((v) => v.type !== "tba")}
                        selectedIds={selectedVenueIds}
                        onChange={setSelectedVenueIds}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetPanel}
                  className="flex-1"
                >
                  Cancel
                </Button>
                {editingId ? (
                  <Button
                    size="sm"
                    onClick={handleUpdate}
                    disabled={!startDate}
                    className="flex-1"
                  >
                    Update
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleAdd}
                    disabled={!startDate}
                    className="flex-1"
                  >
                    Add
                  </Button>
                )}
              </div>

              {editingId && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={handleDelete}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete occurrence
                </Button>
              )}
            </>
          )}

          {/* Footer: always visible */}
          <div className="flex justify-end gap-2 border-t pt-3 mt-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Discard
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </ResponsiveModal>
  );
}
