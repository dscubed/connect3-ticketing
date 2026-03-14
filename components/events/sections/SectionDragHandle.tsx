"use client";

import { GripVertical } from "lucide-react";
import type { DragHandleProps } from "./types";

/**
 * Isolated drag-handle button.
 * Extracting this into its own component prevents
 * React-compiler "Cannot access refs during render" warnings
 * in the parent section card.
 */
export function SectionDragHandle({
  dragHandleProps,
}: {
  dragHandleProps: DragHandleProps;
}) {
  const { ref, listeners, attributes } = dragHandleProps;

  return (
    <button
      type="button"
      ref={ref}
      {...listeners}
      {...attributes}
      className="cursor-grab touch-none active:cursor-grabbing"
    >
      <GripVertical className="h-5 w-5 text-muted-foreground/40" />
    </button>
  );
}
