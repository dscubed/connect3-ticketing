"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldGroup } from "@/lib/api/patchEvent";

interface UseFieldAutoSaveOptions {
  /** Whether auto-save is active */
  enabled: boolean;
  /**
   * Called when dirty field groups should be saved.
   * Receives the set of dirty groups so the caller can patch only those.
   */
  onSave: (dirtyGroups: FieldGroup[]) => Promise<void>;
  /** Debounce delay in ms (default: 1500) */
  delay?: number;
}

/**
 * Field-group-aware throttled auto-save.
 *
 * Call `markDirty("event")` etc. when a specific field group changes.
 * The first dirty mark starts a `delay` ms timer. Subsequent marks within
 * that window add to the dirty set but do NOT reset the timer, so saves
 * fire at a steady cadence even during continuous typing.
 */
export function useFieldAutoSave({
  enabled,
  onSave,
  delay = 1500,
}: UseFieldAutoSaveOptions) {
  const [isSaving, setIsSaving] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const dirtyGroupsRef = useRef<Set<FieldGroup>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savingRef = useRef(false);
  const saveRef = useRef(onSave);

  useEffect(() => {
    saveRef.current = onSave;
  }, [onSave]);

  const doSave = useCallback(async () => {
    if (savingRef.current || dirtyGroupsRef.current.size === 0) return;
    savingRef.current = true;
    setIsSaving(true);
    const groups = Array.from(dirtyGroupsRef.current);
    dirtyGroupsRef.current = new Set();
    try {
      await saveRef.current(groups);
    } catch (err) {
      // Re-add groups that failed so they retry next cycle
      for (const g of groups) dirtyGroupsRef.current.add(g);
      console.error("[field-auto-save] failed:", err);
    } finally {
      savingRef.current = false;
      setIsSaving(false);

      // If new groups were dirtied while we were saving, save again immediately
      if (dirtyGroupsRef.current.size > 0) {
        timerRef.current = setTimeout(doSave, 0);
      } else {
        timerRef.current = undefined;
        setHasPendingChanges(false);
      }
    }
  }, []);

  /** Mark specific field groups as dirty. Starts a throttle timer if one isn't already running. */
  const markDirty = useCallback(
    (...groups: FieldGroup[]) => {
      if (!enabled) return;
      for (const g of groups) dirtyGroupsRef.current.add(g);
      setHasPendingChanges(true);
      // Only start a timer if one isn't already ticking (throttle, not debounce)
      if (!timerRef.current) {
        timerRef.current = setTimeout(doSave, delay);
      }
    },
    [enabled, delay, doSave],
  );

  /** Immediately persist any pending changes (cancels timer). */
  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
    if (dirtyGroupsRef.current.size > 0) {
      await doSave();
    }
  }, [doSave]);

  /** Cancel all pending saves. */
  const cancel = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
    dirtyGroupsRef.current = new Set();
  }, []);

  /** Check if a specific group is currently dirty (pending save). */
  const isDirty = useCallback(
    (group: FieldGroup) => dirtyGroupsRef.current.has(group),
    [],
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { markDirty, flush, cancel, isDirty, isSaving, hasPendingChanges };
}
