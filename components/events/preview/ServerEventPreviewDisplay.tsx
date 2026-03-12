"use client";

import { useMemo } from "react";
import type { PublicEventData } from "@/lib/api/fetchEventServer";
import type {
  ThemeAccent,
  EventTheme,
  DateTimeData,
  LocationData,
} from "../shared/types";
import {
  getThemeColors,
  getAccentGradient,
  DEFAULT_THEME,
} from "../shared/types";
import { useDocumentDark } from "@/lib/hooks/useDocumentDark";
import { ImageCarouselPreview } from "./ImageCarouselPreview";
import { CategoryDisplay } from "./CategoryDisplay";
import { TagsDisplay } from "./TagsDisplay";
import { DateDisplay } from "./DateDisplay";
import { LocationDisplay } from "./LocationDisplay";
import { PricingDisplay } from "./PricingDisplay";
import { HostsDisplay } from "./HostsDisplay";
import { DescriptionCard } from "./DescriptionCard";
import { FAQCard } from "./FAQCard";
import { WhatToBringCard } from "./WhatToBringCard";
import { PanelistsCard } from "./PanelistsCard";
import { CompaniesCard } from "./CompaniesCard";
import { RefundPolicyCard } from "./RefundPolicyCard";
import { LinksDisplay } from "./LinksDisplay";
import { SectionWrapper } from "./SectionWrapper";
import {
  SECTION_META,
  type SectionData,
  type SectionType,
} from "../sections/types";
import { cn } from "@/lib/utils";
import { SECTION_ICON_MAP } from "../sections/AddSectionButton";

interface ServerEventPreviewDisplayProps {
  event: PublicEventData;
  showImages?: boolean;
}

/* DB stores section types with underscores, SectionData uses dashes */
const DB_TYPE_MAP: Record<string, SectionType> = {
  faq: "faq",
  what_to_bring: "what-to-bring",
  "what-to-bring": "what-to-bring",
  panelists: "panelists",
  companies: "companies",
  refund_policy: "refund-policy",
  "refund-policy": "refund-policy",
};

/** Convert raw DB section → typed SectionData */
function toSectionData(raw: {
  type: string;
  data: unknown;
}): SectionData | null {
  const mapped = DB_TYPE_MAP[raw.type];
  if (!mapped) return null;
  return { type: mapped, ...(raw.data as object) } as SectionData;
}

/**
 * Server-friendly event preview display.
 * Takes PublicEventData and renders using the same preview components
 * as the edit-mode preview, ensuring identical appearance.
 */
