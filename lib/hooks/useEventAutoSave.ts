"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CarouselImage } from "@/components/events/shared/types";
import type { EventFormData } from "@/components/events/shared/types";
import type { SectionData } from "@/components/events/sections/types";
import type { FieldGroup } from "@/lib/api/patchEvent";
import { patchEvent } from "@/lib/api/patchEvent";
import { createEvent } from "@/lib/api/createEvent";
import { useFieldAutoSave } from "./useFieldAutoSave";

interface UseEventAutoSaveOptions {
  eventId: string | undefined;
  formRef: React.RefObject<EventFormData>;
  carouselImagesRef: React.RefObject<CarouselImage[]>;
  sectionsRef: React.RefObject<SectionData[]>;
  mode: "create" | "edit";
}

/**
 * Wires up throttled auto-save for the event editor.
 * Creates a draft on first save, then patches subsequent changes.
 */
export function useEventAutoSave({
  eventId,
  formRef,
  carouselImagesRef,
  sectionsRef,
  mode,
}: UseEventAutoSaveOptions) {
  const [draftSaved, setDraftSaved] = useState(mode === "edit");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(
    mode === "edit" ? new Date() : null,
  );

  const draftSavedRef = useRef(draftSaved);

  useEffect(() => {
    draftSavedRef.current = draftSaved;
  }, [draftSaved]);

  /** Ref that collaboration hook sets to broadcast after saves. */
  const broadcastRef = useRef<(groups: FieldGroup[]) => void>(() => {});

  const performAutoSave = useCallback(
    async (dirtyGroups: FieldGroup[]) => {
      const latestForm = formRef.current;
      const latestImages = carouselImagesRef.current;
      const latestSections = sectionsRef.current;
      const latestDraftSaved = draftSavedRef.current;
      try {
        if (latestDraftSaved) {
          await patchEvent(
            eventId!,
            dirtyGroups,
            latestForm,
            latestImages,
            latestSections,
          );
        } else {
          await createEvent(
            eventId!,
            latestForm,
            latestImages,
            latestSections,
            "draft",
          );
          setDraftSaved(true);
          draftSavedRef.current = true;
        }
        broadcastRef.current(dirtyGroups);
        setLastSavedAt(new Date());
      } catch (err) {
        console.error("Auto-save failed:", err);
        throw err;
      }
    },
    [eventId, formRef, carouselImagesRef, sectionsRef],
  );

  const {
    markDirty,
    flush,
    isSaving: isAutoSaving,
    hasPendingChanges,
  } = useFieldAutoSave({
    enabled: !!eventId,
    onSave: performAutoSave,
    delay: 2000,
  });

  /* beforeunload: only warn when there are unsaved changes */
  useEffect(() => {
    if (!hasPendingChanges && !isAutoSaving) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasPendingChanges, isAutoSaving]);

  return {
    markDirty,
    flush,
    isAutoSaving,
    hasPendingChanges,
    draftSaved,
    setDraftSaved,
    lastSavedAt,
    setLastSavedAt,
    broadcastRef,
  };
}
