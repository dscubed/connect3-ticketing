"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/* ── Shared ── */
import type {
  ClubProfile,
  EventFormData,
  CarouselImage,
  EventTheme,
} from "./shared/types";
import {
  DEFAULT_THEME,
  getThemeColors,
  getAccentGradient,
} from "./shared/types";

/* ── Unified field components ── */
import {
  EventImageField,
  EventNameField,
  EventCategoryField,
  EventTagsField,
  EventDateField,
  EventLocationField,
  EventHostsField,
  EventPricingField,
  EventLinksField,
  EventDescriptionField,
  EventSectionField,
} from "./fields";

/* ── Create-only UI (dialogs) ── */
import { ImageManagerDialog } from "./create/ImageManagerDialog";
import { ThemeDialog } from "./create/ThemeDialog";
import { SectionWrapper } from "./preview/SectionWrapper";

/* ── Other ── */
import {
  EventChecklist,
  AttentionBadge,
  type ChecklistRefMap,
} from "./EventChecklist";
import {
  AddSectionButton,
  createBlankSection,
  type SectionType,
  type SectionData,
  type FAQSectionData,
  type DragHandleProps,
} from "./sections";
import { useAuthStore } from "@/stores/authStore";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  Palette,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { createEvent } from "@/lib/api/createEvent";
import { updateEvent } from "@/lib/api/updateEvent";
import { patchEvent, type FieldGroup } from "@/lib/api/patchEvent";
import { fetchEvent } from "@/lib/api/fetchEvent";
import { useFieldAutoSave } from "@/lib/hooks/useFieldAutoSave";
import { useEventRealtime } from "@/lib/hooks/useEventRealtime";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface EventFormProps {
  /** Pre-filled data for edit mode */
  initialData?: Partial<EventFormData>;
  /** Existing image URLs (edit mode) */
  existingImages?: string[];
  /** Pre-loaded carousel images (edit mode) */
  initialCarouselImages?: CarouselImage[];
  /** Pre-loaded host profile objects (edit mode) */
  initialHostsData?: ClubProfile[];
  /** Pre-loaded sections (edit mode) */
  initialSections?: SectionData[];
  /** Event ID — required for edit mode */
  eventId?: string;
  /** Form mode */
  mode?: "create" | "edit";
  /** Current event status (edit mode) */
  initialStatus?: "draft" | "published" | "archived";
  /** The event creator's profile (edit mode — fetched from DB) */
  initialCreatorProfile?: ClubProfile;
  /** Called on form submit */
  onSubmit?: (data: EventFormData) => Promise<void>;
}

/* ── Sortable wrapper for section-level DnD ── */
function SortableSectionWrapper({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: DragHandleProps) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        ref: setActivatorNodeRef,
        listeners,
        attributes,
      })}
    </div>
  );
}

/* ── Collaborative presence badge ── */
import type { CollaboratorPresence } from "@/lib/hooks/useEventRealtime";

function CollaboratorBadge({
  group,
  collaborators,
}: {
  group: FieldGroup;
  collaborators: Map<string, CollaboratorPresence>;
}) {
  const editing = Array.from(collaborators.values()).filter(
    (c) => c.focusField === group,
  );
  if (editing.length === 0) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-blue-500/90 px-2 py-0.5 text-[11px] font-medium text-white shadow-sm animate-in fade-in">
      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
      {editing.map((c) => c.name).join(", ")} editing…
    </span>
  );
}

/* ── Relative "last saved" label that ticks every ~30s ── */
function formatRelativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "Saved just now";
  if (seconds < 60) return "Saved seconds ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return "Saved 1 min ago";
  if (minutes < 60) return `Saved ${minutes} mins ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "Saved 1 hr ago";
  if (hours < 24) return `Saved ${hours} hrs ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Saved 1 day ago";
  if (days < 7) return `Saved ${days} days ago`;
  return "Saved a while ago";
}

