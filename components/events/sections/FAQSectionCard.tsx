"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, GripVertical, X, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FAQSectionData, FAQItem } from "./types";
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
import { useMemo, useState } from "react";

const SUGGESTED_QUESTIONS = [
  "Dress Code",
  "Experience Level",
  "Venue Address",
  "Contact Information",
  "Parking & Transportation",
  "Dietary Restrictions",
  "Accessibility",
];

interface FAQSectionCardProps {
  data: FAQSectionData;
  onChange: (data: FAQSectionData) => void;
  /** Show a pinging blue dot on the Add Question button */
  showAttentionBadge?: boolean;
  /** Apply dark-mode surface colours */
  isDark?: boolean;
}

/* ── Sortable FAQ row ── */
function SortableFAQItem({
  id,
  item,
  index,
  canRemove,
  onUpdate,
  onRemove,
  isDark,
}: {
  id: string;
  item: FAQItem;
  index: number;
  canRemove: boolean;
  onUpdate: (index: number, partial: Partial<FAQItem>) => void;
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
      className="group relative flex items-start gap-2 py-2"
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        className="mt-2.5 cursor-grab touch-none active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
      </button>
      <div className="flex-1 space-y-1.5">
        <Input
          placeholder="Question"
          value={item.question}
          onChange={(e) => onUpdate(index, { question: e.target.value })}
          className={cn(
            "h-9 font-medium",
            isDark &&
              "border-neutral-600 bg-neutral-700 text-neutral-100 placeholder:text-neutral-400",
          )}
        />
        <Textarea
          placeholder="Answer"
          value={item.answer}
          onChange={(e) => onUpdate(index, { answer: e.target.value })}
          rows={2}
          className={cn(
            "resize-none text-sm",
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
          className="mt-1.5 h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function FAQSectionCard({
  data,
  onChange,
  showAttentionBadge,
  isDark,
}: FAQSectionCardProps) {
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const itemIds = useMemo(
    () => data.items.map((_, i) => `faq-${i}`),
    [data.items],
  );

  const updateItem = (index: number, partial: Partial<FAQItem>) => {
    const items = [...data.items];
    items[index] = { ...items[index], ...partial };
    onChange({ ...data, items });
  };

  const addItem = () => {
    onChange({ ...data, items: [...data.items, { question: "", answer: "" }] });
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
    <div className="space-y-4">
      {/* Suggested Questions Banner */}
      {!bannerDismissed && (
        <div
          className={cn(
            "relative flex items-start gap-3 rounded-md border p-3",
            isDark
              ? "border-neutral-600 bg-neutral-700/50"
              : "border-blue-200 bg-blue-50",
          )}
        >
          <Lightbulb
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              isDark ? "text-neutral-400" : "text-blue-600",
            )}
          />
          <div className="flex-1 text-sm">
            <p
              className={cn(
                "font-medium mb-2",
                isDark ? "text-neutral-100" : "text-blue-900",
              )}
            >
              Recommended questions to add:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    // Check if question already exists
                    if (!data.items.some((faq) => faq.question === q)) {
                      onChange({
                        ...data,
                        items: [...data.items, { question: q, answer: "" }],
                      });
                    }
                  }}
                  className={cn(
                    "text-xs font-medium px-2 py-1 rounded transition-colors",
                    isDark
                      ? "bg-neutral-600 text-neutral-100 hover:bg-neutral-500"
                      : "bg-blue-100 text-blue-700 hover:bg-blue-200",
                  )}
                >
                  + {q}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-opacity hover:opacity-75",
              isDark && "text-neutral-400",
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* FAQ Items */}
      <div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={itemIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="divide-y">
              {data.items.map((item, i) => (
                <SortableFAQItem
                  key={itemIds[i]}
                  id={itemIds[i]}
                  item={item}
                  index={i}
                  canRemove={data.items.length > 1}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                  isDark={isDark}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div className="relative">
          {showAttentionBadge && (
            <span className="absolute -right-1 -top-1 z-10 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
            </span>
          )}
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
            Add Question
          </Button>
        </div>
      </div>
    </div>
  );
}
