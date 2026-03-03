"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

/* ── Shared ── */
import type {
  DateTimeData,
  LocationData,
  ClubProfile,
  EventFormData,
  CarouselImage,
} from "./shared/types";

/* ── Create-mode components ── */
import { ImageCarousel } from "./create/ImageCarousel";
import { ImageManagerDialog } from "./create/ImageManagerDialog";
import { DatePicker } from "./create/DatePicker";
import { LocationPicker } from "./create/LocationPicker";
import { HostsPicker } from "./create/HostsPicker";
import { CategoryPicker } from "./create/CategoryPicker";
import { TagsPicker } from "./create/TagsPicker";
import { PricingPicker } from "./create/PricingPicker";

/* ── Preview-mode components ── */
import {
  ImageCarouselPreview,
  CategoryDisplay,
  TagsDisplay,
  DateDisplay,
  LocationDisplay,
  HostsDisplay,
  DescriptionCard,
  FAQCard,
  WhatToBringCard,
  PanelistsCard,
  CompaniesCard,
  PricingDisplay,
} from "./preview";

/* ── Other ── */
import {
  EventChecklist,
  AttentionBadge,
  type ChecklistRefMap,
} from "./EventChecklist";
import {
  FAQSectionCard,
  WhatToBringSectionCard,
  PanelistsSectionCard,
  CompaniesSectionCard,
  AddSectionButton,
  createBlankSection,
  type SectionType,
  type SectionData,
  type FAQSectionData,
  type DragHandleProps,
} from "./sections";
import { useAuthStore } from "@/stores/authStore";
import { ArrowLeft, Eye, Loader2, Pencil, Users } from "lucide-react";
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
  });

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

  /* Sync form.imageFiles whenever carouselImages changes */
  useEffect(() => {
    const files = carouselImages.filter((i) => i.file).map((i) => i.file!);
    setForm((prev) => ({ ...prev, imageFiles: files }));
  }, [carouselImages]);

  /* Derive preview URLs from carousel state */
  const imagePreviewUrls = useMemo(
    () => carouselImages.map((i) => i.preview),
    [carouselImages],
  );

  const handleManagerConfirm = useCallback((updated: CarouselImage[]) => {
    setCarouselImages(updated);
  }, []);

  /* ── Attention badge helpers ── */
  const needsThumbnail = carouselImages.length === 0 && !existingImages?.length;
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

  /* ── Render section card (edit mode) ── */
  const renderEditSection = (
    section: SectionData,
    index: number,
    dragHandleProps: DragHandleProps,
  ) => {
    switch (section.type) {
      case "faq":
        return (
          <FAQSectionCard
            data={section}
            onChange={(d) => updateSection(index, d)}
            onRemove={() => removeSection(index)}
            dragHandleProps={dragHandleProps}
          />
        );
      case "what-to-bring":
        return (
          <WhatToBringSectionCard
            data={section}
            onChange={(d) => updateSection(index, d)}
            onRemove={() => removeSection(index)}
            dragHandleProps={dragHandleProps}
          />
        );
      case "panelists":
        return (
          <PanelistsSectionCard
            data={section}
            onChange={(d) => updateSection(index, d)}
            onRemove={() => removeSection(index)}
            dragHandleProps={dragHandleProps}
          />
        );
      case "companies":
        return (
          <CompaniesSectionCard
            data={section}
            onChange={(d) => updateSection(index, d)}
            onRemove={() => removeSection(index)}
            dragHandleProps={dragHandleProps}
          />
        );
    }
  };

  /* ── Render section card (preview mode) ── */
  const renderPreviewSection = (section: SectionData) => {
    switch (section.type) {
      case "faq":
        return <FAQCard data={section} />;
      case "what-to-bring":
        return <WhatToBringCard data={section} />;
      case "panelists":
        return <PanelistsCard data={section} />;
      case "companies":
        return <CompaniesCard data={section} />;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Top bar */}
      <div className="sticky top-14 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {/* Preview / Edit toggle */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setPreviewMode((p) => !p)}
            >
              {previewMode ? (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !form.name}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Create Event" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      {previewMode ? (
        /* ═══════════════ PREVIEW MODE ═══════════════ */
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="space-y-6">
            {/* Photos carousel */}
            <ImageCarouselPreview
              value={
                imagePreviewUrls.length > 0
                  ? imagePreviewUrls
                  : (existingImages ?? [])
              }
            />

            {/* Event name */}
            <h1 className="text-4xl font-bold tracking-tight">
              {form.name || "Untitled Event"}
            </h1>

            {/* Category + tags */}
            <div className="flex flex-wrap items-center gap-2">
              <CategoryDisplay value={form.category} />
              <Separator className="h-5!" orientation="vertical" />
              <TagsDisplay value={form.tags} />
            </div>

            {/* Meta rows */}
            <div className="space-y-3">
              <DateDisplay
                value={{
                  startDate: form.startDate,
                  startTime: form.startTime,
                  endDate: form.endDate,
                  endTime: form.endTime,
                  timezone: form.timezone,
                }}
              />
              <LocationDisplay value={form.location} />
              <HostsDisplay creatorProfile={creatorProfile} value={hostsData} />
              <PricingDisplay value={form.pricing} />
            </div>
          </div>

          {/* Content cards */}
          <div className="mt-10 space-y-6">
            <DescriptionCard value={form.description} />

            {/* Dynamic sections */}
            {sections.map((section) => (
              <div key={section.type}>{renderPreviewSection(section)}</div>
            ))}
          </div>
        </div>
      ) : (
        /* ═══════════════ EDIT MODE ═══════════════ */
        <div className="mx-auto max-w-4xl px-6 py-8">
          {/* ── Hero Section ── */}
          <div className="space-y-6">
            {/* Photo carousel (responsive: 1→3→5 visible) */}
            <div ref={thumbnailRef} className="relative w-full">
              <ImageCarousel
                images={carouselImages}
                onEditClick={() => setManagerOpen(true)}
                showAttentionBadge={needsThumbnail}
              />
            </div>

            {/* Event Name */}
            <Input
              placeholder="Event Name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="h-auto border-0 bg-transparent px-0 text-4xl! font-bold tracking-tight placeholder:text-muted-foreground/40 focus-visible:ring-0"
            />

            {/* Category pill + Tags pills */}
            <div className="flex flex-wrap items-center gap-6">
              <div ref={categoryRef} className="relative">
                <AttentionBadge show={needsCategory} />
                <CategoryPicker
                  value={form.category}
                  onChange={(cat) => updateField("category", cat)}
                />
              </div>
              <Separator className="h-6!" orientation="vertical" />
              <div ref={tagsRef} className="relative">
                <AttentionBadge show={needsTags} />
                <TagsPicker
                  value={form.tags}
                  onChange={(tags) => updateField("tags", tags)}
                />
              </div>
            </div>

            {/* ── Meta rows ── */}
            <div className="space-y-3">
              {/* Date */}
              <div ref={startDateRef} className="relative w-fit">
                <AttentionBadge show={needsStartDate} />
                <DatePicker
                  value={{
                    startDate: form.startDate,
                    startTime: form.startTime,
                    endDate: form.endDate,
                    endTime: form.endTime,
                    timezone: form.timezone,
                  }}
                  onChange={(d: DateTimeData) =>
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

              {/* Location */}
              <div ref={locationRef} className="relative w-fit">
                <AttentionBadge show={needsLocation} />
                <LocationPicker
                  value={form.location}
                  onChange={(loc: LocationData) => updateField("location", loc)}
                />
              </div>

              {/* Hosts */}
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
                <HostsPicker
                  creatorProfile={creatorProfile}
                  value={{ ids: form.hostIds, data: hostsData }}
                  onChange={({ ids, data }) => {
                    updateField("hostIds", ids);
                    setHostsData(data);
                  }}
                />
              </div>

              {/* Pricing */}
              <PricingPicker
                value={form.pricing}
                onChange={(tiers) => updateField("pricing", tiers)}
              />
            </div>
          </div>

          {/* ── Content Cards ── */}
          <div className="mt-10 space-y-6">
            {/* Event Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Event Description</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Tell people what your event is about..."
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </CardContent>
            </Card>

            {/* Dynamic section cards (sortable) */}
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
                  <SortableSectionWrapper key={section.type} id={section.type}>
                    {(dragHandleProps) => (
                      <div
                        ref={section.type === "faq" ? faqsRef : undefined}
                        className="relative"
                      >
                        {section.type === "faq" && needsFaqBadge && (
                          <AttentionBadge show />
                        )}
                        {renderEditSection(section, i, dragHandleProps)}
                      </div>
                    )}
                  </SortableSectionWrapper>
                ))}
              </SortableContext>
            </DndContext>

            {/* Add Section / FAQ ref target (when no FAQ exists yet) */}
            <div ref={!faqSection ? faqsRef : undefined}>
              <AddSectionButton
                activeSections={sections.map((s) => s.type)}
                onAdd={addSection}
                showAttentionBadge={faqBadgeOnAddSection}
              />
            </div>
          </div>
        </div>
      )}

      {/* Image manager dialog */}
      <ImageManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
        images={carouselImages}
        onConfirm={handleManagerConfirm}
      />

      {/* Floating checklist (edit mode only) */}
      {!previewMode && (
        <EventChecklist
          form={form}
          sections={sections}
          hasExistingThumbnail={carouselImages.length > 0}
          elementRefs={checklistRefs}
          dismissed={dismissed}
          onDismissChange={setDismissed}
        />
      )}
    </div>
  );
}
