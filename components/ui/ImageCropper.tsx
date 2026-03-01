"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut } from "lucide-react";
import { getCroppedImg, type CropArea } from "@/lib/utils/cropImage";

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedFile: File) => void;
  aspectRatio?: number;
  shape?: "rect" | "round";
  initialZoom?: number;
  fileName?: string;
}

export default function ImageCropper({
  imageSrc,
  onCropComplete,
  aspectRatio = 16 / 9,
  shape = "rect",
  initialZoom = 1,
  fileName = "cropped-image.png",
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialZoom);

  const onCropCompleteInternal = useCallback(
    async (_croppedArea: CropArea, croppedAreaPixels: CropArea) => {
      try {
        const croppedFile = await getCroppedImg(
          imageSrc,
          croppedAreaPixels,
          fileName,
          "image/png",
        );
        onCropComplete(croppedFile);
      } catch (error) {
        console.error("Error cropping image:", error);
      }
    },
    [imageSrc, fileName, onCropComplete],
  );

  return (
    <div className="relative flex w-full flex-col">
      <div
        className="relative w-full overflow-hidden rounded-lg bg-black"
        style={{ aspectRatio }}
      >
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspectRatio}
          cropShape={shape}
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropCompleteInternal}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Slider
          min={1}
          max={3}
          step={0.1}
          value={[zoom]}
          onValueChange={(value: number[]) => setZoom(value[0])}
          className="flex-1"
        />
        <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        Drag to reposition · Scroll or use slider to zoom
      </p>
    </div>
  );
}
