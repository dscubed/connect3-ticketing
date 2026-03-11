"use client";

import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { SectionWrapper } from "../preview/SectionWrapper";
import type { ThemeLayout } from "../shared/types";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import { toast } from "sonner";

interface EventDescriptionFieldProps {
  mode: "edit" | "preview";
  value: string;
  onChange?: (value: string) => void;
  layout?: ThemeLayout;
  isDark?: boolean;
  /** Called when the inline focus state changes (true = focused, false = blurred). */
  onFocusChange?: (focused: boolean) => void;
  /** When true, another collaborator is editing this section. */
  locked?: boolean;
  /** Display name of the collaborator holding the lock. */
  lockedBy?: string;
}

export function EventDescriptionField({
  mode,
  value,
  onChange,
  layout = "card",
  isDark,
  onFocusChange,
  locked,
  lockedBy,
}: EventDescriptionFieldProps) {
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /* Click-outside detection (ignores portaled dialogs / popovers) */
  useEffect(() => {
    if (!focused || mode !== "edit") return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          '[role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]',
        )
      )
        return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setFocused(false);
        onFocusChange?.(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [focused, mode, onFocusChange]);

  const handleClick = () => {
    if (mode !== "edit") return;
    if (locked) {
      toast.info(`${lockedBy ?? "Someone"} is currently editing this section`);
      return;
    }
    setFocused(true);
    onFocusChange?.(true);
  };

  const showEdit = mode === "edit" && focused && !locked;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative",
        mode === "edit" && locked && "opacity-50 pointer-events-auto",
      )}
    >
      {/* Subtle lock indicator */}
      {mode === "edit" && locked && (
        <div className="absolute right-2 top-2 z-10">
          <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
        </div>
      )}

      <SectionWrapper title="Event Description" layout={layout} isDark={isDark}>
        {showEdit ? (
          <Textarea
            autoFocus
            placeholder="Tell people what your event is about..."
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            rows={6}
            className={cn(
              "resize-none",
              isDark &&
                "border-neutral-600 bg-neutral-700 text-neutral-100 placeholder:text-neutral-400",
            )}
          />
        ) : (
          <div
            onClick={handleClick}
            className={cn(
              mode === "edit" &&
                !locked &&
                "cursor-pointer rounded-md p-2 -m-2 transition-colors",
              mode === "edit" &&
                !locked &&
                (isDark ? "hover:bg-neutral-700/50" : "hover:bg-muted/50"),
              mode === "edit" && locked && "cursor-not-allowed",
            )}
          >
            <p
              className={`whitespace-pre-wrap text-sm leading-relaxed ${
                value ? "text-foreground/90" : "italic text-muted-foreground"
              }`}
            >
              {value ||
                (mode === "edit"
                  ? "Click to add a description…"
                  : "No description provided")}
            </p>
          </div>
        )}
      </SectionWrapper>
    </div>
  );
}
