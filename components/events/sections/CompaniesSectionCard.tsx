"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  ImagePlus,
  GripVertical,
  ChevronDown,
  PenLine,
  Library,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CompaniesSectionData, Company } from "./types";
import { useRef, useMemo, useState } from "react";
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
import { BrowseCompaniesDialog } from "./BrowseCompaniesDialog";

interface CompaniesSectionCardProps {
  data: CompaniesSectionData;
  onChange: (data: CompaniesSectionData) => void;
  isDark?: boolean;
}

/* ── Sortable Company row ── */
function SortableCompanyItem({
  id,
  item,
  index,
  canRemove,
  onUpdate,
  onRemove,
  onLogoUpload,
  isDark,
}: {
  id: string;
  item: Company;
  index: number;
  canRemove: boolean;
  onUpdate: (index: number, partial: Partial<Company>) => void;
  onRemove: (index: number) => void;
  onLogoUpload: (index: number, file: File) => void;
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
        "group relative flex items-center gap-3 rounded-lg border p-3",
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

      {/* Logo */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="shrink-0"
      >
        <Avatar className="h-12 w-12 cursor-pointer rounded-lg transition-opacity hover:opacity-80">
          {item.logoUrl ? (
            <AvatarImage
              src={item.logoUrl}
              alt={item.name}
              className="rounded-lg object-contain"
            />
          ) : null}
          <AvatarFallback
            className={cn("rounded-lg bg-muted", isDark && "bg-neutral-600")}
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
            if (f) onLogoUpload(index, f);
          }}
        />
      </button>

      <Input
        placeholder="Company name"
        value={item.name}
        onChange={(e) => onUpdate(index, { name: e.target.value })}
        className={cn(
          "h-8 flex-1 text-sm",
          isDark &&
            "border-neutral-600 bg-neutral-700 text-neutral-100 placeholder:text-neutral-400",
        )}
      />

      {/* "h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive" */}
      {canRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function CompaniesSectionCard({
  data,
  onChange,
  isDark,
}: CompaniesSectionCardProps) {
  const [browseOpen, setBrowseOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const itemIds = useMemo(
    () => data.items.map((_, i) => `company-${i}`),
    [data.items],
  );

  const updateItem = (index: number, partial: Partial<Company>) => {
    const items = [...data.items];
    items[index] = { ...items[index], ...partial };
    onChange({ ...data, items });
  };

  const addCustomItem = () => {
    onChange({
      ...data,
      items: [...data.items, { name: "", logoUrl: "" }],
    });
  };

  const addPresetCompanies = (companies: Company[]) => {
    // Filter out any that already exist (by name, case-insensitive)
    const existingNames = new Set(data.items.map((c) => c.name.toLowerCase()));
    const newCompanies = companies.filter(
      (c) => !existingNames.has(c.name.toLowerCase()),
    );
    if (newCompanies.length === 0) return;

    // If the only existing item is a blank placeholder, replace it
    const isSingleBlank =
      data.items.length === 1 && !data.items[0].name && !data.items[0].logoUrl;

    onChange({
      ...data,
      items: isSingleBlank ? newCompanies : [...data.items, ...newCompanies],
    });
  };

  const removeItem = (index: number) => {
    if (data.items.length <= 1) return;
    onChange({ ...data, items: data.items.filter((_, i) => i !== index) });
  };

  const handleLogoUpload = (index: number, file: File) => {
    const url = URL.createObjectURL(file);
    updateItem(index, { logoUrl: url });
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
            <SortableCompanyItem
              key={itemIds[i]}
              id={itemIds[i]}
              item={item}
              index={i}
              canRemove={data.items.length > 1}
              onUpdate={updateItem}
              onRemove={removeItem}
              onLogoUpload={handleLogoUpload}
              isDark={isDark}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add Company dropdown — Custom or Browse */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "mt-3 w-full gap-1",
              isDark &&
                "border-neutral-600 text-neutral-300 hover:bg-neutral-700 hover:text-white",
            )}
          >
            <Plus className="h-4 w-4" />
            Add Company
            <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48">
          <DropdownMenuItem onClick={addCustomItem}>
            <PenLine className="mr-2 h-4 w-4" />
            Custom
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setBrowseOpen(true)}>
            <Library className="mr-2 h-4 w-4" />
            Browse
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Browse preset companies dialog */}
      <BrowseCompaniesDialog
        open={browseOpen}
        onOpenChange={setBrowseOpen}
        existingCompanies={data.items}
        onAdd={addPresetCompanies}
        isDark={isDark}
      />
    </div>
  );
}
