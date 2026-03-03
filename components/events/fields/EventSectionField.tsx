"use client";

import type { SectionData, DragHandleProps } from "../sections";
import type { ThemeLayout } from "../shared/types";
import {
  FAQSectionCard,
  WhatToBringSectionCard,
  PanelistsSectionCard,
  CompaniesSectionCard,
  SectionDragHandle,
} from "../sections";
import {
  FAQCard,
  WhatToBringCard,
  PanelistsCard,
  CompaniesCard,
  SectionWrapper,
} from "../preview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HelpCircle, Backpack, Mic, Building2, Trash2 } from "lucide-react";

/* ── Section metadata (title + icon per type) ── */
const SECTION_META: Record<
  SectionData["type"],
  { title: string; icon: React.ReactNode }
> = {
  faq: { title: "FAQ", icon: <HelpCircle /> },
  "what-to-bring": { title: "What To Bring", icon: <Backpack /> },
  panelists: { title: "Panelists / Lineup", icon: <Mic /> },
  companies: { title: "Companies", icon: <Building2 /> },
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
}: EventSectionFieldProps) {
  const meta = SECTION_META[section.type];

  /* Edit-mode header slots */
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

  /* Inner content — preview or edit */
  const renderContent = () => {
    if (mode === "preview") {
      switch (section.type) {
        case "faq":
          return <FAQCard data={section} />;
        case "what-to-bring":
          return <WhatToBringCard data={section} />;
        case "panelists":
          return <PanelistsCard data={section} />;
        case "companies":
          return <CompaniesCard data={section} />;
      }
    }

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
    }
  };

  return (
    <SectionWrapper
      title={meta.title}
      icon={meta.icon}
      layout={layout}
      isDark={isDark}
      headerLeft={headerLeft}
      headerRight={headerRight}
    >
      {renderContent()}
    </SectionWrapper>
  );
}
