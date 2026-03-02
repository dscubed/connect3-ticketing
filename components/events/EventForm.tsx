"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EventImageUpload } from "@/components/events/EventImageUpload";
import {
  EventDatePicker,
  type DateTimeData,
} from "@/components/events/EventDatePicker";
import {
  EventHostsPicker,
  type ClubProfile,
} from "@/components/events/EventHostsPicker";
import { EventCategoryPicker } from "@/components/events/EventCategoryPicker";
import { EventTagsPicker } from "@/components/events/EventTagsPicker";
import {
  EventLocationPicker,
  type LocationData,
} from "@/components/events/EventLocationPicker";
import {
  EventChecklist,
  AttentionBadge,
  type ChecklistRefMap,
} from "@/components/events/EventChecklist";
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
} from "@/components/events/sections";
import { useAuthStore } from "@/stores/authStore";
import {
  ArrowLeft,
  MapPin,
  Users,
  Loader2,
  Eye,
  Pencil,
  CalendarDays,
  HelpCircle,
  Backpack,
  Mic,
  Building2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export interface EventFormData {
  name: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timezone: string;
  location: LocationData;
  isOnline: boolean;
  category: string;
  tags: string[];
  hostIds: string[];
  thumbnailFile: File | null;
}

interface EventFormProps {
  /** Pre-filled data for edit mode */
  initialData?: Partial<EventFormData>;
  /** Existing thumbnail URL (edit mode) */
  existingThumbnail?: string | null;
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

/* ── Preview card renderers ── */
function PreviewFAQ({ data }: { data: SectionData & { type: "faq" } }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">FAQ</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.items
          .filter((q) => q.question || q.answer)
          .map((q, i) => (
            <div key={i}>
              <p className="font-medium">{q.question || "Untitled question"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {q.answer || "No answer yet"}
              </p>
            </div>
          ))}
        {data.items.every((q) => !q.question && !q.answer) && (
          <p className="text-sm text-muted-foreground italic">
            No questions added yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PreviewWhatToBring({
  data,
}: {
  data: SectionData & { type: "what-to-bring" };
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Backpack className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">What To Bring</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {data.items
            .filter((it) => it.item)
            .map((it, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                  {i + 1}
                </span>
                {it.item}
              </li>
            ))}
        </ul>
        {data.items.every((it) => !it.item) && (
          <p className="text-sm text-muted-foreground italic">
            No items added yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PreviewPanelists({
  data,
}: {
  data: SectionData & { type: "panelists" };
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Panelists / Lineup</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {data.items
            .filter((p) => p.name)
            .map((p, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2 text-center"
              >
                <Avatar className="h-16 w-16">
                  {p.imageUrl ? (
                    <AvatarImage src={p.imageUrl} alt={p.name} />
                  ) : null}
                  <AvatarFallback>
                    {p.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  {p.title && (
                    <p className="text-xs text-muted-foreground">{p.title}</p>
                  )}
                </div>
              </div>
            ))}
        </div>
        {data.items.every((p) => !p.name) && (
          <p className="text-sm text-muted-foreground italic">
            No panelists added yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PreviewCompanies({
  data,
}: {
  data: SectionData & { type: "companies" };
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Companies</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
          {data.items
            .filter((c) => c.name || c.logoUrl)
            .map((c, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2 text-center"
              >
                <Avatar className="h-14 w-14 rounded-lg">
                  {c.logoUrl ? (
                    <AvatarImage
                      src={c.logoUrl}
                      alt={c.name}
                      className="rounded-lg"
                    />
                  ) : null}
                  <AvatarFallback className="rounded-lg">
                    {(c.name || "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <p className="text-xs font-medium">{c.name || "Unnamed"}</p>
              </div>
            ))}
        </div>
        {data.items.every((c) => !c.name && !c.logoUrl) && (
          <p className="text-sm text-muted-foreground italic">
            No companies added yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function EventForm({
  initialData,
  existingThumbnail,
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
    thumbnailFile: null,
  });

  // Cache the full profile objects for additional hosts
  const [hostsData, setHostsData] = useState<ClubProfile[]>([]);

  // Dynamic section cards
  const [sections, setSections] = useState<SectionData[]>([]);

  /* ── Attention badge helpers ── */
  const needsThumbnail = !form.thumbnailFile && !existingThumbnail;
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

  /* ── Helper: format date for preview ── */
  const formatPreviewDate = () => {
    if (!form.startDate) return "TBA";
    const parts: string[] = [];
    const d = new Date(form.startDate + "T00:00:00");
    const dateStr = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    parts.push(dateStr);
    if (form.startTime) parts[0] += ` at ${form.startTime}`;
    if (form.endDate) {
      const ed = new Date(form.endDate + "T00:00:00");
      let endStr = ed.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      if (form.endTime) endStr += ` at ${form.endTime}`;
      parts.push(endStr);
    }
    return parts.join(" – ");
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
        return <PreviewFAQ data={section} />;
      case "what-to-bring":
        return <PreviewWhatToBring data={section} />;
      case "panelists":
        return <PreviewPanelists data={section} />;
      case "companies":
        return <PreviewCompanies data={section} />;
    }
  };

  /* ── Thumbnail preview URL ── */
  const thumbnailUrl = form.thumbnailFile
    ? URL.createObjectURL(form.thumbnailFile)
    : existingThumbnail;

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
            {/* Thumbnail */}
            {thumbnailUrl && (
              <div className="flex justify-center">
                <div className="w-2/3 overflow-hidden rounded-xl">
                  <Image
                    src={thumbnailUrl}
                    alt="Event thumbnail"
                    width={600}
                    height={600}
                    className="aspect-square w-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Event name */}
            <h1 className="text-4xl font-bold tracking-tight">
              {form.name || "Untitled Event"}
            </h1>

            {/* Category + tags */}
            {(form.category || form.tags.length > 0) && (
              <div className="flex flex-wrap items-center gap-2">
                {form.category && (
                  <Badge variant="secondary">{form.category}</Badge>
                )}
                {form.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Meta rows */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="text-base">{formatPreviewDate()}</span>
              </div>
              {form.location.displayName && (
                <div className="flex min-w-0 items-center gap-3">
                  <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 items-baseline gap-1.5">
                    <span className="shrink-0 text-base font-medium">
                      {form.location.displayName}
                    </span>
                    {form.location.address && (
                      <span className="truncate text-sm text-muted-foreground">
                        {form.location.address}
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="flex items-center -space-x-2">
                  <Avatar className="h-8 w-8 border-2 border-background">
                    {creatorProfile.avatar_url && (
                      <AvatarImage
                        src={creatorProfile.avatar_url}
                        alt={creatorProfile.first_name}
                      />
                    )}
                    <AvatarFallback className="text-xs">
                      {creatorProfile.first_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {hostsData.map((h) => (
                    <Avatar
                      key={h.id}
                      className="h-8 w-8 border-2 border-background"
                    >
                      {h.avatar_url && (
                        <AvatarImage src={h.avatar_url} alt={h.first_name} />
                      )}
                      <AvatarFallback className="text-xs">
                        {h.first_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {creatorProfile.first_name}
                  {hostsData.length > 0 &&
                    ` + ${hostsData.length} other${hostsData.length > 1 ? "s" : ""}`}
                </span>
              </div>
            </div>
          </div>

          {/* Content cards */}
          <div className="mt-10 space-y-6">
            {/* Description */}
            {form.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Event Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {form.description}
                  </p>
                </CardContent>
              </Card>
            )}

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
            {/* Thumbnail (1:1, half width, centred) */}
            <div className="flex justify-center">
              <div ref={thumbnailRef} className="relative w-full sm:w-2/5">
                <AttentionBadge show={needsThumbnail} />
                <EventImageUpload
                  currentImage={existingThumbnail}
                  onImageChange={(file) => updateField("thumbnailFile", file)}
                />
              </div>
            </div>

            {/* Event Name */}
            <Input
              placeholder="Event name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="h-auto border-0 bg-transparent px-0 text-5xl! font-bold tracking-tight placeholder:text-muted-foreground/40 focus-visible:ring-0"
            />

            {/* Category pill + Tags pills */}
            <div className="flex flex-wrap items-center gap-6">
              <div ref={categoryRef} className="relative">
                <AttentionBadge show={needsCategory} />
                <EventCategoryPicker
                  value={form.category}
                  onChange={(cat) => updateField("category", cat)}
                />
              </div>
              <Separator className="h-6!" orientation="vertical" />
              <div ref={tagsRef} className="relative">
                <AttentionBadge show={needsTags} />
                <EventTagsPicker
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
                <EventDatePicker
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
                <EventLocationPicker
                  value={form.location}
                  onChange={(loc: LocationData) => updateField("location", loc)}
                />
              </div>

              {/* Hosts */}
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
                <EventHostsPicker
                  creatorProfile={creatorProfile}
                  selectedHosts={form.hostIds}
                  selectedHostsData={hostsData}
                  onChange={(ids, data) => {
                    updateField("hostIds", ids);
                    setHostsData(data);
                  }}
                />
              </div>
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

      {/* Floating checklist (edit mode only) */}
      {!previewMode && (
        <EventChecklist
          form={form}
          sections={sections}
          hasExistingThumbnail={!!existingThumbnail}
          elementRefs={checklistRefs}
          dismissed={dismissed}
          onDismissChange={setDismissed}
        />
      )}
    </div>
  );
}
