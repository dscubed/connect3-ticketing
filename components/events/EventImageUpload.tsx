"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ImagePlus, X } from "lucide-react";
import ImageCropper from "@/components/ui/ImageCropper";
import Image from "next/image";

interface EventImageUploadProps {
  /** Current thumbnail URL (for edit mode) */
  currentImage?: string | null;
  /** Called with the cropped File when user confirms */
  onImageChange: (file: File | null) => void;
}

/**
 * Event thumbnail upload with 16:9 aspect crop.
 * Shows a drop zone / preview and opens a crop dialog on file select.
 */
export function EventImageUpload({
  currentImage,
  onImageChange,
}: EventImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImage ?? null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setRawImage(url);
      setCropDialogOpen(true);
      // Reset file input so same file can be re-selected
      e.target.value = "";
    },
    [],
  );

  const handleCropComplete = useCallback((file: File) => {
    setCroppedFile(file);
  }, []);

  const handleCropConfirm = useCallback(() => {
    if (!croppedFile) return;
    const url = URL.createObjectURL(croppedFile);
    setPreview(url);
    onImageChange(croppedFile);
    setCropDialogOpen(false);
    if (rawImage) URL.revokeObjectURL(rawImage);
    setRawImage(null);
  }, [croppedFile, rawImage, onImageChange]);

  const handleCropCancel = useCallback(() => {
    setCropDialogOpen(false);
    if (rawImage) URL.revokeObjectURL(rawImage);
    setRawImage(null);
    setCroppedFile(null);
  }, [rawImage]);

  const handleRemove = useCallback(() => {
    if (preview && !currentImage) URL.revokeObjectURL(preview);
    setPreview(null);
    onImageChange(null);
  }, [preview, currentImage, onImageChange]);

  return (
    <>
      <div className="relative mx-auto w-1/2 overflow-hidden rounded-xl border border-dashed border-border bg-muted/30">
        {preview ? (
          <div className="group relative aspect-square w-full">
            <Image
              src={preview}
              alt="Event thumbnail"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="pointer-events-none"
                >
                  Change
                </Button>
              </label>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRemove}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-3 text-muted-foreground transition-colors hover:bg-muted/50">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <ImagePlus className="h-10 w-10" />
            <div className="text-center">
              <p className="text-sm font-medium">Upload event thumbnail</p>
              <p className="text-xs">1:1 aspect ratio recommended</p>
            </div>
          </label>
        )}
      </div>

      {/* Crop Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crop Thumbnail</DialogTitle>
          </DialogHeader>
          {rawImage && (
            <ImageCropper
              imageSrc={rawImage}
              onCropComplete={handleCropComplete}
              aspectRatio={1}
              shape="rect"
              fileName="event-thumbnail.png"
            />
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCropCancel}>
              Cancel
            </Button>
            <Button onClick={handleCropConfirm} disabled={!croppedFile}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
