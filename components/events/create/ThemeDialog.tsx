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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sun,
  Moon,
  Monitor,
  LayoutGrid,
  AlignJustify,
  Ban,
  Pipette,
} from "lucide-react";
import type {
  EventTheme,
  ThemeMode,
  ThemeLayout,
  ThemeAccent,
} from "../shared/types";
import { cn } from "@/lib/utils";
import { HexColorPicker } from "react-colorful";

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

const ACCENT_OPTIONS: {
  value: ThemeAccent;
  label: string;
  /** Tailwind bg class for the swatch (or null for the "none" icon) */
  swatch: string | null;
}[] = [
  { value: "none", label: "None", swatch: null },
  { value: "yellow", label: "Yellow", swatch: "bg-yellow-400" },
  { value: "cyan", label: "Cyan", swatch: "bg-cyan-400" },
  { value: "purple", label: "Purple", swatch: "bg-purple-400" },
  { value: "orange", label: "Orange", swatch: "bg-orange-400" },
  { value: "green", label: "Green", swatch: "bg-green-400" },
  { value: "custom", label: "Custom", swatch: null },
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
                    onClick={() =>
                      applyLive({
                        ...theme,
                        layout: opt.value,
                        ...(opt.value === "classic"
                          ? { bgColor: undefined }
                          : {}),
                      })
                    }
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

          <Separator />

          {/* ── Background ── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Background</Label>
            <Tabs defaultValue="accent" className="gap-1">
              <TabsList className="h-8 w-full">
                <TabsTrigger value="accent" className="text-xs">
                  Gradient Accent
                </TabsTrigger>
                <span
                  title={
                    theme.layout !== "card"
                      ? "Only available with Card layout — cards keep text readable on any background."
                      : undefined
                  }
                  className="flex flex-1"
                >
                  <TabsTrigger
                    value="solid"
                    className="text-xs w-full"
                    disabled={theme.layout !== "card"}
                  >
                    Solid Color
                  </TabsTrigger>
                </span>
              </TabsList>

              {/* ── Accent tab ── */}
              <TabsContent value="accent" className="pt-1">
                <p className="text-xs text-muted-foreground mb-2">
                  Adds a subtle gradient tint to the top of the page.
                </p>
                <div className="flex gap-2">
                  {ACCENT_OPTIONS.map((opt) => {
                    const isActive = theme.accent === opt.value;
                    return opt.value === "custom" ? (
                      <Popover key={opt.value}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            title={opt.label}
                            className={cn(
                              "relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                              isActive
                                ? "border-transparent scale-110"
                                : "border-border hover:border-muted-foreground/50",
                            )}
                            style={
                              isActive
                                ? {
                                    backgroundImage:
                                      "linear-gradient(white, white), linear-gradient(135deg, #f472b6, #a855f7, #06b6d4, #22c55e, #eab308)",
                                    backgroundOrigin: "border-box",
                                    backgroundClip: "padding-box, border-box",
                                  }
                                : undefined
                            }
                            onClick={() =>
                              applyLive({
                                ...theme,
                                accent: "custom",
                                ...(!theme.accentCustom
                                  ? { accentCustom: "#6366f1" }
                                  : {}),
                              })
                            }
                          >
                            {theme.accent === "custom" && theme.accentCustom ? (
                              <span
                                className="h-5 w-5 rounded-full border"
                                style={{ backgroundColor: theme.accentCustom }}
                              />
                            ) : (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-br from-pink-400 via-purple-400 to-cyan-400">
                                <Pipette className="h-3 w-3 text-white" />
                              </span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          side="right"
                          align="start"
                          className="w-auto space-y-3 p-3"
                        >
                          <HexColorPicker
                            color={theme.accentCustom || "#6366f1"}
                            onChange={(color) =>
                              applyLive({
                                ...theme,
                                accent: "custom",
                                accentCustom: color,
                              })
                            }
                            style={{ width: 200, height: 160 }}
                          />
                          <div className="flex items-center gap-2">
                            <div
                              className="h-7 w-7 shrink-0 rounded-md border"
                              style={{
                                backgroundColor:
                                  theme.accentCustom || "#6366f1",
                              }}
                            />
                            <input
                              type="text"
                              maxLength={7}
                              value={theme.accentCustom || "#6366f1"}
                              onChange={(e) => {
                                const v = e.currentTarget.value;
                                applyLive({
                                  ...theme,
                                  accent: "custom",
                                  accentCustom: v,
                                });
                              }}
                              className="h-8 w-full rounded-md border bg-transparent px-2 text-sm font-mono"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <button
                        key={opt.value}
                        type="button"
                        title={opt.label}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                          isActive
                            ? "border-primary scale-110"
                            : "border-border hover:border-muted-foreground/50",
                        )}
                        onClick={() =>
                          applyLive({
                            ...theme,
                            accent: opt.value,
                          })
                        }
                      >
                        {opt.value === "none" ? (
                          <Ban className="h-4 w-4 text-red-400" />
                        ) : (
                          <span
                            className={cn("h-5 w-5 rounded-full", opt.swatch)}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </TabsContent>

              {/* ── Solid Color tab ── */}
              <TabsContent value="solid" className="pt-1">
                <p className="text-xs text-muted-foreground mb-2">
                  Sets a solid background color for the page. Cards keep text
                  readable.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    title="No color"
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                      !theme.bgColor
                        ? "border-primary scale-110"
                        : "border-border hover:border-muted-foreground/50",
                    )}
                    onClick={() => applyLive({ ...theme, bgColor: undefined })}
                  >
                    <Ban className="h-4 w-4 text-red-400" />
                  </button>
                  {[
                    { hex: "#fef3c7", label: "Cream" },
                    { hex: "#dbeafe", label: "Sky" },
                    { hex: "#ede9fe", label: "Lavender" },
                    { hex: "#fce7f3", label: "Rose" },
                    { hex: "#d1fae5", label: "Mint" },
                    { hex: "#fed7aa", label: "Peach" },
                    { hex: "#1e1b4b", label: "Indigo" },
                    { hex: "#172554", label: "Navy" },
                    { hex: "#1a2e05", label: "Forest" },
                    { hex: "#44403c", label: "Stone" },
                  ].map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      title={preset.label}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                        theme.bgColor === preset.hex
                          ? "border-primary scale-110"
                          : "border-border hover:border-muted-foreground/50",
                      )}
                      onClick={() =>
                        applyLive({ ...theme, bgColor: preset.hex })
                      }
                    >
                      <span
                        className="h-5 w-5 rounded-full"
                        style={{ backgroundColor: preset.hex }}
                      />
                    </button>
                  ))}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        title="Custom color"
                        className={cn(
                          "relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                          theme.bgColor &&
                            ![
                              "#fef3c7",
                              "#dbeafe",
                              "#ede9fe",
                              "#fce7f3",
                              "#d1fae5",
                              "#fed7aa",
                              "#1e1b4b",
                              "#172554",
                              "#1a2e05",
                              "#44403c",
                            ].includes(theme.bgColor)
                            ? "border-transparent scale-110"
                            : "border-border hover:border-muted-foreground/50",
                        )}
                        style={
                          theme.bgColor &&
                          ![
                            "#fef3c7",
                            "#dbeafe",
                            "#ede9fe",
                            "#fce7f3",
                            "#d1fae5",
                            "#fed7aa",
                            "#1e1b4b",
                            "#172554",
                            "#1a2e05",
                            "#44403c",
                          ].includes(theme.bgColor)
                            ? {
                                backgroundImage:
                                  "linear-gradient(white, white), linear-gradient(135deg, #f472b6, #a855f7, #06b6d4, #22c55e, #eab308)",
                                backgroundOrigin: "border-box",
                                backgroundClip: "padding-box, border-box",
                              }
                            : undefined
                        }
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-br from-pink-400 via-purple-400 to-cyan-400">
                          <Pipette className="h-3 w-3 text-white" />
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="right"
                      align="start"
                      className="w-auto space-y-3 p-3"
                    >
                      <HexColorPicker
                        color={theme.bgColor || "#6366f1"}
                        onChange={(color) =>
                          applyLive({ ...theme, bgColor: color })
                        }
                        style={{ width: 200, height: 160 }}
                      />
                      <div className="flex items-center gap-2">
                        <div
                          className="h-7 w-7 shrink-0 rounded-md border"
                          style={{
                            backgroundColor: theme.bgColor || "#6366f1",
                          }}
                        />
                        <input
                          type="text"
                          maxLength={7}
                          value={theme.bgColor || "#6366f1"}
                          onChange={(e) => {
                            const v = e.currentTarget.value;
                            applyLive({ ...theme, bgColor: v });
                          }}
                          className="h-8 w-full rounded-md border bg-transparent px-2 text-sm font-mono"
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter className="gap-2">
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
