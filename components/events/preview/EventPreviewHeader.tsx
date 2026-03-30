"use client";

import { useSyncExternalStore } from "react";
import { ArrowLeft, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NavUserMenu } from "@/components/auth/NavUserMenu";
import { useRouter } from "next/navigation";

interface EventPreviewHeaderProps {
  isDark: boolean;
}

// useSyncExternalStore: server snapshot = false, client snapshot = real iframe check.
// No setState, no effect, no hydration mismatch.
const noopSubscribe = () => () => {};
const getIframeSnapshot = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};
const getServerSnapshot = () => false;

/**
 * Transparent header shown on visitor preview pages.
 * - In iframe: Maximize (navigates top window in-place) + X (postMessage close)
 * - Standalone: Back button + NavUserMenu
 */
export function EventPreviewHeader({ isDark }: EventPreviewHeaderProps) {
  const inIframe = useSyncExternalStore(
    noopSubscribe,
    getIframeSnapshot,
    getServerSnapshot,
  );

  const router = useRouter();

  const handleMaximize = () => {
    // Navigate the top-level browser window to the ticketing page (same tab)
    if (window.top) window.top.location.href = window.location.href;
  };

  const handleClose = () => {
    window.parent.postMessage({ type: "CONNECT3_CLOSE_PANEL" }, "*");
  };

  const iconBtnClass = cn(
    "h-8 w-8 rounded-full",
    isDark
      ? "text-white/70 hover:bg-white/10 hover:text-white"
      : "text-black/50 hover:bg-black/10 hover:text-black",
  );

  return (
    <div className="w-full">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-3 py-3 sm:px-6">
        <div className="flex items-center gap-1">
          {inIframe ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={iconBtnClass}
                onClick={handleMaximize}
                title="Open full page"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={iconBtnClass}
                onClick={handleClose}
                title="Close panel"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              className={cn(
                "gap-2 rounded-full",
                isDark
                  ? "text-white/70 hover:bg-white/10 hover:text-white"
                  : "text-black/50 hover:bg-black/10 hover:text-black",
              )}
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
          )}
        </div>

        <NavUserMenu />
      </div>
    </div>
  );
}
