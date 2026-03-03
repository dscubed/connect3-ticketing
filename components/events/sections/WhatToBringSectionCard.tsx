"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WhatToBringSectionData } from "./types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo } from "react";

interface WhatToBringSectionCardProps {
  data: WhatToBringSectionData;
  onChange: (data: WhatToBringSectionData) => void;
  isDark?: boolean;
}

/* ── Sortable item row ── */
function SortableBringItem({
  id,
  value,
  index,
  canRemove,
  onUpdate,
  onRemove,
  isDark,
}: {
  id: string;
  value: string;
  index: number;
  canRemove: boolean;
  onUpdate: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  isDark?: boolean;
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
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2"
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        className="cursor-grab touch-none active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
      </button>
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 text-[10px] font-bold text-muted-foreground">
        {index + 1}
      </div>
      <Input
        placeholder="Item to bring..."
        value={value}
        onChange={(e) => onUpdate(index, e.target.value)}
        className={cn(
          "flex-1",
          isDark &&
            "border-neutral-600 bg-neutral-700 text-neutral-100 placeholder:text-neutral-400",
        )}
      />
      {canRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="h-8 w-8 shrink-0 p-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function WhatToBringSectionCard({
  data,
  onChange,
  isDark,
}: WhatToBringSectionCardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const itemIds = useMemo(
    () => data.items.map((_, i) => `bring-${i}`),
    [data.items],
  );

  const updateItem = (index: number, value: string) => {
    const items = [...data.items];
    items[index] = { item: value };
    onChange({ ...data, items });
  };

  const addItem = () => {
    onChange({ ...data, items: [...data.items, { item: "" }] });
  };

  const removeItem = (index: number) => {
    if (data.items.length <= 1) return;
    onChange({ ...data, items: data.items.filter((_, i) => i !== index) });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = itemIds.indexOf(active.id as string);
    const newIndex = itemIds.indexOf(over.id as string);
    onChange({ ...data, items: arrayMove(data.items, oldIndex, newIndex) });
  };

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {data.items.map((item, i) => (
            <SortableBringItem
              key={itemIds[i]}
              id={itemIds[i]}
              value={item.item}
              index={i}
              canRemove={data.items.length > 1}
              onUpdate={updateItem}
              onRemove={removeItem}
              isDark={isDark}
            />
          ))}
        </SortableContext>
      </DndContext>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
        className={cn(
          "w-full gap-1",
          isDark &&
            "border-neutral-600 text-neutral-300 hover:bg-neutral-700 hover:text-white",
        )}
      >
        <Plus className="h-4 w-4" />
        Add Item
      </Button>
    </div>
  );
}