function LastSavedLabel({ date }: { date: Date }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [date]);

  // tick is used to force re-evaluation of the label
  void tick;
  return <>{formatRelativeTime(date)}</>;
}

export default function EventForm({
  initialData,
  existingImages,
  initialCarouselImages,
  initialHostsData,
  initialSections,
  eventId,
  mode = "create",
  initialStatus = "draft",
  initialCreatorProfile,
}: EventFormProps) {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const [saving, setSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(mode === "edit");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(
    mode === "edit" ? new Date() : null,
  );
  const [eventStatus, setEventStatus] = useState<
    "draft" | "published" | "archived"
  >(initialStatus);
  const [previewMode, setPreviewMode] = useState(false);
  const focusedFieldRef = useRef<FieldGroup | null>(null);

  /** Map form field keys → FieldGroup for auto-save. */
  const FIELD_TO_GROUP: Record<keyof EventFormData, FieldGroup> = useMemo(
    () => ({
      name: "event",
      description: "event",
      startDate: "event",
      startTime: "event",
      endDate: "event",
      endTime: "event",
      timezone: "event",
      isOnline: "event",
      category: "event",
      tags: "event",
      location: "location",
      imageUrls: "images",
      hostIds: "hosts",
      pricing: "pricing",
      links: "links",
      theme: "theme",
    }),
    [],
  );

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const viewMode = previewMode ? "preview" : "edit";
  const isEditing = !previewMode;

  /* ── Checklist scroll-to refs ── */
  const thumbnailRef = useRef<HTMLDivElement>(null);
  const startDateRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const faqsRef = useRef<HTMLDivElement>(null);

  const checklistRefs: ChecklistRefMap = useMemo(
    () => ({
      thumbnail: thumbnailRef,
      "start-date": startDateRef,
      location: locationRef,
      category: categoryRef,
      tags: tagsRef,
      faqs: faqsRef,
    }),
    [],
  );

  const [form, setForm] = useState<EventFormData>({
    name: initialData?.name ?? "",
    description: initialData?.description ?? "",
    startDate: initialData?.startDate ?? "",
    startTime: initialData?.startTime ?? "",
    endDate: initialData?.endDate ?? "",
    endTime: initialData?.endTime ?? "",
    timezone:
      initialData?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    location: initialData?.location ?? { displayName: "", address: "" },
    isOnline: initialData?.isOnline ?? false,
    category: initialData?.category ?? "",
    tags: initialData?.tags ?? [],
    hostIds: initialData?.hostIds ?? [],
    imageUrls: initialData?.imageUrls ?? [],
    pricing: initialData?.pricing ?? [],
    links: initialData?.links ?? [],
    theme: initialData?.theme ?? { ...DEFAULT_THEME },
  } as EventFormData);

  // Cache the full profile objects for additional hosts
  const [hostsData, setHostsData] = useState<ClubProfile[]>(
    initialHostsData ?? [],
  );

  // Dynamic section cards
  const [sections, setSections] = useState<SectionData[]>(
    initialSections ?? [],
  );

  /* ── Carousel images (lifted state — persists across preview/edit toggle) ── */
  const [carouselImages, setCarouselImages] = useState<CarouselImage[]>(
    () =>
      initialCarouselImages ??
      (existingImages ?? []).map((url, i) => ({
        id: `existing-${i}`,
        url,
      })),
  );
  const [managerOpen, setManagerOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [theme, setTheme] = useState<EventTheme>(
    initialData?.theme ?? { ...DEFAULT_THEME },
  );

  /* Sync form.imageUrls whenever carouselImages changes */
  useEffect(() => {
    const urls = carouselImages
      .filter((i) => i.url && !i.uploading)
      .map((i) => i.url);
    setForm((prev) => ({ ...prev, imageUrls: urls }));
  }, [carouselImages]);

  /* Sync form.theme whenever theme changes */
  useEffect(() => {
    setForm((prev) => ({ ...prev, theme }));
  }, [theme]);

  /* ── Derived theme values ── */
  const colors = useMemo(() => getThemeColors(theme.mode), [theme.mode]);
  const isDark = colors.isDark;

  const pageBgClass = colors.pageBg;
  const pageTextClass = colors.text;

  /** Accent gradient for the content background */
  const accentGradient = useMemo(
    () => getAccentGradient(theme.accent, isDark, theme.accentCustom),
    [theme.accent, theme.accentCustom, isDark],
  );

  /** Cards should use darker surfaces when the page is in dark mode */
  const cardDark = isDark;

  /* ── Auto-save (field-group-aware, debounced) ── */
  const broadcastRef = useRef<(groups: FieldGroup[]) => void>(() => {});

  const performAutoSave = useCallback(
    async (dirtyGroups: FieldGroup[]) => {
      try {
        if (draftSaved) {
          await patchEvent(
            eventId!,
            dirtyGroups,
            form,
            carouselImages,
            sections,
          );
        } else {
          await createEvent(eventId!, form, carouselImages, sections, "draft");
          setDraftSaved(true);
        }
        broadcastRef.current(dirtyGroups);
        setLastSavedAt(new Date());
      } catch (err) {
        console.error("Auto-save failed:", err);
        throw err; // re-throw so useFieldAutoSave re-queues the groups
      }
    },
    [eventId, form, carouselImages, sections, draftSaved],
  );

  const {
    markDirty,
    flush,
    isSaving: isAutoSaving,
  } = useFieldAutoSave({
    enabled: !!eventId,
    onSave: performAutoSave,
    delay: 2000,
  });

  const handleManagerConfirm = useCallback(
    (updated: CarouselImage[]) => {
      setCarouselImages(updated);
      markDirty("images");
    },
    [markDirty],
  );

  /* ── Attention badge helpers ── */
  const needsStartDate = !form.startDate;
  const needsLocation = !form.location.displayName;
  const needsCategory = !form.category;
  const needsTags = form.tags.length < 2;

  /* FAQ badge: show on AddSection if no FAQ exists, on Add Question if FAQ incomplete */
  const faqSection = sections.find((s) => s.type === "faq") as
    | FAQSectionData
    | undefined;
  const faqComplete =
    !!faqSection &&
    faqSection.items.filter((q) => q.question.trim() && q.answer.trim())
      .length >= 2;
  const needsFaqBadge = !faqComplete;
  const faqBadgeOnAddSection = needsFaqBadge && !faqSection;

  const addSection = (type: SectionType) => {
    setSections((prev) => [...prev, createBlankSection(type)]);
    markDirty(`section:${type}`);
  };

  const updateSection = (index: number, data: SectionData) => {
    setSections((prev) => prev.map((s, i) => (i === index ? data : s)));
    markDirty(`section:${data.type}`);
  };

  const removeSection = (index: number) => {
    const removedType = sections[index].type;
    setSections((prev) => prev.filter((_, i) => i !== index));
    markDirty(`section:${removedType}`);
  };

  // In edit mode, use the actual event creator's profile from the DB.
  // In create mode, fall back to the logged-in user's profile.
  const creatorProfile: ClubProfile = initialCreatorProfile ?? {
    id: profile?.id ?? "",
    first_name: profile?.first_name ?? "You",
    avatar_url: profile?.avatar_url ?? null,
  };

  const updateField = <K extends keyof EventFormData>(
    key: K,
    value: EventFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    markDirty(FIELD_TO_GROUP[key]);
  };

  /* ── Realtime: selectively merge remote changes ── */
  const handleRemoteChange = useCallback(
    async (groups: FieldGroup[]) => {
      if (!eventId || groups.length === 0) return;
      try {
        const result = await fetchEvent(eventId);
        const focused = focusedFieldRef.current;
        const applied: FieldGroup[] = [];

        for (const g of groups) {
          if (g === focused) continue; // dirty-field protection
          applied.push(g);

          switch (g) {
            case "event":
              setForm((prev) => ({
                ...prev,
                name: result.formData.name ?? "",
                description: result.formData.description ?? "",
                startDate: result.formData.startDate ?? "",
                startTime: result.formData.startTime ?? "",
                endDate: result.formData.endDate ?? "",
                endTime: result.formData.endTime ?? "",
                timezone:
                  result.formData.timezone ??
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
                isOnline: result.formData.isOnline ?? false,
                category: result.formData.category ?? "",
                tags: result.formData.tags ?? [],
              }));
              break;
            case "location":
              setForm((prev) => ({
                ...prev,
                location: result.formData.location ?? {
                  displayName: "",
                  address: "",
                },
                isOnline: result.formData.isOnline ?? false,
              }));
              break;
            case "images":
              setCarouselImages(result.carouselImages);
              break;
            case "hosts":
              setForm((prev) => ({
                ...prev,
                hostIds: result.formData.hostIds ?? [],
              }));
              setHostsData(result.hostsData);
              break;
            case "pricing":
              setForm((prev) => ({
                ...prev,
                pricing: result.formData.pricing ?? [],
              }));
              break;
            case "links":
              setForm((prev) => ({
                ...prev,
                links: result.formData.links ?? [],
              }));
              break;
            case "theme":
              if (result.formData.theme) {
                setTheme(result.formData.theme);
                setForm((prev) => ({ ...prev, theme: result.formData.theme! }));
              }
              break;
          }
        }

        // Merge remote section changes (skip sections the local user is focused on)
        const remoteSectionGroups = groups.filter(
          (g) => g.startsWith("section:") && g !== focused,
        );
        if (remoteSectionGroups.length > 0) {
          setSections((prev) => {
            const focusedType = focused?.startsWith("section:")
              ? focused.split(":")[1]
              : null;
            const localFocused = focusedType
              ? prev.find((s) => s.type === focusedType)
              : null;
            return result.sections.map((s) =>
              s.type === focusedType && localFocused ? localFocused : s,
            );
          });
        }

        // Silently applied remote changes — no toast
      } catch (err) {
        console.error("Failed to sync remote changes:", err);
      }
    },
    [eventId],
  );

  const { broadcast, broadcastFocus, collaborators } = useEventRealtime({
    eventId,
    userId: profile?.id,
    userName: profile?.first_name ?? undefined,
    enabled: draftSaved,
    onRemoteChange: handleRemoteChange,
  });

  // Keep broadcastRef in sync with the latest broadcast function
  useEffect(() => {
    broadcastRef.current = broadcast;
  }, [broadcast]);

  /* ── beforeunload: warn if dirty ── */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      // flush is async so we can only warn — the browser doesn't support
      // async work in beforeunload reliably.
      // We rely on the auto-save having already flushed most changes.
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  /* ── Navigate back with flush ── */
  const handleBack = useCallback(async () => {
    await flush();
    router.back();
  }, [flush, router]);

  /* ── Publish ── */
  const handlePublish = async () => {
    if (!form.category) {
      toast.error("Please select a category before publishing.");
      return;
    }
    if (!form.name) {
      toast.error("Please enter an event name before publishing.");
      return;
    }
    setSaving(true);
    try {
      if (draftSaved) {
        await updateEvent(
          eventId!,
          form,
          carouselImages,
          sections,
          "published",
        );
      } else {
        await createEvent(
          eventId!,
          form,
          carouselImages,
          sections,
          "published",
        );
        setDraftSaved(true);
      }
      setEventStatus("published");
      broadcast([
        "event",
        "location",
        "images",
        "hosts",
        "pricing",
        "links",
        "theme",
        ...sections.map((s) => `section:${s.type}` as FieldGroup),
      ]);
      toast.success("Event published!");
      router.push(`/events/${eventId}`);
    } catch (err) {
      console.error("Failed to publish event:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to publish event",
      );
    } finally {
      setSaving(false);
    }
  };

  /* ── Unpublish (revert to draft) ── */
  const handleUnpublish = async () => {
    setSaving(true);
    try {
      await updateEvent(eventId!, form, carouselImages, sections, "draft");
      setEventStatus("draft");
      broadcast([
        "event",
        "location",
        "images",
        "hosts",
        "pricing",
        "links",
        "theme",
        ...sections.map((s) => `section:${s.type}` as FieldGroup),
      ]);
      toast.success("Event unpublished — moved back to drafts.");
    } catch (err) {
      console.error("Failed to unpublish event:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to unpublish event",
      );
    } finally {
      setSaving(false);
    }
  };

  /* ── Section-level DnD ── */
  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const sectionIds = useMemo(() => sections.map((s) => s.type), [sections]);

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectionIds.indexOf(active.id as SectionType);
    const newIndex = sectionIds.indexOf(over.id as SectionType);
    setSections((prev) => arrayMove(prev, oldIndex, newIndex));
    markDirty(...sections.map((s) => `section:${s.type}` as FieldGroup));
  };

  /* ── Field focus broadcasting ── */
  const handleFieldFocus = useCallback(
    (field: FieldGroup) => {
      focusedFieldRef.current = field;
      broadcastFocus(field);
    },
    [broadcastFocus],
  );

  const handleFieldBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      // Only clear focus if moving outside the field group wrapper
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        focusedFieldRef.current = null;
        broadcastFocus(null);
      }
    },
    [broadcastFocus],
  );

  /* ── Render a single section (edit or preview) ── */
  const renderSectionContent = (
    section: SectionData,
    index: number,
    dragHandleProps?: DragHandleProps,
  ) => (
    <div
      ref={section.type === "faq" ? faqsRef : undefined}
      className="relative mt-8"
      onFocus={() => handleFieldFocus(`section:${section.type}`)}
      onBlur={handleFieldBlur}
    >
      <CollaboratorBadge
        group={`section:${section.type}`}
        collaborators={collaborators}
      />
      {isEditing && section.type === "faq" && needsFaqBadge && (
        <AttentionBadge show />
      )}
      <EventSectionField
        mode={viewMode}
        section={section}
        index={index}
        layout={theme.layout}
        isDark={cardDark}
        dragHandleProps={dragHandleProps}
        onChange={updateSection}
        onRemove={removeSection}
      />
    </div>
  );

  /* Solid bg color — only honoured in card layout */
  const solidBg =
    theme.layout === "card" && theme.bgColor ? theme.bgColor : undefined;

  return (
    <div
      className={cn("min-h-screen pb-12", pageBgClass, colors.isDark && "dark")}
      style={solidBg ? { backgroundColor: solidBg } : undefined}
    >
      {/* Toolbar */}
      <div
        className={cn(
          "sticky top-14 z-40 border-b transition-all shadow-lg",
          isDark
            ? "border-neutral-700/60 bg-neutral-900/60 text-neutral-100 backdrop-blur-xl"
            : "bg-background/95 backdrop-blur",
          toolbarCollapsed && "border-b-0! shadow-none!",
        )}
      >
        <div
          className={cn(
            "mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 sm:px-6 transition-all overflow-hidden",
            toolbarCollapsed ? "h-0" : "h-14",
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 shrink-0"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              {isAutoSaving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving…
                </>
              ) : (
                lastSavedAt && <LastSavedLabel date={lastSavedAt} />
              )}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setThemeOpen(true)}
            >
              <Palette className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Theme</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setPreviewMode((p) => !p)}
            >
              {previewMode ? (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Preview</span>
                </>
              )}
            </Button>
            {eventStatus === "published" ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={handleUnpublish}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Unpublish</span>
              </Button>
            ) : (
              <Button
                size="sm"
                className="shrink-0"
                onClick={handlePublish}
                disabled={saving || !form.name}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <span>Publish</span>
              </Button>
            )}
          </div>
        </div>

        {/* Collapse / expand toggle */}
        <button
          type="button"
          onClick={() => setToolbarCollapsed((c) => !c)}
          className={cn(
            "absolute -bottom-6 right-4 z-50 flex h-6 w-8 items-center justify-center rounded-b-md border border-t-0 shadow-sm transition-colors",
            isDark
              ? "border-neutral-700/60 bg-neutral-900/80 text-neutral-300 hover:text-neutral-100"
              : "border-border/60 bg-background/95 text-muted-foreground hover:text-foreground",
          )}
        >
          {toolbarCollapsed ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* ── Full-width accent gradient overlay ── */}
      <div style={accentGradient ? { background: accentGradient } : undefined}>
        {/* ── Single unified layout ── */}
        <div
          className={cn(
            "mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-8",
            pageTextClass,
          )}
        >
          {/* Hero Section */}
          <div className="space-y-6">
            <div
              ref={thumbnailRef}
              className="relative w-full"
              onFocus={() => handleFieldFocus("images")}
              onBlur={handleFieldBlur}
            >
              <CollaboratorBadge group="images" collaborators={collaborators} />
              <EventImageField
                mode={viewMode}
                images={carouselImages}
                existingImages={existingImages}
                onEditClick={() => setManagerOpen(true)}
              />
            </div>

            <SectionWrapper title="" layout={theme.layout} isDark={cardDark}>
              <div className="space-y-6">
                <div
                  onFocus={() => handleFieldFocus("event")}
                  onBlur={handleFieldBlur}
                >
                  <CollaboratorBadge
                    group="event"
                    collaborators={collaborators}
                  />
                  <EventNameField
                    mode={viewMode}
                    value={form.name}
                    onChange={(v) => updateField("name", v)}
                    className={pageTextClass}
                  />
                </div>

                <div
                  className={cn(
                    "flex flex-wrap items-center",
                    isEditing ? "gap-6" : "gap-2",
                  )}
                >
                  <div ref={categoryRef} className="relative">
                    {isEditing && <AttentionBadge show={needsCategory} />}
                    <EventCategoryField
                      mode={viewMode}
                      value={form.category}
                      onChange={(cat) => updateField("category", cat)}
                    />
                  </div>
                  <Separator
                    className={isEditing ? "h-6!" : "h-5!"}
                    orientation="vertical"
                  />
                  <div ref={tagsRef} className="relative">
                    {isEditing && <AttentionBadge show={needsTags} />}
                    <EventTagsField
                      mode={viewMode}
                      value={form.tags}
                      onChange={(tags) => updateField("tags", tags)}
                    />
                  </div>
                </div>

                {/* Meta rows */}
                <div className="space-y-3">
                  <div
                    ref={startDateRef}
                    className={cn("relative", isEditing && "w-fit")}
                  >
                    {isEditing && <AttentionBadge show={needsStartDate} />}
                    <EventDateField
                      mode={viewMode}
                      value={{
                        startDate: form.startDate,
                        startTime: form.startTime,
                        endDate: form.endDate,
                        endTime: form.endTime,
                        timezone: form.timezone,
                      }}
                      onChange={(d) => {
                        setForm((prev) => ({
                          ...prev,
                          startDate: d.startDate,
                          startTime: d.startTime,
                          endDate: d.endDate,
                          endTime: d.endTime,
                          timezone: d.timezone,
                        }));
                        markDirty("event");
                      }}
                    />
                  </div>
                  <div
                    ref={locationRef}
                    className={cn("relative", isEditing && "w-fit")}
                    onFocus={() => handleFieldFocus("location")}
                    onBlur={handleFieldBlur}
                  >
                    {isEditing && <AttentionBadge show={needsLocation} />}
                    <CollaboratorBadge
                      group="location"
                      collaborators={collaborators}
                    />
                    <EventLocationField
                      mode={viewMode}
                      value={form.location}
                      onChange={(loc) => updateField("location", loc)}
                    />
                  </div>
                  <div
                    onFocus={() => handleFieldFocus("hosts")}
                    onBlur={handleFieldBlur}
                    className="relative"
                  >
                    <CollaboratorBadge
                      group="hosts"
                      collaborators={collaborators}
                    />
                    <EventHostsField
                      mode={viewMode}
                      creatorProfile={creatorProfile}
                      value={{ ids: form.hostIds, data: hostsData }}
                      onChange={({ ids, data }) => {
                        updateField("hostIds", ids);
                        setHostsData(data);
                      }}
                      eventId={eventId}
                      eventSaved={draftSaved}
                      onInvitesSent={() => {
                        // Trigger auto-save after invites are sent
                        markDirty("hosts");
                      }}
                    />
                  </div>
                  <div
                    onFocus={() => handleFieldFocus("pricing")}
                    onBlur={handleFieldBlur}
                    className="relative"
                  >
                    <CollaboratorBadge
                      group="pricing"
                      collaborators={collaborators}
                    />
                    <EventPricingField
                      mode={viewMode}
                      value={form.pricing}
                      onChange={(tiers) => updateField("pricing", tiers)}
                    />
                  </div>
                  <div
                    onFocus={() => handleFieldFocus("links")}
                    onBlur={handleFieldBlur}
                    className="relative"
                  >
                    <CollaboratorBadge
                      group="links"
                      collaborators={collaborators}
                    />
                    <EventLinksField
                      mode={viewMode}
                      value={form.links}
                      onChange={(links) => updateField("links", links)}
                    />
                  </div>
                </div>
              </div>
            </SectionWrapper>
          </div>

          {/* Content cards */}
          <div
            className={cn(
              "mt-10",
              theme.layout === "classic" ? "space-y-10" : "space-y-6",
            )}
          >
            <div
              onFocus={() => handleFieldFocus("event")}
              onBlur={handleFieldBlur}
              className="relative"
            >
              <CollaboratorBadge group="event" collaborators={collaborators} />
              <EventDescriptionField
                mode={viewMode}
                value={form.description}
                onChange={(v) => updateField("description", v)}
                layout={theme.layout}
                isDark={cardDark}
              />
            </div>

            <div>
              {isEditing ? (
                <DndContext
                  sensors={sectionSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSectionDragEnd}
                >
                  <SortableContext
                    items={sectionIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {sections.map((section, i) => (
                      <SortableSectionWrapper
                        key={section.type}
                        id={section.type}
                      >
                        {(dragHandleProps) =>
                          renderSectionContent(section, i, dragHandleProps)
                        }
                      </SortableSectionWrapper>
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                sections.map((section, i) => (
                  <div key={section.type}>
                    {renderSectionContent(section, i)}
                  </div>
                ))
              )}

              {isEditing && (
                <div ref={!faqSection ? faqsRef : undefined}>
                  <AddSectionButton
                    activeSections={sections.map((s) => s.type)}
                    onAdd={addSection}
                    showAttentionBadge={faqBadgeOnAddSection}
                    isDark={isDark}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image manager dialog */}
      <ImageManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
        images={carouselImages}
        onConfirm={handleManagerConfirm}
        eventId={eventId!}
      />

      {/* Theme dialog */}
      <ThemeDialog
        open={themeOpen}
        onOpenChange={setThemeOpen}
        theme={theme}
        onConfirm={(t) => {
          setTheme(t);
          markDirty("theme");
        }}
      />

      {/* Floating checklist (edit mode only) */}
      {isEditing && (
        <EventChecklist
          form={form}
          sections={sections}
          hasExistingThumbnail={carouselImages.length > 0}
          elementRefs={checklistRefs}
          dismissed={dismissed}
          onDismissChange={setDismissed}
          isDark={isDark}
        />
      )}
    </div>
  );
}
