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
  Loader2,
  Palette,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
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
  /** Form mode */
  mode?: "create" | "edit";
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

export default function EventForm({
  initialData,
  existingImages,
  mode = "create",
}: EventFormProps) {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
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
    imageFiles: initialData?.imageFiles ?? [],
    pricing: initialData?.pricing ?? [],
    theme: initialData?.theme ?? { ...DEFAULT_THEME },
  } as EventFormData);

  // Cache the full profile objects for additional hosts
  const [hostsData, setHostsData] = useState<ClubProfile[]>([]);

  // Dynamic section cards
  const [sections, setSections] = useState<SectionData[]>([]);

  /* ── Carousel images (lifted state — persists across preview/edit toggle) ── */
  const [carouselImages, setCarouselImages] = useState<CarouselImage[]>(() =>
    (existingImages ?? []).map((url, i) => ({
      id: `existing-${i}`,
      file: null,
      preview: url,
    })),
  );
  const [managerOpen, setManagerOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [theme, setTheme] = useState<EventTheme>(
    initialData?.theme ?? { ...DEFAULT_THEME },
  );

  /* Sync form.imageFiles whenever carouselImages changes */
  useEffect(() => {
    const files = carouselImages.filter((i) => i.file).map((i) => i.file!);
    setForm((prev) => ({ ...prev, imageFiles: files }));
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

  const handleManagerConfirm = useCallback((updated: CarouselImage[]) => {
    setCarouselImages(updated);
  }, []);

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
  };

  const updateSection = (index: number, data: SectionData) => {
    setSections((prev) => prev.map((s, i) => (i === index ? data : s)));
  };

  const removeSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  // Build creator profile for the hosts picker (always included)
  const creatorProfile: ClubProfile = {
    id: profile?.id ?? "",
    first_name: profile?.first_name ?? "You",
    avatar_url: profile?.avatar_url ?? null,
  };

  const updateField = <K extends keyof EventFormData>(
    key: K,
    value: EventFormData[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.category) {
      toast.error("Please select a category before submitting.");
      return;
    }
    setSaving(true);
    try {
      // TODO: implement actual save logic (API call)
      console.log("Saving event:", form);
      await new Promise((r) => setTimeout(r, 1000)); // placeholder
      router.push("/");
    } catch (err) {
      console.error("Failed to save event:", err);
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
  };

  /* ── Render a single section (edit or preview) ── */
  const renderSectionContent = (
    section: SectionData,
    index: number,
    dragHandleProps?: DragHandleProps,
  ) => (
    <div
      ref={section.type === "faq" ? faqsRef : undefined}
      className="relative"
    >
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
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>

          <div className="flex items-center gap-1.5 sm:gap-2">
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
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="shrink-0"
              onClick={handleSave}
              disabled={saving || !form.name}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <span className="hidden sm:inline">
                {mode === "create" ? "Create Event" : "Save Changes"}
              </span>
              <span className="sm:hidden">
                {mode === "create" ? "Create" : "Save"}
              </span>
            </Button>
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
            <div ref={thumbnailRef} className="relative w-full">
              <EventImageField
                mode={viewMode}
                images={carouselImages}
                existingImages={existingImages}
                onEditClick={() => setManagerOpen(true)}
              />
            </div>

            <SectionWrapper title="" layout={theme.layout} isDark={cardDark}>
              <div className="space-y-6">
                <EventNameField
                  mode={viewMode}
                  value={form.name}
                  onChange={(v) => updateField("name", v)}
                  className={pageTextClass}
                />

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
                      onChange={(d) =>
                        setForm((prev) => ({
                          ...prev,
                          startDate: d.startDate,
                          startTime: d.startTime,
                          endDate: d.endDate,
                          endTime: d.endTime,
                          timezone: d.timezone,
                        }))
                      }
                    />
                  </div>
                  <div
                    ref={locationRef}
                    className={cn("relative", isEditing && "w-fit")}
                  >
                    {isEditing && <AttentionBadge show={needsLocation} />}
                    <EventLocationField
                      mode={viewMode}
                      value={form.location}
                      onChange={(loc) => updateField("location", loc)}
                    />
                  </div>
                  <EventHostsField
                    mode={viewMode}
                    creatorProfile={creatorProfile}
                    value={{ ids: form.hostIds, data: hostsData }}
                    onChange={({ ids, data }) => {
                      updateField("hostIds", ids);
                      setHostsData(data);
                    }}
                  />
                  <EventPricingField
                    mode={viewMode}
                    value={form.pricing}
                    onChange={(tiers) => updateField("pricing", tiers)}
                  />
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
            <EventDescriptionField
              mode={viewMode}
              value={form.description}
              onChange={(v) => updateField("description", v)}
              layout={theme.layout}
              isDark={cardDark}
            />

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
                <div key={section.type}>{renderSectionContent(section, i)}</div>
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

      {/* Image manager dialog */}
      <ImageManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
        images={carouselImages}
        onConfirm={handleManagerConfirm}
      />

      {/* Theme dialog */}
      <ThemeDialog
        open={themeOpen}
        onOpenChange={setThemeOpen}
        theme={theme}
        onConfirm={setTheme}
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
