"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { EventTheme, ThemeColors, EventFormData, CarouselImage, ClubProfile } from "./types";
import type { FieldGroup } from "@/lib/api/patchEvent";
import type { CollaboratorPresence } from "@/lib/hooks/useEventRealtime";

/* ── Context value ── */

export interface EventEditorContextValue {
  /* ── Identity ── */
  eventId: string | undefined;
  mode: "create" | "edit";
  initialUrlSlug: string | null;

  /* ── View ── */
  previewMode: boolean;
  setPreviewMode: React.Dispatch<React.SetStateAction<boolean>>;
  viewMode: "edit" | "preview";
  isEditing: boolean;
  toolbarCollapsed: boolean;
  setToolbarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;

  /* ── Auto-save ── */
  markDirty: (...groups: FieldGroup[]) => void;
  flush: () => Promise<void>;
  isAutoSaving: boolean;
  lastSavedAt: Date | null;

  /* ── Event status ── */
  eventStatus: "draft" | "published" | "archived";
  savingPublish: boolean;
  draftSaved: boolean;

  /* ── Ticketing ── */
  ticketingEnabled: boolean;
  ticketingChanging: boolean;

  /* ── Actions ── */
  handleBack: () => void;
  handlePublish: () => void;
  handleUnpublish: () => void;
  enableTicketing: () => void;
  disableTicketing: () => void;

  /* ── Theme ── */
  theme: EventTheme;
  setTheme: (t: EventTheme) => void;
  setThemeOpen: (open: boolean) => void;
  colors: ThemeColors;
  isDark: boolean;

  /* ── Derived form flags ── */
  hasName: boolean;

  /* ── Form state (accessible by field components) ── */
  form: EventFormData;
  setForm: React.Dispatch<React.SetStateAction<EventFormData>>;
  updateField: <K extends keyof EventFormData>(key: K, value: EventFormData[K]) => void;
  carouselImages: CarouselImage[];
  hostsData: ClubProfile[];
  setHostsData: React.Dispatch<React.SetStateAction<ClubProfile[]>>;
  creatorProfile: ClubProfile;

  /* ── Collaboration ── */
  collaborators: Map<string, CollaboratorPresence>;
  getFieldLock: (group: FieldGroup) => { locked: boolean; lockedBy?: string };
  handleFieldFocus: (field: FieldGroup) => void;
  handleFieldBlur: (e: React.FocusEvent<HTMLDivElement>) => void;
}

const EventEditorContext = createContext<EventEditorContextValue | null>(null);

/** Read the event editor context. Throws if used outside a provider. */
export function useEventEditor(): EventEditorContextValue {
  const ctx = useContext(EventEditorContext);
  if (!ctx) {
    throw new Error(
      "useEventEditor must be used within an <EventEditorContext.Provider>",
    );
  }
  return ctx;
}

/**
 * Safe theme accessor — returns `null` when outside a provider (e.g. visitor pages).
 * Components use this to read ambient theme props with a prop fallback.
 */
export function useEditorTheme() {
  return useContext(EventEditorContext);
}

export { EventEditorContext };

/* ── Shared helper: relative "last saved" label ── */

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

/** Ticking "Saved X ago" label — re-renders every 30 s. */
export function LastSavedLabel({ date }: { date: Date }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [date]);

  void tick;
  return <>{formatRelativeTime(date)}</>;
}
