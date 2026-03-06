"use client";

import { useState, useRef, useEffect } from "react";
import type { SectionData, DragHandleProps } from "../sections";
import type { ThemeLayout } from "../shared/types";
import {
  FAQSectionCard,
  WhatToBringSectionCard,
  PanelistsSectionCard,
  CompaniesSectionCard,
  RefundPolicySectionCard,
  SectionDragHandle,
} from "../sections";
import {
  FAQCard,
  WhatToBringCard,
  PanelistsCard,
  CompaniesCard,
  RefundPolicyCard,
  SectionWrapper,
} from "../preview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  HelpCircle,
  Backpack,
  Mic,
  Building2,
  ReceiptText,
  Trash2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

/* ── Section metadata (title + icon per type) ── */
const SECTION_META: Record<
  SectionData["type"],
  { title: string; icon: React.ReactNode }
> = {
  faq: { title: "FAQ", icon: <HelpCircle /> },
  "refund-policy": { title: "Refund Policy", icon: <ReceiptText /> },
  "what-to-bring": { title: "What To Bring", icon: <Backpack /> },
  panelists: { title: "Panelists / Lineup", icon: <Mic /> },
  companies: { title: "Companies / Institutions", icon: <Building2 /> },
};

interface EventSectionFieldProps {
  mode: "edit" | "preview";
  section: SectionData;
  index: number;
  layout?: ThemeLayout;
  isDark?: boolean;
  dragHandleProps?: DragHandleProps;
  onChange?: (index: number, data: SectionData) => void;
  onRemove?: (index: number) => void;
  /** Called when the inline focus state changes (true = focused, false = blurred). */
  onFocusChange?: (focused: boolean) => void;
  /** When true, another collaborator is editing this section. */
  locked?: boolean;
  /** Display name of the collaborator holding the lock. */
  lockedBy?: string;
}

export function EventSectionField({
  mode,
  section,
  index,
  layout = "card",
  isDark,
  dragHandleProps,
  onChange,
  onRemove,
  onFocusChange,
  locked,
  lockedBy,
}: EventSectionFieldProps) {
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
    if (mode !== "edit" || focused) return;
    if (locked) {
      toast.info(`${lockedBy ?? "Someone"} is currently editing this section`);
      return;
    }
    setFocused(true);
    onFocusChange?.(true);
  };

  const meta = SECTION_META[section.type];
  const showEditContent = mode === "edit" && focused && !locked;

  /* Edit-mode header slots — always visible in edit mode regardless of focus */
  const headerLeft =
    mode === "edit" && dragHandleProps ? (
      <SectionDragHandle dragHandleProps={dragHandleProps} />
    ) : undefined;

  const headerRight =
    mode === "edit" ? (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove?.(index)}
        className={cn(
          "h-8 text-muted-foreground hover:text-destructive",
          isDark && "hover:bg-neutral-700",
        )}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    ) : undefined;

  /* Inner content — preview when unfocused, edit when focused */
  const renderContent = () => {
    if (showEditContent) {
      switch (section.type) {
        case "faq":
          return (
            <FAQSectionCard
              data={section}
              onChange={(d) => onChange?.(index, d)}
              isDark={isDark}
            />
          );
        case "what-to-bring":
          return (
            <WhatToBringSectionCard
              data={section}
              onChange={(d) => onChange?.(index, d)}
              isDark={isDark}
            />
          );
        case "panelists":
          return (
            <PanelistsSectionCard
              data={section}
              onChange={(d) => onChange?.(index, d)}
              isDark={isDark}
            />
          );
        case "companies":
          return (
            <CompaniesSectionCard
              data={section}
              onChange={(d) => onChange?.(index, d)}
              isDark={isDark}
            />
          );
        case "refund-policy":
          return (
            <RefundPolicySectionCard
              data={section}
              onChange={(d) => onChange?.(index, d)}
              isDark={isDark}
            />
          );
      }
    }

    /* Preview content (global preview mode OR edit-mode unfocused) */
    switch (section.type) {
      case "faq":
        return <FAQCard data={section} />;
      case "what-to-bring":
        return <WhatToBringCard data={section} />;
      case "panelists":
        return <PanelistsCard data={section} />;
      case "companies":
        return <CompaniesCard data={section} />;
      case "refund-policy":
        return <RefundPolicyCard data={section} />;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Lock overlay */}
      {mode === "edit" && locked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/50 backdrop-blur-[1px]">
          <div className="flex items-center gap-1.5 rounded-full bg-muted/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
            <Lock className="h-3 w-3" />
            {lockedBy ?? "Someone"} is editing…
          </div>
        </div>
      )}

      <SectionWrapper
        title={meta.title}
        icon={meta.icon}
        layout={layout}
        isDark={isDark}
        headerLeft={headerLeft}
        headerRight={headerRight}
      >
        <div
          onClick={handleClick}
          className={cn(
            mode === "edit" &&
              !focused &&
              !locked &&
              "cursor-pointer rounded-md p-2 -m-2 transition-colors",
            mode === "edit" &&
              !focused &&
              !locked &&
              (isDark ? "hover:bg-neutral-700/50" : "hover:bg-muted/50"),
            mode === "edit" && locked && "cursor-not-allowed",
          )}
        >
          {renderContent()}
        </div>
      </SectionWrapper>
    </div>
  );
}
