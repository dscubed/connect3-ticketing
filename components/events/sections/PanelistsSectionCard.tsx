"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ImagePlus, GripVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { PanelistsSectionData, Panelist } from "./types";
import { useRef, useMemo } from "react";
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

interface PanelistsSectionCardProps {
  data: PanelistsSectionData;
  onChange: (data: PanelistsSectionData) => void;
  isDark?: boolean;
}

/* ── Sortable Panelist row ── */
function SortablePanelistItem({
  id,
  item,
  index,
  canRemove,
  onUpdate,
  onRemove,
  onImageUpload,
  isDark,
}: {
  id: string;
  item: Panelist;
  index: number;
  canRemove: boolean;
  onUpdate: (index: number, partial: Partial<Panelist>) => void;
  onRemove: (index: number) => void;
  onImageUpload: (index: number, file: File) => void;
  isDark?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
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
      className={cn(
        "group flex items-center gap-3 rounded-lg border p-3",
        isDark && "border-neutral-600 bg-neutral-700",
      )}
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

      {/* Avatar / image upload */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="shrink-0"
      >
        <Avatar className="h-12 w-12 cursor-pointer transition-opacity hover:opacity-80">
          {item.imageUrl ? (
            <AvatarImage src={item.imageUrl} alt={item.name} />
          ) : null}
          <AvatarFallback
            className={cn("bg-muted", isDark && "bg-neutral-600")}
          >
            <ImagePlus
              className={cn(
                "h-5 w-5 text-muted-foreground",
                isDark && "text-neutral-400",
              )}
            />
          </AvatarFallback>
        </Avatar>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImageUpload(index, f);
          }}
        />
      </button>

      {/* Name + Title */}
      <div className="flex flex-1 flex-col gap-1.5">
        <Input
          placeholder="Name"
          value={item.name}
          onChange={(e) => onUpdate(index, { name: e.target.value })}
          className={cn(
            "h-8 text-sm font-medium",
            isDark &&
              "border-neutral-600 bg-neutral-700 text-neutral-100 placeholder:text-neutral-400",
          )}
        />
        <Input
          placeholder="Title / Role"
          value={item.title}
          onChange={(e) => onUpdate(index, { title: e.target.value })}
          className={cn(
            "h-8 text-sm",
            isDark &&
              "border-neutral-600 bg-neutral-700 text-neutral-100 placeholder:text-neutral-400",
          )}
        />
      </div>

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

export function PanelistsSectionCard({
  data,
  onChange,
  isDark,
}: PanelistsSectionCardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const itemIds = useMemo(
    () => data.items.map((_, i) => `panelist-${i}`),
    [data.items],
  );

  const updateItem = (index: number, partial: Partial<Panelist>) => {
    const items = [...data.items];
    items[index] = { ...items[index], ...partial };
    onChange({ ...data, items });
  };

  const addItem = () => {
    onChange({
      ...data,
      items: [...data.items, { name: "", title: "", imageUrl: "" }],
    });
  };

  const removeItem = (index: number) => {
    if (data.items.length <= 1) return;
    onChange({ ...data, items: data.items.filter((_, i) => i !== index) });
  };

  const handleImageUpload = (index: number, file: File) => {
    const url = URL.createObjectURL(file);
    updateItem(index, { imageUrl: url });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = itemIds.indexOf(active.id as string);
    const newIndex = itemIds.indexOf(over.id as string);
    onChange({ ...data, items: arrayMove(data.items, oldIndex, newIndex) });
  };

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {data.items.map((item, i) => (
            <SortablePanelistItem
              key={itemIds[i]}
              id={itemIds[i]}
              item={item}
              index={i}
              canRemove={data.items.length > 1}
              onUpdate={updateItem}
              onRemove={removeItem}
              onImageUpload={handleImageUpload}
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
        Add Panelist
      </Button>
    </div>
  );
}
