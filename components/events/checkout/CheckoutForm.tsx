"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CreditCard, Minus, Plus } from "lucide-react";
import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fetchEvent, type FetchedEventData } from "@/lib/api/fetchEvent";
import { SectionWrapper } from "@/components/events/preview/SectionWrapper";
import {
  CHECKOUT_PRESET_FIELDS,
} from "@/lib/types/ticketing";
import type { ThemeAccent, EventTheme, ClubProfile, EventFormData } from "@/components/events/shared/types";
import {
  getThemeColors,
  getAccentGradient,
} from "@/components/events/shared/types";
import {
  EventEditorContext,
  type EventEditorContextValue,
} from "@/components/events/shared/EventEditorContext";
import { EditorToolbox } from "@/components/events/shared/EditorToolbox";
import { useAuthStore } from "@/stores/authStore";
import { useEventRealtime } from "@/lib/hooks/useEventRealtime";
import { useDocumentDark } from "@/lib/hooks/useDocumentDark";
import { useEventTicketing } from "@/lib/hooks/useEventTicketing";
import { useCheckoutFields } from "@/lib/hooks/useCheckoutFields";
import type { FieldGroup } from "@/lib/api/patchEvent";
import { toast } from "sonner";
import { TicketFieldCard } from "./TicketFieldCard";
import { TicketFieldPreview } from "./TicketFieldPreview";
import { AddFieldButton } from "./AddFieldButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Image from "next/image";

/* ── Accent → solid colour ── */
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

function getAccentColor(
  accent: ThemeAccent,
  customHex?: string,
): string | undefined {
  if (accent === "none") return undefined;
  if (accent === "custom") return customHex || "#888888";
  return ACCENT_SOLID_MAP[accent];
}

