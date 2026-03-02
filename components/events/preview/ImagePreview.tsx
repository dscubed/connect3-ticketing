import Image from "next/image";
import { ImagePlus } from "lucide-react";
import type { PreviewInputProps } from "../shared/types";

type ImagePreviewProps = PreviewInputProps<string | null>;

/** Read-only event thumbnail — shows the image or a dashed placeholder. */
export function ImagePreview({ value }: ImagePreviewProps) {
  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-xl">
      {value ? (
        <div className="relative aspect-square w-full">
          <Image
            src={value}
            alt="Event thumbnail"
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/30">
          <div className="flex aspect-square flex-col items-center justify-center gap-3 text-muted-foreground">
            <ImagePlus className="h-10 w-10" />
            <div className="text-center">
              <p className="text-sm font-medium">No thumbnail</p>
              <p className="text-xs">1:1 aspect ratio recommended</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
