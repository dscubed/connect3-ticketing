"use client";

import { useMemo } from "react";
import { ImageCarousel } from "../create/ImageCarousel";
import { ImageCarouselPreview } from "../preview/ImageCarouselPreview";
import { useEventEditor } from "../shared/EventEditorContext";

interface EventImageFieldProps {
  onEditClick?: () => void;
}

export function EventImageField({ onEditClick }: EventImageFieldProps) {
  const { viewMode: mode, carouselImages } = useEventEditor();
  const urls = useMemo(
    () => carouselImages.filter((i) => i.url && !i.uploading).map((i) => i.url),
    [carouselImages],
  );

  if (mode === "preview") {
    return <ImageCarouselPreview value={urls} />;
  }

  return (
    <ImageCarousel images={carouselImages} onEditClick={onEditClick ?? (() => {})} />
  );
}
