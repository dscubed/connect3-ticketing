"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { ImagePlus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CarouselImage } from "../shared/types";
import { AttentionBadge } from "../EventChecklist";

interface ImageCarouselProps {
  images: CarouselImage[];
  onEditClick: () => void;
}

/** Track how many items are visible (1 on mobile, 3 on md+). */
function useVisibleCount() {
  const [visible, setVisible] = useState(1);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setVisible(mq.matches ? 3 : 1);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return visible;
}

export function ImageCarousel({ images, onEditClick }: ImageCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const count = images.length;
  const visibleCount = useVisibleCount();
  // Highlight the middle visible photo's dot
  const focusedDot = Math.min(
    current + Math.floor((visibleCount - 1) / 2),
    count - 1,
  );

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  if (images.length === 0) {
    return (
      <div className="relative mx-auto w-full sm:w-1/3 rounded-xl border border-dashed border-border bg-muted/30">
        <AttentionBadge show />
        <button
          type="button"
          onClick={onEditClick}
          className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-3 text-muted-foreground transition-colors hover:bg-muted/50"
        >
          <ImagePlus className="h-10 w-10" />
          <div className="text-center">
            <p className="text-sm font-medium">Upload event photos</p>
          </div>
        </button>
      </div>
    );
  }

  // Few photos on desktop: use simple flex layout for true centering
  // On mobile (visibleCount=1), carousel and flex produce the same result,
  // so we only use flex when visibleCount > 1 to avoid hydration mismatch
  if (visibleCount > 1 && count <= visibleCount) {
    return (
      <div className="group/carousel relative">
        <div className="flex justify-center gap-2">
          {images.map((img, i) => (
            <div
              key={img.id}
              className="relative aspect-square w-full overflow-hidden rounded-xl md:w-1/3"
            >
              <Image
                src={img.preview}
                alt={i === 0 ? "Thumbnail" : `Photo ${i + 1}`}
                fill
                className="object-cover"
                draggable={false}
              />
              {i === 0 && images.length > 1 && (
                <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground shadow">
                  Thumbnail
                </span>
              )}
            </div>
          ))}
        </div>
        {/* Edit button */}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="absolute right-2 top-2 gap-1.5 rounded-full shadow"
          onClick={onEditClick}
        >
          <Pencil className="h-3 w-3" />
          Edit photos
        </Button>
      </div>
    );
  }

  return (
    <div className="group/carousel relative">
      <Carousel
        setApi={setApi}
        opts={{
          align: count <= visibleCount ? "center" : "start",
          loop: false,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2">
          {images.map((img, i) => (
            <CarouselItem key={img.id} className="pl-2 md:basis-1/3">
              <div className="relative aspect-square overflow-hidden rounded-xl">
                <Image
                  src={img.preview}
                  alt={i === 0 ? "Thumbnail" : `Photo ${i + 1}`}
                  fill
                  className="object-cover"
                  draggable={false}
                />
                {i === 0 && images.length > 1 && (
                  <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground shadow">
                    Thumbnail
                  </span>
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2" />
        <CarouselNext className="right-2" />
      </Carousel>

      {/* Dots */}
      {count > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                // Offset scroll so clicked dot ends up as the middle visible photo
                const offset = Math.floor((visibleCount - 1) / 2);
                api?.scrollTo(Math.max(i - offset, 0));
              }}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === focusedDot
                  ? "w-4 bg-foreground"
                  : "w-1.5 bg-muted-foreground/40",
              )}
            />
          ))}
        </div>
      )}

      {/* Edit button */}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="absolute right-2 top-2 gap-1.5 rounded-full shadow"
        onClick={onEditClick}
      >
        <Pencil className="h-3 w-3" />
        Edit photos
      </Button>
    </div>
  );
}
