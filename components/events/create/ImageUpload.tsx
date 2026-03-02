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

/**
 * ImageUpload is a fire-and-forget file picker — the parent receives a File
 * via onChange but cannot push a File back in as a controlled value.
 * It does NOT extend EditInputProps because the input/output types differ
 * (string URL in via currentImage, File out via onChange).
 */
interface ImageUploadProps {
  /** Current thumbnail URL (for edit mode) */
  currentImage?: string | null;
  /** Called with the cropped File when user confirms */
  onChange: (file: File | null) => void;
}

/**
 * Event thumbnail upload with 1:1 aspect crop.
 * Shows a drop zone / preview and opens a crop dialog on file select.
 */
export function ImageUpload({ currentImage, onChange }: ImageUploadProps) {
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
    onChange(croppedFile);
    setCropDialogOpen(false);
    if (rawImage) URL.revokeObjectURL(rawImage);
    setRawImage(null);
  }, [croppedFile, rawImage, onChange]);

  const handleCropCancel = useCallback(() => {
    setCropDialogOpen(false);
    if (rawImage) URL.revokeObjectURL(rawImage);
    setRawImage(null);
    setCroppedFile(null);
  }, [rawImage]);

  const handleRemove = useCallback(() => {
    if (preview && !currentImage) URL.revokeObjectURL(preview);
    setPreview(null);
    onChange(null);
  }, [preview, currentImage, onChange]);

  return (
    <>
      <div className="relative mx-auto w-full overflow-hidden rounded-xl border border-dashed border-border bg-muted/30">
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
