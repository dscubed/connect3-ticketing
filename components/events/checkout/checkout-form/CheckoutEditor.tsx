"use client";

import { Loader2 } from "lucide-react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SectionWrapper } from "@/components/events/preview/SectionWrapper";
import { TicketFieldCard } from "@/components/events/checkout/TicketFieldCard";
import { AddFieldButton } from "@/components/events/checkout/AddFieldButton";
import { CHECKOUT_PRESET_FIELDS } from "@/lib/types/ticketing";
import type { TicketingFieldDraft, TicketingFieldType } from "@/lib/types/ticketing";
import type { ThemeColors, ThemeLayout } from "@/components/events/shared/types";
import type { DragEndEvent } from "@dnd-kit/core";

/* ── Sortable wrapper for DnD ── */
function SortableFieldWrapper({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: Record<string, unknown>) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

interface CheckoutEditorProps {
  // Theme information
  layout: ThemeLayout;
  isDark: boolean;
  colors: ThemeColors;
  accentColor: string | undefined;
  /* ticketing state */
  ticketingEnabled: boolean;
  ticketingChanging: boolean;
  handleEnableTicketing: () => void;
  pricingCount: number;
  /* field CRUD */
  fields: TicketingFieldDraft[];
  addField: (type: TicketingFieldType) => void;
  updateField: (id: string, updated: TicketingFieldDraft) => void;
  removeField: (id: string) => void;
  /* DnD */
  dndSensors: ReturnType<typeof import("@dnd-kit/core").useSensors>;
  fieldIds: string[];
  handleFieldDragEnd: (event: DragEndEvent) => void;
}

/**
 * Admin view for editing checkout fields. 
 */
export function CheckoutEditor({
  layout,
  isDark,
  colors,
  accentColor,
  ticketingEnabled,
  ticketingChanging,
  handleEnableTicketing,
  pricingCount,
  fields,
  addField,
  updateField,
  removeField,
  dndSensors,
  fieldIds,
  handleFieldDragEnd,
}: CheckoutEditorProps) {
  /* If ticketing is not enabled on the event */
  if (!ticketingEnabled) {
    return (
      <Card className="mt-6 flex flex-col items-center gap-4 p-8 text-center">
        <div>
          <h2 className="text-lg font-semibold">Enable Ticketing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up ticketing for this event to start collecting attendee
            information at checkout.
          </p>
          {pricingCount === 0 && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              You need to add at least one ticket tier to your event before
              enabling ticketing.
            </p>
          )}
        </div>
        <Button
          size="lg"
          className="gap-2"
          style={
            accentColor
              ? { backgroundColor: accentColor, color: "#fff" }
              : undefined
          }
          onClick={handleEnableTicketing}
          disabled={ticketingChanging || pricingCount === 0}
        >
          {ticketingChanging && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          Enable Ticketing
        </Button>
      </Card>
    );
  }

  /* Edit mode: flat layout with preset fields + DnD custom fields */
  return (
    <div className="mt-8 space-y-8">
      <SectionWrapper title="Checkout Info" layout={layout} isDark={isDark}>
        <div className="grid gap-4 sm:grid-cols-2">
          {CHECKOUT_PRESET_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label className={cn("text-sm font-medium", colors.text)}>
                {field.label}
                <span className="ml-0.5 text-red-500">*</span>
              </Label>
              <Input
                type={field.type}
                placeholder={field.label}
                disabled
                className={cn(
                  colors.inputBg,
                  colors.inputBorder,
                  colors.placeholder,
                )}
              />
            </div>
          ))}
        </div>
        <p className={cn("mt-3 text-xs", colors.textMuted)}>
          These fields are preset and cannot be modified. They will always
          appear on the checkout form.
        </p>
      </SectionWrapper>

      <SectionWrapper title="Ticket Info" layout={layout} isDark={isDark}>
        <p className={cn("mb-3 text-xs", colors.textMuted)}>
          Add custom questions for attendees. Drag to reorder.
        </p>

        <div className="space-y-2">
          {fields.length > 0 ? (
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleFieldDragEnd}
            >
              <SortableContext
                items={fieldIds}
                strategy={verticalListSortingStrategy}
              >
                {fields.map((field, i) => (
                  <SortableFieldWrapper key={field.id} id={field.id}>
                    {(dragHandleProps) => (
                      <TicketFieldCard
                        field={field}
                        index={i}
                        colors={colors}
                        onChange={(updated) => updateField(field.id, updated)}
                        onRemove={() => removeField(field.id)}
                        dragHandleProps={dragHandleProps}
                      />
                    )}
                  </SortableFieldWrapper>
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className={cn("text-sm", colors.textMuted)}>
                No custom fields yet. Add one below.
              </p>
            </div>
          )}

          <AddFieldButton onAdd={addField} colors={colors} />
        </div>
      </SectionWrapper>
    </div>
  );
}
