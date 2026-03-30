"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ThemeLayout } from "../shared/types";
import { useEditorTheme } from "../shared/EventEditorContext";
import { cn } from "@/lib/utils";

interface SectionWrapperProps {
  title: string;
  icon?: React.ReactNode;
  layout?: ThemeLayout;
  /** When true, applies dark surface colours to the card. */
  isDark?: boolean;
  /** Slot rendered before the icon/title (e.g. drag handle in edit mode). */
  headerLeft?: React.ReactNode;
  /** Slot rendered at the far right of the header (e.g. remove button). */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Reusable wrapper for section content (both edit and preview).
 *
 * - **card** layout: renders inside a shadcn `<Card>`.
 * - **classic** layout: renders a heading + separator, then bare content.
 *
 * `layout` and `isDark` are read from `EventEditorContext` when available,
 * with explicit props taking precedence (for visitor pages without a provider).
 */
export function SectionWrapper({
  title,
  icon,
  layout: layoutProp,
  isDark: isDarkProp,
  headerLeft,
  headerRight,
  children,
}: SectionWrapperProps) {
  const ctx = useEditorTheme();
  const layout = layoutProp ?? ctx?.theme.layout ?? "card";
  const isDark = isDarkProp ?? ctx?.isDark;
  const hasHeader = !!(title || icon || headerLeft || headerRight);

  if (layout === "classic") {
    return (
      <div className="space-y-4">
        {hasHeader && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {headerLeft}
                {icon && (
                  <span
                    className={cn(
                      "[&>svg]:h-5 [&>svg]:w-5",
                      isDark ? "text-neutral-400" : "text-muted-foreground",
                    )}
                  >
                    {icon}
                  </span>
                )}
                {title && <h3 className="text-2xl font-bold">{title}</h3>}
              </div>
              {headerRight}
            </div>
            <Separator className={isDark ? "bg-neutral-700" : undefined} />
          </>
        )}
        <div>{children}</div>
      </div>
    );
  }

  /* card (default) */
  return (
    <Card
      className={cn(
        isDark && "border-neutral-700 bg-neutral-800 text-neutral-100",
      )}
    >
      {hasHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {headerLeft}
              {icon && (
                <span
                  className={cn(
                    "[&>svg]:h-5 [&>svg]:w-5",
                    isDark ? "text-neutral-400" : "text-muted-foreground",
                  )}
                >
                  {icon}
                </span>
              )}
              {title && (
                <CardTitle className="text-xl font-bold">{title}</CardTitle>
              )}
            </div>
            {headerRight}
          </div>
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
