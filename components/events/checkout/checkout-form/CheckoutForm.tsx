"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchEvent, type FetchedEventData } from "@/lib/api/fetchEvent";
import { SectionWrapper } from "@/components/events/preview/SectionWrapper";
import type {
  ThemeAccent,
  EventTheme,
  ClubProfile,
  EventFormData,
} from "@/components/events/shared/types";
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
import { useAttendeeData } from "@/lib/hooks/useAttendeeData";
import type { FieldGroup } from "@/lib/api/patchEvent";
import { createCheckoutSession } from "@/app/actions/checkout";
import { toast } from "sonner";
import { CheckoutEditor } from "./CheckoutEditor";
import { CheckoutPreview } from "./CheckoutPreview";

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

  const setQuantity = useCallback(
    (update: number | ((q: number) => number)) => {
      _setQuantity(update);
      setActiveTicketTab("ticket-0");
    },
    [],
  );

  /* ── Attendee data (hook) ── */
  const {
    user,
    attendeeData,
    getFieldValue,
    setFieldValue,
    handleBuyForMyself,
    fillingMyData,
  } = useAttendeeData();

  console.log(attendeeData)
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

  const handlePaymentStart = async () => {
    await createCheckoutSession(tmpPriceId, attendeeData, fields, quantity);
  }

  /* ── Realtime sync ── */
  const onRemoteChange = useCallback(
    (groups: FieldGroup[]) => {
      if (groups.length > 0) {
        fetchEvent(eventId)
          .then((result) => setEventData(result))
          .catch(() => { });
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
    () =>
      eventData?.formData.theme ?? {
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
      markDirty: () => { },
      flush: flushFields,
      isAutoSaving: savingFields,
      lastSavedAt,
      eventStatus: (eventData.status ?? "draft") as
        | "draft"
        | "published"
        | "archived",
      savingPublish: false,
      draftSaved: true,
      ticketingEnabled,
      ticketingChanging,
      handleBack: () => router.replace(`/events/${eventId}/edit`),
      handlePublish: () => { },
      handleUnpublish: () => { },
      enableTicketing: handleEnableTicketing,
      disableTicketing: handleDisableTicketing,
      theme,
      setTheme: () => { },
      setThemeOpen: () => { },
      colors,
      isDark,
      hasName: !!eventData.formData.name,
      form: eventData.formData as EventFormData,
      setForm: () => { },
      updateField: () => { },
      carouselImages: eventData.carouselImages ?? [],
      hostsData: [],
      setHostsData: () => { },
      creatorProfile: (profile ?? {}) as ClubProfile,
      collaborators,
      getFieldLock: () => ({ locked: false }),
      handleFieldFocus: () => { },
      handleFieldBlur: () => { },
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
    eventData,
    profile,
    collaborators,
  ]);

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

  const pageBgClass = colors.pageBg;
  const pageTextClass = colors.text;
  const solidBg =
    theme.layout === "card" && theme.bgColor ? theme.bgColor : undefined;


  // TODO remove this once we have dynamic price ids set up I'm just using this to test a single
  const tmpPriceId = "price_1THfJ6Gxt5610wKLTu9axFmL"

  const content = (
    <div
      className={cn("min-h-screen pb-12", pageBgClass, isDark && "dark")}
      style={solidBg ? { backgroundColor: solidBg } : undefined}
    >
      {mode !== "preview" && <EditorToolbox />}

      {/* Customer View — transparent fixed back button floating over gradient */}
      {mode === "preview" && (
        <div className="fixed top-0 left-0 right-0 z-50 px-3 py-2 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2",
              isDark
                ? "text-white/70 hover:text-white hover:bg-white/10"
                : "text-black/60 hover:text-black hover:bg-black/10",
            )}
            onClick={() => router.push(`/events/${eventId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Event
          </Button>
        </div>
      )}

      {/* Accent gradient — starts from very top in preview mode */}
      <div style={accentGradient ? { background: accentGradient } : undefined}>
        <div
          className={cn(
            "mx-auto max-w-3xl px-3 sm:px-6",
            mode === "preview" ? "py-6 sm:py-8 pt-10" : "py-6 sm:py-8",
            pageTextClass,
          )}
        >
          {/* Padding for toolbox (edit mode only) */}
          {mode !== "preview" && <div className="h-14" />}

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

          {/* Edit mode: enable ticketing prompt OR field editor */}
          {isEditing && (
            <CheckoutEditor
              layout={theme.layout}
              isDark={isDark}
              colors={colors}
              accentColor={accentColor}
              ticketingEnabled={ticketingEnabled}
              ticketingChanging={ticketingChanging}
              handleEnableTicketing={handleEnableTicketing}
              pricingCount={pricing.length}
              fields={fields}
              addField={addField}
              updateField={updateField}
              removeField={removeField}
              dndSensors={dndSensors}
              fieldIds={fieldIds}
              handleFieldDragEnd={handleFieldDragEnd}
            />
          )}

          {/* Customer view: ticket selection + attendee forms */}
          {!isEditing && (
            <CheckoutPreview
              layout={theme.layout}
              isDark={isDark}
              colors={colors}
              fields={fields}
              user={user}
              fillingMyData={fillingMyData}
              getFieldValue={getFieldValue}
              setFieldValue={setFieldValue}
              handleBuyForMyself={handleBuyForMyself}
              pricing={pricing}
              selectedTier={selectedTier}
              effectiveSelectedTierId={effectiveSelectedTierId}
              setSelectedTierId={setSelectedTierId}
              thumbnailUrl={thumbnailUrl}
              quantity={quantity}
              setQuantity={setQuantity}
              activeTicketTab={activeTicketTab}
              setActiveTicketTab={setActiveTicketTab}
            />
          )}

          {/* Payment — show once ticketing is enabled or in preview mode */}
          {(ticketingEnabled || mode === "preview") && (
            <div className="mt-8">
              <SectionWrapper
                title="Payment"
                layout={theme.layout}
                isDark={isDark}
              >
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <CreditCard
                    className={cn("h-10 w-10 opacity-40", colors.textMuted)}
                  />
                  <div>
                    <Button onClick={handlePaymentStart}>Test Payment</Button>
                  </div>
                </div>
              </SectionWrapper>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (editorContext) {
    return (
      <EventEditorContext.Provider value={editorContext}>
        {content}
      </EventEditorContext.Provider>
    );
  }

  return content;
}