/* ── Sortable wrapper for DnD ── */
function SortableFieldWrapper({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: Record<string, unknown>) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

/* ── Component ── */

interface CheckoutFormProps {
  eventId: string;
  mode: "edit" | "preview";
}

export default function CheckoutForm({ eventId, mode }: CheckoutFormProps) {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const [eventData, setEventData] = useState<FetchedEventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState(mode === "preview");
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);

  /* ── Ticket selection (preview mode) ── */
  const [selectedTierId, setSelectedTierId] = useState<string>("");
  const [quantity, _setQuantity] = useState(1);
  const [activeTicketTab, setActiveTicketTab] = useState("ticket-0");

  const setQuantity = useCallback((update: number | ((q: number) => number)) => {
    _setQuantity(update);
    setActiveTicketTab("ticket-0");
  }, []);

  /* ── Attendee data: attendeeData[ticketIndex][fieldKey] = value ── */
  const [attendeeData, setAttendeeData] = useState<
    Record<number, Record<string, string>>
  >({});

  const getFieldValue = (ticketIndex: number, fieldKey: string): string =>
    attendeeData[ticketIndex]?.[fieldKey] ?? "";

  const setFieldValue = (
    ticketIndex: number,
    fieldKey: string,
    value: string,
  ) => {
    setAttendeeData((prev) => ({
      ...prev,
      [ticketIndex]: {
        ...(prev[ticketIndex] ?? {}),
        [fieldKey]: value,
      },
    }));
  };

  const isEditing = !previewMode;

  /* ── Load event data ── */
  useEffect(() => {
    fetchEvent(eventId)
      .then((result) => setEventData(result))
      .catch((err) => {
        console.error("Failed to load event:", err);
        toast.error("Failed to load event");
        router.push("/");
      })
      .finally(() => setLoading(false));
  }, [eventId, router]);

  /* ── Realtime sync ── */
  const onRemoteChange = useCallback(
    (groups: FieldGroup[]) => {
      if (groups.length > 0) {
        fetchEvent(eventId)
          .then((result) => setEventData(result))
          .catch(() => {});
      }
    },
    [eventId],
  );

  const { broadcast, collaborators } = useEventRealtime({
    eventId,
    userId: profile?.id,
    userName: profile?.first_name ?? undefined,
    enabled: mode === "edit" && !!profile?.id,
    onRemoteChange,
  });

  /* ── Ticketing (shared hook) ── */
  const {
    ticketingEnabled,
    ticketingChanging,
    enableTicketing: handleEnableTicketing,
    disableTicketing: handleDisableTicketing,
  } = useEventTicketing({
    eventId,
    initialEnabled: eventData?.ticketingEnabled ?? false,
    pricingCount: eventData?.formData.pricing?.length ?? 0,
  });

  /* ── Checkout fields (hook) ── */
  const {
    fields,
    addField,
    updateField,
    removeField,
    savingFields,
    lastSavedAt,
    flushFields,
    dndSensors,
    fieldIds,
    handleFieldDragEnd,
  } = useCheckoutFields({
    eventId,
    mode,
    broadcast,
  });

  /* ── Initialize ticket selection when data loads ── */
  const defaultTierId = eventData?.formData.pricing?.[0]?.id ?? "";
  const effectiveSelectedTierId = selectedTierId || defaultTierId;

  /* ── Theme ── */
  const theme: EventTheme = useMemo(
    () => eventData?.formData.theme ?? {
      mode: "adaptive" as const,
      layout: "card" as const,
      accent: "none" as const,
    },
    [eventData?.formData.theme],
  );
  const colors = useMemo(() => getThemeColors(theme.mode), [theme.mode]);
  const isDark = colors.isDark;
  useDocumentDark(isDark);
  const accentColor = getAccentColor(theme.accent, theme.accentCustom);
  const accentGradient = useMemo(
    () => getAccentGradient(theme.accent, isDark, theme.accentCustom),
    [theme.accent, theme.accentCustom, isDark],
  );

  /* ── Editor context (only used when mode="edit") ── */
  const editorContext: EventEditorContextValue | null = useMemo(() => {
    if (mode !== "edit" || !eventData) return null;
    return {
      eventId,
      mode: "edit",
      initialUrlSlug: null,
      previewMode,
      setPreviewMode,
      viewMode: previewMode ? ("preview" as const) : ("edit" as const),
      isEditing: !previewMode,
      toolbarCollapsed,
      setToolbarCollapsed,
      markDirty: () => {},
      flush: flushFields,
      isAutoSaving: savingFields,
      lastSavedAt,
      eventStatus: (eventData.status ?? "draft") as "draft" | "published" | "archived",
      savingPublish: false,
      draftSaved: true,
      ticketingEnabled,
      ticketingChanging,
      handleBack: () => router.replace(`/events/${eventId}/edit`),
      handlePublish: () => {},
      handleUnpublish: () => {},
      enableTicketing: handleEnableTicketing,
      disableTicketing: handleDisableTicketing,
      theme,
      setTheme: () => {},
      setThemeOpen: () => {},
      colors,
      isDark,
      hasName: !!eventData.formData.name,
      form: eventData.formData as EventFormData,
      setForm: () => {},
      updateField: () => {},
      carouselImages: eventData.carouselImages ?? [],
      hostsData: [],
      setHostsData: () => {},
      creatorProfile: (profile ?? {}) as ClubProfile,
      collaborators,
      getFieldLock: () => ({ locked: false }),
      handleFieldFocus: () => {},
      handleFieldBlur: () => {},
    };
  }, [
    mode,
    eventId,
    previewMode,
    toolbarCollapsed,
    flushFields,
    savingFields,
    lastSavedAt,
    ticketingEnabled,
    ticketingChanging,
    handleEnableTicketing,
    handleDisableTicketing,
    router,
    theme,
    colors,
    isDark,
    eventData?.formData,
    eventData?.status,
    eventData?.carouselImages,
    profile,
    collaborators,
  ]);

  /* ── Loading / error states ── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!eventData) return null;

  const pricing = eventData.formData.pricing ?? [];
  const thumbnailUrl =
    eventData.carouselImages?.[0]?.url ??
    eventData.formData.imageUrls?.[0] ??
    null;
  const selectedTier =
    pricing.find((t) => t.id === effectiveSelectedTierId) ?? pricing[0] ?? null;
  const FEE_PER_TICKET = 0.75;

  const pageBgClass = colors.pageBg;
  const pageTextClass = colors.text;
  const solidBg =
    theme.layout === "card" && theme.bgColor ? theme.bgColor : undefined;

  const content = (
    <div
      className={cn("min-h-screen pb-12", pageBgClass, isDark && "dark")}
      style={solidBg ? { backgroundColor: solidBg } : undefined}
    >
      {mode !== "preview" && <EditorToolbox />}

      {/* Preview mode — back button */}
      {mode === "preview" && (
        <div className="mx-auto max-w-3xl px-3 py-2 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => router.push(`/events/${eventId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Event
          </Button>
        </div>
      )}

      {/* Accent gradient */}
      <div style={accentGradient ? { background: accentGradient } : undefined}>
        <div
          className={cn(
            "mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-8",
            pageTextClass,
          )}
        >
          {/* Title */}
          <div className="mb-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Checkout
            </h1>
            {eventData.formData.name && (
              <p className={cn("mt-1 text-sm", colors.textMuted)}>
                {eventData.formData.name}
              </p>
            )}
          </div>

          {/* Ticket Selection Banner (preview mode) */}
          {!isEditing && pricing.length > 0 && selectedTier && (
            <div
              className={cn(
                "mt-4 flex items-center gap-4 rounded-xl border p-3",
                colors.cardBg,
                colors.cardBorder,
              )}
            >
              {thumbnailUrl && (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={thumbnailUrl}
                    alt={eventData.formData.name ?? "Event"}
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              <div className="min-w-0 flex-1">
                {pricing.length > 1 ? (
                  <Select
                    value={effectiveSelectedTierId}
                    onValueChange={setSelectedTierId}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-auto border-none bg-transparent p-0 text-base font-semibold shadow-none",
                        colors.text,
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pricing.map((tier) => (
                        <SelectItem key={tier.id} value={tier.id}>
                          {tier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className={cn("text-base font-semibold", colors.text)}>
                    {selectedTier.name}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <p className={cn("text-lg font-bold", colors.text)}>
                  {selectedTier.price > 0
                    ? `$${selectedTier.price.toFixed(2)}`
                    : "Free"}
                </p>
                {selectedTier.price > 0 && (
                  <p className={cn("text-xs", colors.textMuted)}>
                    + ${FEE_PER_TICKET.toFixed(2)} fee
                  </p>
                )}
              </div>

              <div
                className={cn(
                  "flex shrink-0 items-center rounded-lg border",
                  colors.cardBorder,
                )}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span
                  className={cn(
                    "w-8 text-center text-sm font-medium",
                    colors.text,
                  )}
                >
                  {quantity}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                  disabled={quantity >= 10}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Enable ticketing prompt (edit mode, not yet enabled) */}
          {mode === "edit" && !ticketingEnabled && (
            <Card className="mt-6 flex flex-col items-center gap-4 p-8 text-center">
              <div>
                <h2 className="text-lg font-semibold">Enable Ticketing</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Set up ticketing for this event to start collecting attendee
                  information at checkout.
                </p>
                {pricing.length === 0 && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    You need to add at least one ticket tier to your event
                    before enabling ticketing.
                  </p>
                )}
              </div>
              <Button
                size="lg"
                className="gap-2"
                style={
                  accentColor
                    ? { backgroundColor: accentColor, color: "#fff" }
                    : undefined
                }
                onClick={handleEnableTicketing}
                disabled={ticketingChanging || pricing.length === 0}
              >
                {ticketingChanging && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Enable Ticketing
              </Button>
            </Card>
          )}

          {/* Sections (show once ticketing is enabled, or in preview mode) */}
          {(ticketingEnabled || mode === "preview") && (
            <>
              {/* Edit mode: flat layout */}
              {isEditing && (
                <div className="mt-8 space-y-8">
                  <SectionWrapper
                    title="Checkout Info"
                    layout={theme.layout}
                    isDark={isDark}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      {CHECKOUT_PRESET_FIELDS.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                          <Label
                            className={cn("text-sm font-medium", colors.text)}
                          >
                            {field.label}
                            <span className="ml-0.5 text-red-500">*</span>
                          </Label>
                          <Input
                            type={field.type}
                            placeholder={field.label}
                            disabled
                            className={cn(
                              colors.inputBg,
                              colors.inputBorder,
                              colors.placeholder,
                            )}
                          />
                        </div>
                      ))}
                    </div>
                    <p className={cn("mt-3 text-xs", colors.textMuted)}>
                      These fields are preset and cannot be modified. They will
                      always appear on the checkout form.
                    </p>
                  </SectionWrapper>

                  <SectionWrapper
                    title="Ticket Info"
                    layout={theme.layout}
                    isDark={isDark}
                  >
                    <p className={cn("mb-3 text-xs", colors.textMuted)}>
                      Add custom questions for attendees. Drag to reorder.
                    </p>

                    <div className="space-y-2">
                      {fields.length > 0 ? (
                        <DndContext
                          sensors={dndSensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleFieldDragEnd}
                        >
                          <SortableContext
                            items={fieldIds}
                            strategy={verticalListSortingStrategy}
                          >
                            {fields.map((field, i) => (
                              <SortableFieldWrapper
                                key={field.id}
                                id={field.id}
                              >
                                {(dragHandleProps) => (
                                  <TicketFieldCard
                                    field={field}
                                    index={i}
                                    colors={colors}
                                    onChange={(updated) =>
                                      updateField(field.id, updated)
                                    }
                                    onRemove={() => removeField(field.id)}
                                    dragHandleProps={dragHandleProps}
                                  />
                                )}
                              </SortableFieldWrapper>
                            ))}
                          </SortableContext>
                        </DndContext>
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-6 text-center">
                          <p className={cn("text-sm", colors.textMuted)}>
                            No custom fields yet. Add one below.
                          </p>
                        </div>
                      )}

                      <AddFieldButton onAdd={addField} colors={colors} />
                    </div>
                  </SectionWrapper>
                </div>
              )}

              {/* Preview mode: per-ticket forms with tabs */}
              {!isEditing && (
                <>
                  {quantity > 1 ? (
                    <Tabs
                      value={activeTicketTab}
                      onValueChange={setActiveTicketTab}
                      className="mt-8"
                    >
                      <TabsList>
                        {Array.from({ length: quantity }, (_, i) => (
                          <TabsTrigger key={i} value={`ticket-${i}`}>
                            Ticket {i + 1}
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {Array.from({ length: quantity }, (_, i) => (
                        <TabsContent key={i} value={`ticket-${i}`}>
                          <div className="space-y-8">
                            <SectionWrapper
                              title="Checkout Info"
                              layout={theme.layout}
                              isDark={isDark}
                            >
                              <div className="grid gap-4 sm:grid-cols-2">
                                {CHECKOUT_PRESET_FIELDS.map((field) => (
                                  <div key={field.key} className="space-y-1.5">
                                    <Label
                                      className={cn(
                                        "text-sm font-medium",
                                        colors.text,
                                      )}
                                    >
                                      {field.label}
                                      <span className="ml-0.5 text-red-500">
                                        *
                                      </span>
                                    </Label>
                                    <Input
                                      type={field.type}
                                      placeholder={field.label}
                                      className={cn(
                                        colors.inputBg,
                                        colors.inputBorder,
                                        colors.placeholder,
                                      )}
                                      value={getFieldValue(i, field.key)}
                                      onChange={(e) =>
                                        setFieldValue(
                                          i,
                                          field.key,
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </div>
                                ))}
                              </div>
                            </SectionWrapper>

                            {fields.length > 0 && (
                              <SectionWrapper
                                title="Ticket Info"
                                layout={theme.layout}
                                isDark={isDark}
                              >
                                <div className="space-y-4">
                                  {fields.map((field) => (
                                    <TicketFieldPreview
                                      key={field.id}
                                      field={field}
                                      colors={colors}
                                      value={getFieldValue(i, field.id)}
                                      onChange={(val) =>
                                        setFieldValue(i, field.id, val)
                                      }
                                    />
                                  ))}
                                </div>
                              </SectionWrapper>
                            )}
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  ) : (
                    <div className="mt-8 space-y-8">
                      <SectionWrapper
                        title="Checkout Info"
                        layout={theme.layout}
                        isDark={isDark}
                      >
                        <div className="grid gap-4 sm:grid-cols-2">
                          {CHECKOUT_PRESET_FIELDS.map((field) => (
                            <div key={field.key} className="space-y-1.5">
                              <Label
                                className={cn(
                                  "text-sm font-medium",
                                  colors.text,
                                )}
                              >
                                {field.label}
                                <span className="ml-0.5 text-red-500">*</span>
                              </Label>
                              <Input
                                type={field.type}
                                placeholder={field.label}
                                className={cn(
                                  colors.inputBg,
                                  colors.inputBorder,
                                  colors.placeholder,
                                )}
                                value={getFieldValue(0, field.key)}
                                onChange={(e) =>
                                  setFieldValue(0, field.key, e.target.value)
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </SectionWrapper>

                      {fields.length > 0 && (
                        <SectionWrapper
                          title="Ticket Info"
                          layout={theme.layout}
                          isDark={isDark}
                        >
                          <div className="space-y-4">
                            {fields.map((field) => (
                              <TicketFieldPreview
                                key={field.id}
                                field={field}
                                colors={colors}
                                value={getFieldValue(0, field.id)}
                                onChange={(val) =>
                                  setFieldValue(0, field.id, val)
                                }
                              />
                            ))}
                          </div>
                        </SectionWrapper>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Payment (Coming Soon) */}
              <div className="mt-8">
                <SectionWrapper
                  title="Payment"
                  layout={theme.layout}
                  isDark={isDark}
                  headerRight={
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 leading-4"
                    >
                      Coming Soon
                    </Badge>
                  }
                >
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <CreditCard
                      className={cn("h-10 w-10 opacity-40", colors.textMuted)}
                    />
                    <div>
                      <p className="text-sm font-medium">Payment processing</p>
                      <p className={cn("mt-1 text-xs", colors.textMuted)}>
                        Collect payments directly through Connect3. Stripe
                        integration is coming soon.
                      </p>
                    </div>
                  </div>
                </SectionWrapper>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  /* Wrap in context only when editing (visitor mode has no toolbox) */
  if (editorContext) {
    return (
      <EventEditorContext.Provider value={editorContext}>
        {content}
      </EventEditorContext.Provider>
    );
  }

  return content;
}
