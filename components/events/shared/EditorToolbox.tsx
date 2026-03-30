"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Pencil,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEventEditor, LastSavedLabel } from "./EventEditorContext";
import { SettingsModal } from "./toolbox/SettingsModal";
import { NavUserMenu } from "@/components/auth/NavUserMenu";
import { Separator } from "@/components/ui/separator";
export function EditorToolbox() {
  const {
    eventId,
    isDark,
    toolbarCollapsed,
    setToolbarCollapsed,
    handleBack,
    flush,
    isAutoSaving,
    lastSavedAt,
    collaborators,
    previewMode,
    setPreviewMode,
    ticketingEnabled,
  } = useEventEditor();

  const router = useRouter();
  const pathname = usePathname();

  const [settingsOpen, setSettingsOpen] = useState(false);

  const collaboratorCount = collaborators.size;

  return (
    <>
      <div
        className={cn(
          "fixed w-full top-0 z-40 border-b transition-all shadow-lg",
          isDark
            ? "border-neutral-700/60 bg-neutral-900/60 text-neutral-100 backdrop-blur-xl"
            : "bg-background/95 backdrop-blur",
          toolbarCollapsed && "border-b-0! shadow-none!",
        )}
      >
        <div
          className={cn(
            "mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 sm:px-6 transition-all overflow-hidden",
            toolbarCollapsed ? "h-0" : "h-14",
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 shrink-0"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              {isAutoSaving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving…
                </>
              ) : (
                lastSavedAt && <LastSavedLabel date={lastSavedAt} />
              )}
            </span>

            {collaboratorCount > 0 && (
              <span className="text-xs text-muted-foreground hidden sm:inline-block">
                {collaboratorCount} editing
              </span>
            )}

            <Separator orientation="vertical" className="h-4! bg-border/80" />

            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => setPreviewMode((p) => !p)}
            >
              {previewMode ? (
                <>
                  <Pencil className="size-3.5!" />
                </>
              ) : (
                <>
                  <Eye className="size-3.5!" />
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="size-3.5!" />
            </Button>

            <NavUserMenu />
          </div>
        </div>

        {/* Collapse / expand toggle */}
        <button
          type="button"
          onClick={() => setToolbarCollapsed((c) => !c)}
          className={cn(
            "absolute -bottom-6 right-4 z-50 flex h-6 w-8 items-center justify-center rounded-b-md border border-t-0 shadow-sm transition-colors",
            isDark
              ? "border-neutral-700/60 bg-neutral-900/80 text-neutral-300 hover:text-neutral-100"
              : "border-border/60 bg-background/95 text-muted-foreground hover:text-foreground",
          )}
        >
          {toolbarCollapsed ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Editor Page Tabs (poking out, centered) */}
        {eventId && (
          <div
            className={cn(
              "absolute -bottom-9.25 left-1/2 -translate-x-1/2 flex items-center p-1 rounded-b-xl border border-t-0 shadow-sm transition-all",
              isDark
                ? "border-neutral-700/60 bg-neutral-900"
                : "border-border/60 bg-background",
            )}
          >
            <div className="flex items-center gap-1">
              <Button
                variant={
                  !pathname?.includes("/checkout") ? "secondary" : "ghost"
                }
                size="sm"
                className="h-7 text-xs px-3"
                onClick={async () => {
                  if (pathname?.includes("/checkout")) {
                    await flush();
                    router.replace(`/events/${eventId}/edit`);
                  }
                }}
              >
                Event Page
              </Button>
              <Button
                variant={
                  pathname?.includes("/checkout") ? "secondary" : "ghost"
                }
                size="sm"
                className={cn(
                  "h-7 text-xs px-3",
                  !ticketingEnabled && "opacity-50",
                )}
                onClick={async () => {
                  if (!pathname?.includes("/checkout")) {
                    await flush();
                    router.replace(`/events/${eventId}/checkout/edit`);
                  }
                }}
              >
                Checkout Page
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="h-14" />

      <SettingsModal
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
      />
    </>
  );
}
