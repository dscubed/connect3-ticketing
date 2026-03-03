"use client";

import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ImageCarouselPreviewProps {
  value: string[];
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

export function ImageCarouselPreview({ value }: ImageCarouselPreviewProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const count = value.length;
  const visibleCount = useVisibleCount();
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

  if (!value.length) {
    return (
      <div className="relative mx-auto w-1/3 rounded-xl border border-dashed border-border bg-muted/30">
        <div className="flex flex-col items-center gap-2 aspect-square justify-center">
          <ImageIcon className="h-10 w-10" />
          <p className="text-sm">No photos added</p>
        </div>
      </div>
    );
  }

  // Few photos on desktop: use simple flex layout for true centering
  if (visibleCount > 1 && count <= visibleCount) {
    return (
      <div className="w-full space-y-2">
        <div className="flex justify-center gap-2">
          {value.map((src, i) => (
            <div
              key={i}
              className="relative aspect-square w-full overflow-hidden rounded-xl border bg-muted md:w-1/3"
            >
              <Image
                src={src}
                alt={`Event photo ${i + 1}`}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <Carousel setApi={setApi} className="w-full" opts={{ align: "start" }}>
        <CarouselContent className="-ml-2">
          {value.map((src, i) => (
            <CarouselItem key={i} className="pl-2 md:basis-1/3">
              <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
                <Image
                  src={src}
                  alt={`Event photo ${i + 1}`}
                  fill
                  className="object-cover"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>

      {/* Dots */}
      {count > 1 && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                const offset = Math.floor((visibleCount - 1) / 2);
                api?.scrollTo(Math.max(i - offset, 0));
              }}
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === focusedDot
                  ? "w-5 bg-primary"
                  : "w-1.5 bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
