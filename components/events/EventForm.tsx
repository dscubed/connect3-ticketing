"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Shared ── */
import type { ClubProfile, EventFormData, CarouselImage } from "./shared/types";
import {
  EventEditorContext,
  type EventEditorContextValue,
} from "./shared/EventEditorContext";

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
import { DateLocationSection } from "./create/DateLocationSection";
import { EventDetailModal } from "./preview/EventDetailModal";

/* ── Create-only UI (dialogs) ── */
import { ImageManagerDialog } from "./create/ImageManagerDialog";
import { ThemeDialog } from "./create/ThemeDialog";
import { SectionWrapper } from "./preview/SectionWrapper";
import { TicketingButton } from "./TicketingButton";
import { EditorToolbox } from "./shared/EditorToolbox";

/* ── Other ── */
import {
  EventChecklist,
  AttentionBadge,
  type ChecklistRefMap,
} from "./EventChecklist";
import {
  AddSectionButton,
  type SectionData,
  type FAQSectionData,
  type DragHandleProps,
} from "./sections";
import { useAuthStore } from "@/stores/authStore";

import type { FieldGroup } from "@/lib/api/patchEvent";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ── Extracted hooks ── */
import { useEventFormState } from "@/lib/hooks/useEventFormState";
import { useEventAutoSave } from "@/lib/hooks/useEventAutoSave";
import { useEventCollaboration } from "@/lib/hooks/useEventCollaboration";
import { useEventPublish } from "@/lib/hooks/useEventPublish";
import { useEventTicketing } from "@/lib/hooks/useEventTicketing";
import { useEventSections } from "@/lib/hooks/useEventSections";

import type { CollaboratorPresence } from "@/lib/hooks/useEventRealtime";
import type { FetchedEventData } from "@/lib/api/fetchEvent";

interface EventFormProps {
  /** Fetched event data (edit mode). All initial state is derived from this. */
  data?: FetchedEventData;
  /** Event ID — required for edit mode */
  eventId?: string;
  /** Form mode */
  mode?: "create" | "edit";
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

export default function EventForm({
  data,
  eventId,
  mode = "create",
}: EventFormProps) {
  const initialStatus = data?.status ?? "draft";
  const initialTicketingEnabled = data?.ticketingEnabled ?? false;
  const initialCreatorProfile = data?.creatorProfile;
  const initialUrlSlug = data?.urlSlug ?? null;
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);

  /* ── View state ── */
  const [previewMode, setPreviewMode] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const viewMode = previewMode ? "preview" : "edit";
  const isEditing = !previewMode;

