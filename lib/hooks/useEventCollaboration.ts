"use client";

import { useCallback, useEffect, useRef } from "react";
import type { EventFormData, CarouselImage, EventTheme } from "@/components/events/shared/types";
import type { SectionData } from "@/components/events/sections/types";
import type { FieldGroup } from "@/lib/api/patchEvent";
import { fetchEvent } from "@/lib/api/fetchEvent";
import { useEventRealtime } from "./useEventRealtime";

interface UseEventCollaborationOptions {
  eventId: string | undefined;
  userId: string | undefined;
  userName: string | undefined;
  enabled: boolean;
  /** Ref to latest broadcast callback (set by auto-save hook). */
  broadcastRef: React.MutableRefObject<(groups: FieldGroup[]) => void>;
  /** Setters for remote-change reconciliation. */
  setForm: React.Dispatch<React.SetStateAction<EventFormData>>;
  setCarouselImages: React.Dispatch<React.SetStateAction<CarouselImage[]>>;
  setHostsData: React.Dispatch<React.SetStateAction<import("@/components/events/shared/types").ClubProfile[]>>;
  setTheme: (t: EventTheme) => void;
  setSections: React.Dispatch<React.SetStateAction<SectionData[]>>;
}

/** Realtime collaboration: presence, field locks, remote change reconciliation. */
export function useEventCollaboration({
  eventId,
  userId,
  userName,
  enabled,
  broadcastRef,
  setForm,
  setCarouselImages,
  setHostsData,
  setTheme,
  setSections,
}: UseEventCollaborationOptions) {
  const focusedFieldRef = useRef<FieldGroup | null>(null);

  const handleRemoteChange = useCallback(
    async (groups: FieldGroup[]) => {
      if (!eventId || groups.length === 0) return;
      try {
        const result = await fetchEvent(eventId);
        const focused = focusedFieldRef.current;

        for (const g of groups) {
          if (g === focused) continue;

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
                isRecurring: result.formData.isRecurring ?? false,
                locationType: result.formData.locationType ?? "tba",
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
                locationType: result.formData.locationType ?? "tba",
                onlineLink: result.formData.onlineLink ?? "",
              }));
              break;
            case "occurrences":
              setForm((prev) => ({
                ...prev,
                occurrences: result.formData.occurrences ?? [],
                isRecurring: result.formData.isRecurring ?? false,
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
                eventCapacity: result.formData.eventCapacity ?? null,
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
      } catch (err) {
        console.error("Failed to sync remote changes:", err);
      }
    },
    [eventId, setForm, setCarouselImages, setHostsData, setTheme, setSections],
  );

  const { broadcast, broadcastFocus, collaborators } = useEventRealtime({
    eventId,
    userId,
    userName,
    enabled,
    onRemoteChange: handleRemoteChange,
  });

  /* Keep auto-save broadcastRef in sync */
  useEffect(() => {
    broadcastRef.current = broadcast;
  }, [broadcast, broadcastRef]);

  /* ── Field focus / blur for collaboration ── */
  const handleFieldFocus = useCallback(
    (field: FieldGroup) => {
      focusedFieldRef.current = field;
      broadcastFocus(field);
    },
    [broadcastFocus],
  );

  const handleFieldBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        focusedFieldRef.current = null;
        broadcastFocus(null);
      }
    },
    [broadcastFocus],
  );

  const getFieldLock = useCallback(
    (group: FieldGroup): { locked: boolean; lockedBy?: string } => {
      for (const [, collab] of collaborators) {
        if (collab.focusField === group) {
          return { locked: true, lockedBy: collab.name };
        }
      }
      return { locked: false };
    },
    [collaborators],
  );

  return {
    broadcast,
    broadcastFocus,
    collaborators,
    focusedFieldRef,
    handleFieldFocus,
    handleFieldBlur,
    getFieldLock,
  };
}
