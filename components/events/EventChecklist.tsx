"use client";

import { useState, useMemo, useCallback } from "react";
import {
  CheckCircle2,
  Circle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EventFormData } from "./EventForm";
import type { SectionData, FAQSectionData } from "./sections";

interface ChecklistItem {
  id: string;
  label: string;
  check: (form: EventFormData, sections: SectionData[]) => boolean;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "thumbnail",
    label: "Add a thumbnail",
    check: (f) => !!f.thumbnailFile,
  },
  {
    id: "start-date",
    label: "Add a start date",
    check: (f) => !!f.startDate,
  },
  {
    id: "location",
    label: "Add a location",
    check: (f) => !!f.location.displayName,
  },
  {
    id: "category",
    label: "Select a category",
    check: (f) => !!f.category,
  },
  {
    id: "tags",
    label: "Add at least 2 tags",
    check: (f) => f.tags.length >= 2,
  },
  {
    id: "faqs",
    label: "Add 2 FAQs",
    check: (_f, s) => {
      const faq = s.find((sec) => sec.type === "faq") as
        | FAQSectionData
        | undefined;
      if (!faq) return false;
      return (
        faq.items.filter((q) => q.question.trim() && q.answer.trim()).length >=
        2
      );
    },
  },
];

/** Map from checklist item id → ref to the relevant DOM element */
export type ChecklistRefMap = Record<
  string,
  React.RefObject<HTMLDivElement | null>
>;

export interface EventChecklistProps {
  form: EventFormData;
  sections: SectionData[];
  hasExistingThumbnail?: boolean;
  /** Refs to scroll to when clicking a task */
  elementRefs?: ChecklistRefMap;
  /** Externally-managed set of dismissed item ids */
  dismissed: Set<string>;
  onDismissChange: (dismissed: Set<string>) => void;
}

export function EventChecklist({
  form,
  sections,
  hasExistingThumbnail,
  elementRefs,
  dismissed,
  onDismissChange,
}: EventChecklistProps) {
  const [collapsed, setCollapsed] = useState(false);

  const effectiveForm = useMemo(
    () =>
      hasExistingThumbnail
        ? { ...form, thumbnailFile: form.thumbnailFile ?? ({} as File) }
        : form,
    [form, hasExistingThumbnail],
  );

  const items = useMemo(() => {
    return CHECKLIST_ITEMS.map((item) => ({
      ...item,
      completed: item.check(effectiveForm, sections),
      dismissed: dismissed.has(item.id),
    }));
  }, [effectiveForm, sections, dismissed]);

  const completedCount = items.filter((i) => i.completed).length;
  const totalVisible = items.filter((i) => !i.dismissed).length;
  const allDone = items.filter((i) => !i.dismissed).every((i) => i.completed);

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    onDismissChange(next);
  };

  const undismiss = (id: string) => {
    const next = new Set(dismissed);
    next.delete(id);
    onDismissChange(next);
  };

  const scrollToElement = useCallback(
    (id: string) => {
      const ref = elementRefs?.[id];
      if (!ref?.current) return;
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      // Quick pop animation
      ref.current.style.transition = "transform 0.2s ease";
      ref.current.style.transform = "scale(1.03)";
      setTimeout(() => {
        if (ref.current) {
          ref.current.style.transform = "scale(1)";
          setTimeout(() => {
            if (ref.current) {
              ref.current.style.transition = "";
              ref.current.style.transform = "";
            }
          }, 200);
        }
      }, 300);
    },
    [elementRefs],
  );

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72">
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className={cn(
            "flex w-full items-center gap-2 rounded-full border bg-background px-4 py-2.5 shadow-lg transition-colors hover:bg-accent",
            allDone && "border-green-500/30 bg-green-500/5",
          )}
        >
          <ListChecks
            className={cn(
              "h-4 w-4",
              allDone ? "text-green-500" : "text-muted-foreground",
            )}
          />
          <span className="flex-1 text-left text-sm font-medium">
            {allDone
              ? "All done!"
              : `${completedCount}/${totalVisible} completed`}
          </span>
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        </button>
      ) : (
        <div className="rounded-xl border bg-background shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Event checklist</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground"
                onClick={() => setCollapsed(true)}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-4 pt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-300"
                style={{
                  width: `${totalVisible ? (completedCount / totalVisible) * 100 : 100}%`,
                }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {completedCount}/{totalVisible} completed
            </p>
          </div>

          {/* Items */}
          <div className="px-2 py-2">
            {items.map((item) => {
              /* ── Dismissed ── */
              if (item.dismissed) {
                return (
                  <div
                    key={item.id}
                    className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                  >
                    <XCircle className="h-4 w-4 shrink-0 text-destructive/60" />
                    <span className="flex-1 text-sm text-muted-foreground/60 line-through">
                      {item.label}
                    </span>
                    <button
                      onClick={() => undismiss(item.id)}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      title="Undo dismiss"
                    >
                      <Undo2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                );
              }

              /* ── Completed ── */
              if (item.completed) {
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    <span className="flex-1 text-sm text-muted-foreground line-through">
                      {item.label}
                    </span>
                  </div>
                );
              }

              /* ── Pending ── */
              return (
                <div
                  key={item.id}
                  className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                >
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                  <button
                    type="button"
                    onClick={() => scrollToElement(item.id)}
                    className="flex-1 text-left text-sm hover:text-foreground"
                  >
                    {item.label}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss(item.id);
                    }}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    title="Dismiss"
                  >
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-destructive" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Small pinging attention dot — place inside a relative parent */
export function AttentionBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="absolute -right-1 -top-1 z-10 flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
    </span>
  );
}
