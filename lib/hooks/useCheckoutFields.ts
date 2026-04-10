"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { FieldGroup } from "@/lib/api/patchEvent";
import type {
  TicketingFieldDraft,
  TicketingFieldType,
} from "@/lib/types/ticketing";
import { createBlankField } from "@/lib/types/ticketing";
import { toast } from "sonner";

interface UseCheckoutFieldsOptions {
  eventId: string;
  mode: "edit" | "preview";
  broadcast: (groups: FieldGroup[]) => void;
}

/** Custom ticket field CRUD, auto-save, and drag-and-drop. */
export function useCheckoutFields({
  eventId,
  mode,
  broadcast,
}: UseCheckoutFieldsOptions) {
  const [fields, setFields] = useState<TicketingFieldDraft[]>([]);
  const [fieldsDirty, setFieldsDirty] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Load ticketing fields ── */
  const [ticketingEnabled, setTicketingEnabled] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${eventId}/ticketing`)
      .then((res) => res.json())
      .then((json) => {
        setTicketingEnabled(!!json.data?.ticketing?.enabled);
        const dbFields = (json.data?.fields ?? []) as {
          id: string;
          label: string;
          input_type: TicketingFieldType;
          placeholder: string | null;
          required: boolean;
          options: string[] | null;
          sort_order: number;
        }[];
        setFields(
          dbFields.map((f) => ({
            id: f.id,
            label: f.label,
            input_type: f.input_type,
            placeholder: f.placeholder ?? "",
            required: f.required,
            options: f.options ?? [],
            sort_order: f.sort_order,
          })),
        );
      })
      .catch(() => {});
  }, [eventId]);

  /* ── Save fields to API ── */
  const saveFields = useCallback(
    async (fieldsToSave: TicketingFieldDraft[]) => {
      setSavingFields(true);
      console.log("SAVING");
      try {
        const res = await fetch(`/api/events/${eventId}/ticketing`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: fieldsToSave.map((f, i) => ({
              label: f.label,
              input_type: f.input_type,
              placeholder: f.placeholder || null,
              required: f.required,
              options:
                f.input_type === "select" || f.input_type === "multiselect"
                  ? f.options
                  : null,
              sort_order: i,
            })),
          }),
        });
        if (!res.ok) throw new Error("Failed");
        setFieldsDirty(false);
        setLastSavedAt(new Date());
        broadcast(["event"] as FieldGroup[]);
      } catch {
        toast.error("Failed to save fields");
      } finally {
        setSavingFields(false);
      }
    },
    [eventId, broadcast],
  );

  /* Admin only. immediately save pending changes */
  const flushFields = useCallback(async () => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    if (fieldsDirty) {
      await saveFields(fields);
    }
  }, [fieldsDirty, fields, saveFields]);

  /* 
  Clubs admin only. Attempt to autosave fields during operations like 
  */
  useEffect(() => {
    if (!fieldsDirty || mode !== "edit") return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveFields(fields);
    }, 2000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [fields, fieldsDirty, saveFields, mode]);

  /* ── Field CRUD ── */
  const addField = useCallback(
    (type: TicketingFieldType) => {
      const newField = createBlankField(type, fields.length);
      setFields((prev) => [...prev, newField]);
      setFieldsDirty(true);
    },
    [fields.length],
  );

  const updateField = useCallback(
    (id: string, updated: TicketingFieldDraft) => {
      setFields((prev) => prev.map((f) => (f.id === id ? updated : f)));
      setFieldsDirty(true);
    },
    [],
  );

  const removeField = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    setFieldsDirty(true);
  }, []);

  /* Admin only: Drag-n-Drop stuff */
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const fieldIds = useMemo(() => fields.map((f) => f.id), [fields]);

  const handleFieldDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = fieldIds.indexOf(active.id as string);
      const newIndex = fieldIds.indexOf(over.id as string);
      setFields((prev) => arrayMove(prev, oldIndex, newIndex));
      setFieldsDirty(true);
    },
    [fieldIds],
  );

  return {
    fields,
    ticketingEnabled,
    setTicketingEnabled,
    addField,
    updateField,
    removeField,
    fieldsDirty,
    savingFields,
    lastSavedAt,
    flushFields,
    dndSensors,
    fieldIds,
    handleFieldDragEnd,
  };
}
