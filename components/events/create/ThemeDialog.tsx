"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Sun, Moon, Monitor, LayoutGrid, AlignJustify } from "lucide-react";
import type { EventTheme, ThemeMode, ThemeLayout } from "../shared/types";
import { cn } from "@/lib/utils";

interface ThemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: EventTheme;
  onConfirm: (theme: EventTheme) => void;
}

const MODE_OPTIONS: {
  value: ThemeMode;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
  { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
  { value: "adaptive", label: "Auto", icon: <Monitor className="h-4 w-4" /> },
];

const LAYOUT_OPTIONS: {
  value: ThemeLayout;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    value: "card",
    label: "Card",
    icon: <LayoutGrid className="h-4 w-4" />,
    description: "Sections in bordered cards",
  },
  {
    value: "classic",
    label: "Classic",
    icon: <AlignJustify className="h-4 w-4" />,
    description: "Headers with separator lines",
  },
];

export function ThemeDialog({
  open,
  onOpenChange,
  theme,
  onConfirm,
}: ThemeDialogProps) {
  /* Snapshot the theme when the dialog opens so we can revert on cancel */
  const [original, setOriginal] = useState<EventTheme>(theme);

  const handleOpenChange = (next: boolean) => {
    if (next) setOriginal(theme);
    onOpenChange(next);
  };

  /* Apply changes live so the user sees them behind the dialog */
  const applyLive = (next: EventTheme) => {
    onConfirm(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Page Theme</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── Color Mode ── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Color Mode</Label>
            <div className="flex gap-2">
              {MODE_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={theme.mode === opt.value ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => applyLive({ ...theme, mode: opt.value })}
                >
                  {opt.icon}
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* ── Layout Style ── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Section Layout</Label>
            <div className="grid grid-cols-2 gap-3">
              {LAYOUT_OPTIONS.map((opt) => {
                const isActive = theme.layout === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border-2 p-4 text-center transition-colors",
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/40",
                    )}
                    onClick={() => applyLive({ ...theme, layout: opt.value })}
                  >
                    {/* Mini preview */}
                    {opt.value === "card" ? (
                      <CardLayoutPreview />
                    ) : (
                      <ClassicLayoutPreview />
                    )}
                    <span className="mt-1 text-sm font-medium">
                      {opt.label}
                    </span>
                    <span className="text-[11px] leading-tight text-muted-foreground">
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onConfirm(original);
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Apply Theme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Tiny visual previews for the layout selector ── */

function CardLayoutPreview() {
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="rounded border bg-muted/40 p-1.5">
        <div className="h-1 w-8 rounded-full bg-muted-foreground/30" />
        <div className="mt-1 h-1 w-full rounded-full bg-muted-foreground/15" />
      </div>
      <div className="rounded border bg-muted/40 p-1.5">
        <div className="h-1 w-6 rounded-full bg-muted-foreground/30" />
        <div className="mt-1 h-1 w-full rounded-full bg-muted-foreground/15" />
      </div>
    </div>
  );
}

function ClassicLayoutPreview() {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <div>
        <div className="h-1 w-8 rounded-full bg-muted-foreground/30" />
        <div className="mt-0.5 h-px w-full bg-border" />
        <div className="mt-0.5 h-1 w-full rounded-full bg-muted-foreground/15" />
      </div>
      <div>
        <div className="h-1 w-6 rounded-full bg-muted-foreground/30" />
        <div className="mt-0.5 h-px w-full bg-border" />
        <div className="mt-0.5 h-1 w-full rounded-full bg-muted-foreground/15" />
      </div>
    </div>
  );
}
