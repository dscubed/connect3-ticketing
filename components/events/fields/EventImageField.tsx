"use client";

import { useMemo } from "react";
import type { CarouselImage } from "../shared/types";
import { ImageCarousel } from "../create/ImageCarousel";
import { ImageCarouselPreview } from "../preview/ImageCarouselPreview";

interface EventImageFieldProps {
  mode: "edit" | "preview";
  images: CarouselImage[];
  existingImages?: string[];
  onEditClick?: () => void;
}

export function EventImageField({
  mode,
  images,
  existingImages,
  onEditClick,
}: EventImageFieldProps) {
  const previewUrls = useMemo(() => images.map((i) => i.preview), [images]);
  const urls = previewUrls.length > 0 ? previewUrls : (existingImages ?? []);

  if (mode === "preview") {
    return <ImageCarouselPreview value={urls} />;
  }

  return (
    <ImageCarousel images={images} onEditClick={onEditClick ?? (() => {})} />
  );
}
