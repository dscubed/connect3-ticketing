"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DismissableSheet } from "@/components/ui/dismissable-sheet";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  /** Extra className for the Dialog/Sheet content wrapper */
  className?: string;
  /** Whether to show the close button in desktop dialog (default: true) */
  showCloseButton?: boolean;
}

/**
 * Renders a Dialog on desktop and a DismissableSheet (bottom sheet with drag handle)
 * on mobile. Shares the same open/onOpenChange API.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  showCloseButton = true,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DismissableSheet open={open} onOpenChange={onOpenChange}>
        {(title || description) && (
          <div className="mb-4 flex flex-col gap-1.5">
            {title && (
              <h2 className="text-lg font-semibold leading-none">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        )}
        {children}
      </DismissableSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className} showCloseButton={showCloseButton}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}
