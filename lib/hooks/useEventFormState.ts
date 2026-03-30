"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { nanoid } from "nanoid";
import type {
  EventFormData,
  CarouselImage,
  ClubProfile,
  EventTheme,
} from "@/components/events/shared/types";
import {
  DEFAULT_THEME,
  getThemeColors,
  getAccentGradient,
} from "@/components/events/shared/types";
import type { SectionData } from "@/components/events/sections/types";
import type { FieldGroup } from "@/lib/api/patchEvent";
import type { FetchedEventData } from "@/lib/api/fetchEvent";
import { useDocumentDark } from "./useDocumentDark";

interface UseEventFormStateOptions {
  /** Fetched event data (edit mode). Individual fields are derived from this. */
  data?: FetchedEventData;
}

/** Core form-data state: form fields, images, sections, hosts, theme. */
export function useEventFormState({ data }: UseEventFormStateOptions) {
  const initialData = data?.formData;
  const existingImages = data?.existingImages;
  const initialCarouselImages = data?.carouselImages;
  const initialHostsData = data?.hostsData;
  const initialSections = data?.sections;
  /* ── Form data ── */
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
    locationType: initialData?.locationType ?? "tba",
    onlineLink: initialData?.onlineLink ?? "",
    venues:
      initialData?.venues && initialData.venues.length > 0
        ? initialData.venues
        : [
            {
              id: nanoid(),
              type: "tba" as const,
              location: { displayName: "", address: "" },
            },
          ],
    isRecurring: initialData?.isRecurring ?? false,
    occurrences: initialData?.occurrences ?? [],
    category: initialData?.category ?? "",
    tags: initialData?.tags ?? [],
    hostIds: initialData?.hostIds ?? [],
    imageUrls: initialData?.imageUrls ?? [],
    pricing: initialData?.pricing ?? [],
    eventCapacity: initialData?.eventCapacity ?? null,
    links: initialData?.links ?? [],
    theme: initialData?.theme ?? { ...DEFAULT_THEME },
  } as EventFormData);

  const [hostsData, setHostsData] = useState<ClubProfile[]>(
    initialHostsData ?? [],
  );
  const [sections, setSections] = useState<SectionData[]>(
    initialSections ?? [],
  );

  /* ── Images ── */
  const [carouselImages, setCarouselImages] = useState<CarouselImage[]>(
    () =>
      initialCarouselImages ??
      (existingImages ?? []).map((url, i) => ({
        id: `existing-${i}`,
        url,
      })),
  );

  /* ── Theme ── */
  const [theme, setTheme] = useState<EventTheme>(
    initialData?.theme ?? { ...DEFAULT_THEME },
  );

  /* Sync image URLs into form */
  useEffect(() => {
    const urls = carouselImages
      .filter((i) => i.url && !i.uploading)
      .map((i) => i.url);
    setForm((prev) => ({ ...prev, imageUrls: urls }));
  }, [carouselImages]);

  /* Sync theme into form */
  useEffect(() => {
    setForm((prev) => ({ ...prev, theme }));
  }, [theme]);

  /* ── Derived theme values ── */
  const colors = useMemo(() => getThemeColors(theme.mode), [theme.mode]);
  const isDark = colors.isDark;
  useDocumentDark(isDark);

  const accentGradient = useMemo(
    () => getAccentGradient(theme.accent, isDark, theme.accentCustom),
    [theme.accent, theme.accentCustom, isDark],
  );

  /* ── Field → FieldGroup map ── */
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
      isRecurring: "event",
      locationType: "location",
      onlineLink: "location",
      venues: "location",
      category: "event",
      tags: "event",
      location: "location",
      occurrences: "occurrences",
      imageUrls: "images",
      hostIds: "hosts",
      pricing: "pricing",
      eventCapacity: "pricing",
      links: "links",
      theme: "theme",
    }),
    [],
  );

  /* ── Refs for auto-save to read latest state ── */
  const formRef = useRef<EventFormData>(form);
  const carouselImagesRef = useRef<CarouselImage[]>(carouselImages);
  const sectionsRef = useRef<SectionData[]>(sections);

  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    carouselImagesRef.current = carouselImages;
  }, [carouselImages]);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  return {
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
  };
}