  /* ── Modal state ── */
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [dateLocationModalOpen, setDateLocationModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  /* ── Form state (hook) ── */
  const {
    form,
    setForm,
    hostsData,
    setHostsData,
    sections,
    setSections,
    carouselImages,
    setCarouselImages,
    theme,
    setTheme,
    colors,
    isDark,
    accentGradient,
    FIELD_TO_GROUP,
    formRef,
    carouselImagesRef,
    sectionsRef,
  } = useEventFormState({ data });

  const pageBgClass = colors.pageBg;
  const pageTextClass = colors.text;

  /* ── Auto-save (hook) ── */
  const {
    markDirty,
    flush,
    isAutoSaving,
    draftSaved,
    setDraftSaved,
    lastSavedAt,
    broadcastRef,
  } = useEventAutoSave({
    eventId,
    formRef,
    carouselImagesRef,
    sectionsRef,
    mode,
  });

  /* ── Collaboration (hook) ── */
  const {
    broadcast,
    broadcastFocus,
    collaborators,
    focusedFieldRef,
    handleFieldFocus,
    handleFieldBlur,
    getFieldLock,
  } = useEventCollaboration({
    eventId,
    userId: profile?.id,
    userName: profile?.first_name ?? undefined,
    enabled: draftSaved,
    broadcastRef,
    setForm,
    setCarouselImages,
    setHostsData,
    setTheme,
    setSections,
  });

  /* ── Publish (hook) ── */
  const { eventStatus, savingPublish, handlePublish, handleUnpublish } =
    useEventPublish({
      eventId,
      form,
      carouselImages,
      sections,
      draftSaved,
      setDraftSaved,
      broadcast,
      initialStatus,
    });

  /* ── Ticketing (hook) ── */
  const {
    ticketingEnabled,
    ticketingChanging,
    enableTicketing,
    disableTicketing,
  } = useEventTicketing({
    eventId,
    initialEnabled: initialTicketingEnabled,
    pricingCount: (form.pricing ?? []).length,
  });

  /* ── Sections (hook) ── */
  const {
    addSection,
    updateSection,
    removeSection,
    sectionSensors,
    sectionIds,
    handleSectionDragEnd,
  } = useEventSections({
    sections,
    setSections,
    markDirty,
  });

  /* ── Image manager ── */
  const handleManagerConfirm = useCallback(
    (updated: CarouselImage[]) => {
      setCarouselImages(updated);
      markDirty("images");
    },
    [setCarouselImages, markDirty],
  );

  /* ── Creator profile ── */
  const creatorProfile: ClubProfile = initialCreatorProfile ?? {
    id: profile?.id ?? "",
    first_name: profile?.first_name ?? "You",
    avatar_url: profile?.avatar_url ?? null,
  };

  /* ── Form field update helper ── */
  const updateField = <K extends keyof EventFormData>(
    key: K,
    value: EventFormData[K],
  ) => {
    formRef.current = { ...formRef.current, [key]: value };
    setForm((prev) => ({ ...prev, [key]: value }));
    markDirty(FIELD_TO_GROUP[key]);
  };

  /* ── Navigation ── */
  const handleBack = useCallback(async () => {
    await flush();
    router.back();
  }, [flush, router]);

  /* ── Checklist scroll-to refs ── */
  const thumbnailRef = useRef<HTMLDivElement>(null);
  const startDateRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const faqsRef = useRef<HTMLDivElement>(null);

  const checklistRefs: ChecklistRefMap = useMemo(
    () => ({
      thumbnail: thumbnailRef,
      "start-date": startDateRef,
      location: startDateRef,
      category: categoryRef,
      tags: tagsRef,
      faqs: faqsRef,
    }),
    [],
  );

  /* ── Attention badges ── */
  const needsStartDate = !form.startDate;
  const needsLocation = form.locationType === "tba";
  const needsCategory = !form.category;
  const needsTags = form.tags.length < 2;

  const faqSection = sections.find((s) => s.type === "faq") as
    | FAQSectionData
    | undefined;
  const faqComplete =
    !!faqSection &&
    faqSection.items.filter((q) => q.question.trim() && q.answer.trim())
      .length >= 2;
  const needsFaqBadge = !faqComplete;
  const faqBadgeOnAddSection = needsFaqBadge && !faqSection;

  /* ── Context value ── */
  const editorContext: EventEditorContextValue = useMemo(
    () => ({
      eventId,
      mode: eventId ? "edit" : "create",
      initialUrlSlug,
      previewMode,
      setPreviewMode,
      viewMode,
      isEditing,
      toolbarCollapsed,
      setToolbarCollapsed,
      markDirty,
      flush,
      isAutoSaving,
      lastSavedAt,
      eventStatus,
      savingPublish,
      draftSaved,
      ticketingEnabled,
      ticketingChanging,
      handleBack,
      handlePublish,
      handleUnpublish,
      enableTicketing,
      disableTicketing,
      theme,
      setTheme,
      setThemeOpen: setThemeOpen,
      colors,
      isDark,
      hasName: !!form.name,
      form,
      setForm,
      updateField,
      carouselImages,
      hostsData,
      setHostsData,
      creatorProfile,
      collaborators,
      getFieldLock,
      handleFieldFocus,
      handleFieldBlur,
    }),
    [
      eventId,
      initialUrlSlug,
      previewMode,
      viewMode,
      isEditing,
      toolbarCollapsed,
      markDirty,
      flush,
      isAutoSaving,
      lastSavedAt,
      eventStatus,
      savingPublish,
      draftSaved,
      ticketingEnabled,
      ticketingChanging,
      handleBack,
      handlePublish,
      handleUnpublish,
      enableTicketing,
      disableTicketing,
      theme,
      setTheme,
      colors,
      isDark,
      form,
      setForm,
      updateField,
      carouselImages,
      hostsData,
      setHostsData,
      creatorProfile,
      collaborators,
      getFieldLock,
      handleFieldFocus,
      handleFieldBlur,
    ],
  );

  /* ── Section renderer ── */
  const renderSectionContent = (
    section: SectionData,
    index: number,
    dragHandleProps?: DragHandleProps,
  ) => {
    const sectionGroup = `section:${section.type}` as FieldGroup;
    const sectionLock = getFieldLock(sectionGroup);
    return (
      <div
        ref={section.type === "faq" ? faqsRef : undefined}
        className="relative mt-8"
      >
        <CollaboratorBadge group={sectionGroup} collaborators={collaborators} />
        {isEditing && section.type === "faq" && needsFaqBadge && (
          <AttentionBadge show />
        )}
        <EventSectionField
          section={section}
          index={index}
          dragHandleProps={dragHandleProps}
          onChange={updateSection}
          onRemove={removeSection}
          onFocusChange={(focused) => {
            if (focused) {
              handleFieldFocus(sectionGroup);
              markDirty(sectionGroup);
            } else {
              focusedFieldRef.current = null;
              broadcastFocus(null);
            }
          }}
          locked={sectionLock.locked}
          lockedBy={sectionLock.lockedBy}
        />
      </div>
    );
  };

  const solidBg =
    theme.layout === "card" && theme.bgColor ? theme.bgColor : undefined;

  /* ── Render ── */
  return (
    <EventEditorContext.Provider value={editorContext}>
      <div
        className={cn(
          "min-h-screen pb-12",
          pageBgClass,
          colors.isDark && "dark",
        )}
        style={solidBg ? { backgroundColor: solidBg } : undefined}
      >
        <EditorToolbox />

        {/* Full-width accent gradient overlay */}
        <div
          style={accentGradient ? { background: accentGradient } : undefined}
        >
          <div
            className={cn(
              "mx-auto max-w-4xl px-3 pb-6 pt-12 sm:px-6 sm:pb-8",
              pageTextClass,
            )}
          >
            {/* Hero */}
            <div className="space-y-6">
              <div
                ref={thumbnailRef}
                className="relative w-full"
                onFocus={() => handleFieldFocus("images")}
                onBlur={handleFieldBlur}
              >
                <CollaboratorBadge
                  group="images"
                  collaborators={collaborators}
                />
                <EventImageField onEditClick={() => setManagerOpen(true)} />
              </div>

              <SectionWrapper title="">
                <div className="space-y-6">
                  <div
                    onFocus={() => handleFieldFocus("event")}
                    onBlur={handleFieldBlur}
                  >
                    <CollaboratorBadge
                      group="event"
                      collaborators={collaborators}
                    />
                    <EventNameField />
                  </div>

                  <div
                    className={cn(
                      "flex flex-wrap items-center",
                      isEditing ? "gap-6" : "gap-2",
                    )}
                  >
                    <div ref={categoryRef} className="relative">
                      {isEditing && <AttentionBadge show={needsCategory} />}
                      <EventCategoryField />
                    </div>
                    <Separator
                      className={isEditing ? "h-6!" : "h-5!"}
                      orientation="vertical"
                    />
                    <div ref={tagsRef} className="relative">
                      {isEditing && <AttentionBadge show={needsTags} />}
                      <EventTagsField />
                    </div>
                  </div>

                  {/* Date / Location / Hosts / Pricing / Links */}
                  <div className="space-y-3">
                    <div
                      ref={startDateRef}
                      className="relative"
                      onFocus={() => handleFieldFocus("location")}
                      onBlur={handleFieldBlur}
                    >
                      {isEditing && (
                        <AttentionBadge
                          show={needsStartDate || needsLocation}
                        />
                      )}
                      <CollaboratorBadge
                        group="location"
                        collaborators={collaborators}
                      />
                      <div className="space-y-3">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setDateLocationModalOpen(true)}
                              className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 -mx-2 text-left transition-colors hover:bg-muted/50"
                            >
                              <EventDateField />
                              <Pencil className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDateLocationModalOpen(true)}
                              className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 -mx-2 text-left transition-colors hover:bg-muted/50"
                            >
                              <EventLocationField />
                              <Pencil className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                            <ResponsiveModal
                              open={dateLocationModalOpen}
                              onOpenChange={setDateLocationModalOpen}
                              title="Date & location"
                              className="max-w-lg"
                            >
                              <div className="overflow-y-auto max-h-[70vh] pr-1">
                                <DateLocationSection />
                              </div>
                            </ResponsiveModal>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setDetailModalOpen(true)}
                              className="flex w-full items-center text-left rounded-md px-2 py-1.5 -mx-2 transition-colors hover:bg-muted/50 cursor-pointer"
                            >
                              <EventDateField />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDetailModalOpen(true)}
                              className="flex w-full items-center text-left rounded-md px-2 py-1.5 -mx-2 transition-colors hover:bg-muted/50 cursor-pointer"
                            >
                              <EventLocationField />
                            </button>
                            <EventDetailModal
                              open={detailModalOpen}
                              onOpenChange={setDetailModalOpen}
                            />
                          </>
                        )}
                      </div>
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
                        onInvitesSent={() => markDirty("hosts")}
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
                        onAfterSave={() => flush()}
                        modalOpen={pricingModalOpen}
                        onModalOpenChange={setPricingModalOpen}
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
                      <EventLinksField />
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
              <div className="relative">
                <CollaboratorBadge
                  group="event"
                  collaborators={collaborators}
                />
                <EventDescriptionField
                  onFocusChange={(focused) => {
                    if (focused) {
                      handleFieldFocus("event");
                      markDirty("event");
                    } else {
                      focusedFieldRef.current = null;
                      broadcastFocus(null);
                    }
                  }}
                  locked={getFieldLock("event").locked}
                  lockedBy={getFieldLock("event").lockedBy}
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
          />
        )}

        {/* Sticky ticketing button */}
        {eventId && (
          <TicketingButton
            eventId={eventId}
            draft={eventStatus === "draft"}
            ticketingEnabled={ticketingEnabled}
            onNoTiersClick={() => setPricingModalOpen(true)}
            editor
          />
        )}
      </div>
    </EventEditorContext.Provider>
  );
}
