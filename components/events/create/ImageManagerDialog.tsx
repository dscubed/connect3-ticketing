"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { GripVertical, ImagePlus, Plus, Star, Trash2 } from "lucide-react";
import ImageCropper from "@/components/ui/ImageCropper";
import Image from "next/image";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CarouselImage } from "../shared/types";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

/*  Helpers  */
let _idSeq = 0;
const genId = () => `cimg-${Date.now()}-${_idSeq++}`;

/*  Sortable grid item  */
function SortableGridItem({
  image,
  index,
  onRemove,
  onCropClick,
}: {
  image: CarouselImage;
  index: number;
  onRemove: () => void;
  onCropClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const isMobile = useIsMobile();

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
      className="group/item relative aspect-square overflow-hidden rounded-lg border bg-muted cursor-pointer"
      onClick={onCropClick}
    >
      <Image
        src={image.preview}
        alt={index === 0 ? "Thumbnail" : `Photo ${index + 1}`}
        fill
        className="object-cover"
        draggable={false}
      />

      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      />

      {/* Thumbnail badge */}
      {index === 0 && (
        <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
          <Star className="h-2.5 w-2.5" />
          {!isMobile && "Thumbnail"}
        </span>
      )}
      {index > 0 && (
        <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] font-medium text-white">
          {index + 1}
        </span>
      )}

      {/* Delete button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-destructive"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

/*  Sortable list item (mobile)  */
function SortableListItem({
  image,
  index,
  onRemove,
  onCropClick,
}: {
  image: CarouselImage;
  index: number;
  onRemove: () => void;
  onCropClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

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
      className="flex items-center gap-3 rounded-lg border bg-muted/40 p-2"
    >
      {/* Drag grip */}
      <div
        {...attributes}
        {...listeners}
        className="flex shrink-0 cursor-grab touch-none items-center text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5" />
      </div>

      {/* Image preview */}
      <div
        className="relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-md"
        onClick={onCropClick}
      >
        <Image
          src={image.preview}
          alt={index === 0 ? "Thumbnail" : `Photo ${index + 1}`}
          fill
          className="object-cover"
          draggable={false}
        />
      </div>

      {/* Label */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {index === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm">
            <Star className="h-3 w-3" />
            Thumbnail
          </span>
        ) : (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground/10 text-xs font-medium">
            {index + 1}
          </span>
        )}
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/*  Main dialog shell  */
interface ImageManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: CarouselImage[];
  onConfirm: (images: CarouselImage[]) => void;
  maxImages?: number;
}

export function ImageManagerDialog({
  open,
  onOpenChange,
  images,
  onConfirm,
  maxImages = 10,
}: ImageManagerDialogProps) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-4xl"
    >
      {open && (
        <ImageManagerContent
          images={images}
          onConfirm={onConfirm}
          onOpenChange={onOpenChange}
          maxImages={maxImages}
        />
      )}
    </ResponsiveModal>
  );
}

/*  Inner content (remounts each open)  */
function ImageManagerContent({
  images,
  onConfirm,
  onOpenChange,
  maxImages = 10,
}: {
  images: CarouselImage[];
  onConfirm: (images: CarouselImage[]) => void;
  onOpenChange: (open: boolean) => void;
  maxImages?: number;
}) {
  const [localImages, setLocalImages] = useState<CarouselImage[]>(() =>
    images.map((img) => ({ ...img })),
  );

  // Track blob URLs created in this session (newly uploaded) so we can revoke on cancel
  const addedBlobUrls = useRef<Set<string>>(new Set());
  // Track blob URLs of removed images so we can revoke on confirm
  const removedBlobUrls = useRef<Set<string>>(new Set());

  /* Which image index is being cropped (null = grid view) */
  const [cropTargetIndex, setCropTargetIndex] = useState<number | null>(null);
  const [pendingCropSrc, setPendingCropSrc] = useState<string | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCropping = cropTargetIndex !== null && pendingCropSrc !== null;

  const isMobile = useIsMobile();

  /*  DnD  */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalImages((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  /*  Upload (no crop queue  just add immediately)  */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;
      const remaining = maxImages - localImages.length;
      const toAdd = files.slice(0, remaining).map((f) => {
        const preview = URL.createObjectURL(f);
        addedBlobUrls.current.add(preview);
        return { id: genId(), file: f, preview };
      });
      setLocalImages((prev) => [...prev, ...toAdd]);
      e.target.value = "";
    },
    [localImages.length, maxImages],
  );

  /*  Click to crop / re-crop an existing image  */
  const openCropFor = useCallback((index: number) => {
    setLocalImages((prev) => {
      const img = prev[index];
      setPendingCropSrc(img.preview);
      setCropTargetIndex(index);
      setCroppedFile(null);
      return prev;
    });
  }, []);

  const handleCropComplete = useCallback((file: File) => {
    setCroppedFile(file);
  }, []);

  const handleCropConfirm = useCallback(() => {
    if (!croppedFile || cropTargetIndex === null) return;
    const newPreview = URL.createObjectURL(croppedFile);
    addedBlobUrls.current.add(newPreview);
    setLocalImages((prev) => {
      const next = [...prev];
      const old = next[cropTargetIndex];
      /* Revoke old blob only if it was newly added in this session */
      if (
        old.preview.startsWith("blob:") &&
        addedBlobUrls.current.has(old.preview)
      ) {
        URL.revokeObjectURL(old.preview);
        addedBlobUrls.current.delete(old.preview);
      }
      next[cropTargetIndex] = {
        ...old,
        file: croppedFile,
        preview: newPreview,
      };
      return next;
    });
    setCropTargetIndex(null);
    setPendingCropSrc(null);
    setCroppedFile(null);
  }, [croppedFile, cropTargetIndex]);

  const handleCropCancel = useCallback(() => {
    setCropTargetIndex(null);
    setPendingCropSrc(null);
    setCroppedFile(null);
  }, []);

  /*  Remove — don't revoke URLs yet, just track them  */
  const handleRemove = useCallback((index: number) => {
    setLocalImages((prev) => {
      const removed = prev[index];
      if (removed.preview.startsWith("blob:")) {
        removedBlobUrls.current.add(removed.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  /*  Confirm / Cancel  */
  const handleConfirm = useCallback(() => {
    // Revoke blob URLs of removed images (no longer needed)
    removedBlobUrls.current.forEach((url) => URL.revokeObjectURL(url));
    onConfirm(localImages);
    onOpenChange(false);
  }, [localImages, onConfirm, onOpenChange]);

  // On cancel (dialog close without confirm), revoke only newly-added blobs
  // so parent's original images stay intact
  const handleCancel = useCallback(() => {
    // Revoke blobs that were added in this session but not confirmed
    addedBlobUrls.current.forEach((url) => {
      // Don't revoke if the URL was for an image that got removed (already tracked)
      if (!removedBlobUrls.current.has(url)) {
        URL.revokeObjectURL(url);
      }
    });
    // Revoke removed blobs that were newly added (double cleanup)
    removedBlobUrls.current.forEach((url) => {
      if (addedBlobUrls.current.has(url)) {
        URL.revokeObjectURL(url);
      }
    });
    onOpenChange(false);
  }, [onOpenChange]);

  /*  Crop view  */
  if (isCropping) {
    return (
      <>
        <div className="flex flex-col space-y-1.5 sm:text-left">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            Edit Photo
          </h2>
          <p className="text-sm text-muted-foreground">
            Adjust crop, then click Apply
          </p>
        </div>
        <div className="mx-auto w-full max-w-sm">
          <ImageCropper
            imageSrc={pendingCropSrc!}
            onCropComplete={handleCropComplete}
            aspectRatio={1}
            shape="rect"
            fileName={`event-photo-${cropTargetIndex! + 1}.png`}
          />
        </div>
        <div className="mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={handleCropCancel}>
            Cancel
          </Button>
          <Button onClick={handleCropConfirm} disabled={!croppedFile}>
            Apply
          </Button>
        </div>
      </>
    );
  }

  /*  Grid view  */
  return (
    <>
      <div className="flex flex-col space-y-1.5 sm:text-left">
        <h2 className="text-lg font-semibold leading-none tracking-tight">
          Manage Photos
        </h2>
      </div>

      <div className="max-h-[60vh] overflow-y-auto py-2">
        {localImages.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localImages.map((i) => i.id)}
              strategy={
                isMobile ? verticalListSortingStrategy : rectSortingStrategy
              }
            >
              {isMobile ? (
                /* ── Mobile: vertical list ── */
                <div className="flex flex-col gap-2">
                  {localImages.map((img, i) => (
                    <SortableListItem
                      key={img.id}
                      image={img}
                      index={i}
                      onRemove={() => handleRemove(i)}
                      onCropClick={() => openCropFor(i)}
                    />
                  ))}
                  {localImages.length < maxImages && (
                    <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border py-4 text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Plus className="mr-2 h-5 w-5" />
                      <span className="text-sm font-medium">Add photo</span>
                    </label>
                  )}
                </div>
              ) : (
                /* ── Desktop: grid ── */
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {localImages.map((img, i) => (
                    <SortableGridItem
                      key={img.id}
                      image={img}
                      index={i}
                      onRemove={() => handleRemove(i)}
                      onCropClick={() => openCropFor(i)}
                    />
                  ))}
                  {localImages.length < maxImages && (
                    <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Plus className="h-6 w-6" />
                    </label>
                  )}
                </div>
              )}
            </SortableContext>
          </DndContext>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center py-12 text-muted-foreground transition-colors hover:text-foreground">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <ImagePlus className="mb-3 h-12 w-12" />
            <p className="text-sm font-medium">No photos yet</p>
            <p className="text-xs">Click to upload up to {maxImages} photos</p>
          </label>
        )}
      </div>
      <p className="flex justify-center text-sm text-muted-foreground">
        {localImages.length}/{maxImages} photos &middot; Drag to reorder
        &middot; Click a photo to crop
      </p>

      <div className="mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button onClick={handleConfirm}>Done</Button>
      </div>
    </>
  );
}
