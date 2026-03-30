"use client";

import { useCallback, useMemo } from "react";
import {
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import type { SectionData, SectionType } from "@/components/events/sections/types";
import { createBlankSection } from "@/components/events/sections";
import type { FieldGroup } from "@/lib/api/patchEvent";

interface UseEventSectionsOptions {
  sections: SectionData[];
  setSections: React.Dispatch<React.SetStateAction<SectionData[]>>;
  markDirty: (...groups: FieldGroup[]) => void;
}

/** Section CRUD + drag-and-drop reordering. */
export function useEventSections({
  sections,
  setSections,
  markDirty,
}: UseEventSectionsOptions) {
  const addSection = useCallback(
    (type: SectionType) => {
      setSections((prev) => [...prev, createBlankSection(type)]);
      markDirty(`section:${type}`);
    },
    [setSections, markDirty],
  );

  const updateSection = useCallback(
    (index: number, data: SectionData) => {
      setSections((prev) => prev.map((s, i) => (i === index ? data : s)));
      markDirty(`section:${data.type}`);
    },
    [setSections, markDirty],
  );

  const removeSection = useCallback(
    (index: number) => {
      setSections((prev) => {
        const removedType = prev[index].type;
        markDirty(`section:${removedType}`);
        return prev.filter((_, i) => i !== index);
      });
    },
    [setSections, markDirty],
  );

  /* ── DnD ── */
  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const sectionIds = useMemo(() => sections.map((s) => s.type), [sections]);

  const handleSectionDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = sectionIds.indexOf(active.id as SectionType);
      const newIndex = sectionIds.indexOf(over.id as SectionType);
      setSections((prev) => arrayMove(prev, oldIndex, newIndex));
      markDirty(...sections.map((s) => `section:${s.type}` as FieldGroup));
    },
    [sectionIds, sections, setSections, markDirty],
  );

  return {
    addSection,
    updateSection,
    removeSection,
    sectionSensors,
    sectionIds,
    handleSectionDragEnd,
  };
}