export function ServerEventPreviewDisplay({
  event,
  showImages = true,
}: ServerEventPreviewDisplayProps) {
  const theme: EventTheme = event.theme
    ? {
        mode: (event.theme.mode as "light" | "dark" | "adaptive") ?? "adaptive",
        layout: (event.theme.layout as "card" | "classic") ?? "card",
        accent: (event.theme.accent as ThemeAccent) ?? "none",
        accentCustom: event.theme.accent_custom ?? undefined,
        bgColor: event.theme.bg_color ?? undefined,
      }
    : DEFAULT_THEME;

  const colors = useMemo(() => getThemeColors(theme.mode), [theme.mode]);
  const isDark = colors.isDark;
  useDocumentDark(isDark);

  const accentGradient = useMemo(
    () => getAccentGradient(theme.accent, isDark, theme.accentCustom),
    [theme.accent, isDark, theme.accentCustom],
  );
  const pageTextClass = isDark ? "text-neutral-200" : "text-foreground";

  /* Build preview props from server data */
  const dateTimeData: DateTimeData = {
    startDate: event.start ? event.start.split("T")[0] : "",
    startTime: event.start
      ? (event.start.split("T")[1]?.slice(0, 5) ?? "")
      : "",
    endDate: event.end ? event.end.split("T")[0] : "",
    endTime: event.end ? (event.end.split("T")[1]?.slice(0, 5) ?? "") : "",
    timezone: event.timezone ?? "Australia/Sydney",
  };

  const locationData: LocationData | null = event.is_online
    ? null
    : event.location
      ? {
          displayName: event.location.venue ?? "",
          address: event.location.address ?? "",
          lat: event.location.latitude ?? undefined,
          lon: event.location.longitude ?? undefined,
        }
      : null;

  const imageUrls = event.images.map((img) => img.url);

  const linkData = event.links.map((link) => ({
    id: link.id,
    url: link.url,
    title: link.title ?? "",
  }));

  const hostData = {
    creator: event.creator_profile
      ? {
          id: event.creator_profile.id,
          first_name: event.creator_profile.first_name,
          avatar_url: event.creator_profile.avatar_url,
        }
      : null,
    others: event.hosts
      .filter(
        (h) =>
          (h.status === "accepted" || h.status === "pending") && h.profiles,
      )
      .map((h) => ({
        id: h.profiles!.id,
        first_name: h.profiles!.first_name,
        avatar_url: h.profiles!.avatar_url,
      })),
  };

  /* Convert raw DB sections → typed SectionData for preview cards */
  const sections = event.sections
    .map(toSectionData)
    .filter((s): s is SectionData => s !== null);

  const solidBg =
    theme.layout === "card" && theme.bgColor ? theme.bgColor : undefined;

  return (
    <div
      className={cn("min-h-screen pb-12", colors.pageBg, isDark && "dark")}
      style={solidBg ? { backgroundColor: solidBg } : undefined}
    >
      <div style={accentGradient ? { background: accentGradient } : undefined}>
        <div
          className={cn(
            "mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-8",
            pageTextClass,
          )}
        >
          <div className="space-y-6">
            {/* Images */}
            {showImages && imageUrls.length > 0 && (
              <ImageCarouselPreview value={imageUrls} />
            )}

            {/* Title */}
            <div className="mb-4">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {event.name || "Untitled Event"}
              </h1>
            </div>

            {/* Category & Tags */}
            {(event.category || (event.tags && event.tags.length > 0)) && (
              <div className="mb-6 space-y-3">
                {event.category && <CategoryDisplay value={event.category} />}
                {event.tags && event.tags.length > 0 && (
                  <TagsDisplay value={event.tags} />
                )}
              </div>
            )}

            {/* Key details (Date, Location, Pricing, Hosts) */}
            <div className="mb-8 space-y-4">
              <DateDisplay value={dateTimeData} />
              {locationData && <LocationDisplay value={locationData} />}
              <PricingDisplay value={event.ticket_tiers} />
              {hostData.creator && (
                <HostsDisplay
                  creatorProfile={hostData.creator}
                  value={hostData.others}
                />
              )}
              {linkData && linkData.length > 0 && (
                <LinksDisplay value={linkData} />
              )}
            </div>
          </div>

          <div
            className={cn(
              "mt-10",
              theme.layout === "classic" ? "space-y-10" : "space-y-6",
            )}
          >
            {/* Description */}
            {event.description && (
              <>
                <SectionWrapper
                  title="About this event"
                  layout={theme.layout}
                  isDark={isDark}
                >
                  <DescriptionCard value={event.description} />
                </SectionWrapper>
              </>
            )}

            {/* Sections — use same preview card components as EventForm preview */}
            {sections.length > 0 &&
              sections.map((section, i) => {
                const Icon = SECTION_ICON_MAP[section.type];
                return (
                  <div key={i} className="mb-4">
                    <SectionWrapper
                      layout={theme.layout}
                      isDark={isDark}
                      title={SECTION_META[section.type].label}
                      icon={Icon ? <Icon /> : undefined}
                    >
                      {section.type === "faq" && <FAQCard data={section} />}
                      {section.type === "what-to-bring" && (
                        <WhatToBringCard data={section} />
                      )}
                      {section.type === "panelists" && (
                        <PanelistsCard data={section} />
                      )}
                      {section.type === "companies" && (
                        <CompaniesCard data={section} />
                      )}
                      {section.type === "refund-policy" && (
                        <RefundPolicyCard data={section} />
                      )}
                    </SectionWrapper>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
