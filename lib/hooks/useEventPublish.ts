"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { EventFormData, CarouselImage } from "@/components/events/shared/types";
import type { SectionData } from "@/components/events/sections/types";
import type { FieldGroup } from "@/lib/api/patchEvent";
import { updateEvent } from "@/lib/api/updateEvent";
import { createEvent } from "@/lib/api/createEvent";
import { toast } from "sonner";

interface UseEventPublishOptions {
  eventId: string | undefined;
  form: EventFormData;
  carouselImages: CarouselImage[];
  sections: SectionData[];
  draftSaved: boolean;
  setDraftSaved: (saved: boolean) => void;
  broadcast: (groups: FieldGroup[]) => void;
  initialStatus?: "draft" | "published" | "archived";
}

/** Publish / unpublish actions for the event editor. */
export function useEventPublish({
  eventId,
  form,
  carouselImages,
  sections,
  draftSaved,
  setDraftSaved,
  broadcast,
  initialStatus = "draft",
}: UseEventPublishOptions) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [eventStatus, setEventStatus] = useState<
    "draft" | "published" | "archived"
  >(initialStatus);

  const allGroups = useCallback(
    (): FieldGroup[] => [
      "event",
      "location",
      "images",
      "hosts",
      "pricing",
      "links",
      "theme",
      ...sections.map((s) => `section:${s.type}` as FieldGroup),
    ],
    [sections],
  );

  const handlePublish = useCallback(async () => {
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
        await updateEvent(eventId!, form, carouselImages, sections, "published");
      } else {
        await createEvent(eventId!, form, carouselImages, sections, "published");
        setDraftSaved(true);
      }
      setEventStatus("published");
      broadcast(allGroups());
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
  }, [
    eventId,
    form,
    carouselImages,
    sections,
    draftSaved,
    setDraftSaved,
    broadcast,
    allGroups,
    router,
  ]);

  const handleUnpublish = useCallback(async () => {
    setSaving(true);
    try {
      await updateEvent(eventId!, form, carouselImages, sections, "draft");
      setEventStatus("draft");
      broadcast(allGroups());
      toast.success("Event unpublished — moved back to drafts.");
    } catch (err) {
      console.error("Failed to unpublish event:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to unpublish event",
      );
    } finally {
      setSaving(false);
    }
  }, [eventId, form, carouselImages, sections, broadcast, allGroups]);

  return {
    eventStatus,
    setEventStatus,
    savingPublish: saving,
    handlePublish,
    handleUnpublish,
  };
}
