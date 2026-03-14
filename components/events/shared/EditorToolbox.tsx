"use client";

import { useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Palette,
  Pencil,
  Settings,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { cn } from "@/lib/utils";

interface EditorToolboxProps {
  eventId?: string;
  mode: "create" | "edit" | "preview";
  isDark: boolean;

  toolbarCollapsed: boolean;
  setToolbarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;

  onBack: () => void;
  onFlush?: () => Promise<void>;

  isAutoSaving?: boolean;
  lastSavedAt?: Date | null;
  LastSavedLabelComponent?: React.ReactNode;
  collaboratorCount?: number;

  setThemeOpen?: (open: boolean) => void;
  previewMode: boolean;
  setPreviewMode: React.Dispatch<React.SetStateAction<boolean>>;

  eventStatus?: "draft" | "published" | "archived";
  hasName?: boolean;
  savingPublish?: boolean;
  onPublish?: () => void;
  onUnpublish?: () => void;

  initialUrlSlug?: string | null;

  ticketingEnabled?: boolean;
  ticketingChanging?: boolean;
  onEnableTicketing?: () => void;
  onDisableTicketing?: () => void;
}

export function EditorToolbox({
  eventId,
  mode,
  isDark,
  toolbarCollapsed,
  setToolbarCollapsed,
  onBack,
  onFlush,
  isAutoSaving,
  lastSavedAt,
  LastSavedLabelComponent,
  collaboratorCount = 0,
  setThemeOpen,
  previewMode,
  setPreviewMode,
  eventStatus,
  hasName,
  savingPublish,
  onPublish,
  onUnpublish,
  initialUrlSlug,
  ticketingEnabled,
  ticketingChanging,
  onEnableTicketing,
  onDisableTicketing,
}: EditorToolboxProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [settingsOpen, setSettingsOpen] = useState(false);

  const [statusAlertOpen, setStatusAlertOpen] = useState(false);
  const [pendingStatusAction, setPendingStatusAction] = useState<
    "publish" | "unpublish"
  >("publish");

  const [ticketingAlertOpen, setTicketingAlertOpen] = useState(false);
  const [pendingTicketingAction, setPendingTicketingAction] = useState<
    "enable" | "disable"
  >("enable");

  // Slug State
  const [urlSlug, setUrlSlug] = useState(initialUrlSlug || "");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [savingSlug, setSavingSlug] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Validate and format slug as user types
  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Map spaces to _, lower case, restrict to letters, numbers, dash, underscore
    const rawValue = e.target.value;
    const formatted = rawValue
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "");

    setUrlSlug(formatted);

    // Initial resets
    if (formatted === initialUrlSlug) {
      setSlugStatus("idle");
      if (typingTimer.current) clearTimeout(typingTimer.current);
      return;
    }

    if (!formatted) {
      setSlugStatus("idle");
      if (typingTimer.current) clearTimeout(typingTimer.current);
      return;
    }

    setSlugStatus("checking");

    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }

    typingTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/slug?slug=${encodeURIComponent(formatted)}`);
        if (!res.ok) throw new Error("Failed to check");
        const json = await res.json();
        
        if (json.available) {
          setSlugStatus("available");
        } else {
          setSlugStatus("taken");
        }
      } catch (err) {
        console.error("Failed to check slug availability", err);
        setSlugStatus("idle");
      }
    }, 500);
  };

  const handleSaveSlug = async () => {
    if (!eventId || !urlSlug) return;
    setSavingSlug(true);
    try {
      const res = await fetch(`/api/events/${eventId}/slug`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: urlSlug }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save URL slug");
      }
      toast.success("Event Page URL updated!");
      setSlugStatus("idle");
      // Optional: trigger onFlush to keep UI synced, but since eventId is standard, it's fine.
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to save URL slug");
    } finally {
      setSavingSlug(false);
    }
  };

  const handleStatusToggle = (checked: boolean) => {
    setPendingStatusAction(checked ? "publish" : "unpublish");
    setStatusAlertOpen(true);
  };

  const handleTicketingToggle = (checked: boolean) => {
    setPendingTicketingAction(checked ? "enable" : "disable");
    setTicketingAlertOpen(true);
  };

  const confirmStatusAction = () => {
    if (pendingStatusAction === "publish" && onPublish) {
      onPublish();
    } else if (pendingStatusAction === "unpublish" && onUnpublish) {
      onUnpublish();
    }
    setStatusAlertOpen(false);
  };

  const confirmTicketingAction = () => {
    if (pendingTicketingAction === "enable" && onEnableTicketing) {
      onEnableTicketing();
    } else if (pendingTicketingAction === "disable" && onDisableTicketing) {
      onDisableTicketing();
    }
    setTicketingAlertOpen(false);
  };

  if (mode === "preview" && !onPublish) {
    return (
      <div className="mx-auto max-w-3xl px-3 pt-4 sm:px-6">
        <Button variant="ghost" size="sm" className="gap-2" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to Event
        </Button>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "sticky top-14 z-40 border-b transition-all shadow-lg",
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
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              {isAutoSaving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving…
                </>
              ) : (
                lastSavedAt &&
                LastSavedLabelComponent &&
                LastSavedLabelComponent
              )}
            </span>

            {collaboratorCount > 0 && (
              <span className="text-xs text-muted-foreground hidden sm:inline-block">
                {collaboratorCount} editing
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setPreviewMode((p) => !p)}
            >
              {previewMode ? (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Preview</span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
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
        {eventId && mode !== "create" && (
          <div
            className={cn(
              "absolute -bottom-9 left-1/2 -translate-x-1/2 flex items-center p-1 rounded-b-xl border border-t-0 shadow-sm transition-all",
              toolbarCollapsed
                ? "opacity-0 pointer-events-none translate-y-full"
                : "opacity-100",
              isDark
                ? "border-neutral-700/60 bg-neutral-900/80"
                : "border-border/60 bg-background/95",
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
                    if (onFlush) await onFlush();
                    router.push(`/events/${eventId}/edit`);
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
                    if (onFlush) await onFlush();
                    router.push(`/events/${eventId}/checkout/edit`);
                  }
                }}
              >
                Checkout Page
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal (Responsive) */}
      <ResponsiveModal
        title="Event Settings"
        description="Manage your event details and features."
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      >
        <div className="space-y-6 py-4">
          {setThemeOpen && (
            <>
              <div className="space-y-4">
                <h4 className="text-sm font-medium leading-none">Customise</h4>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Theme</Label>
                    <p className="text-[13px] text-muted-foreground">
                      Adjust colours and layout
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSettingsOpen(false);
                      setThemeOpen(true);
                    }}
                  >
                    <Palette className="h-4 w-4 mr-2" /> Theme
                  </Button>
                </div>
              
                  <div className="space-y-2 mt-4">
                    <Label htmlFor="url-slug">Event Page URL</Label>
                    <p className="text-[13px] text-muted-foreground">
                      Customise the link to your event page.
                    </p>
                    <div className="flex w-full space-x-2 items-center">
                      <div className="flex items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors w-[100%]">
                        <span className="text-muted-foreground mr-1">tix.connect3.app/event/</span>
                        <input
                          id="url-slug"
                          type="text"
                          placeholder={eventId || "my-awesome-event"}
                          value={urlSlug}
                          onChange={handleSlugChange}
                          className="flex-1 bg-transparent py-1 shadow-none outline-none focus:outline-none focus:ring-0 min-w-[50px]"
                        />
                        <div className="w-4 h-4 ml-2 flex-shrink-0 flex items-center justify-center">
                          {slugStatus === "checking" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                          {slugStatus === "available" && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {slugStatus === "taken" && <XCircle className="h-4 w-4 text-red-500" />}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleSaveSlug}
                        disabled={savingSlug || slugStatus === "taken" || slugStatus === "idle" || slugStatus === "checking"}
                      >
                        {savingSlug ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                  </div>
</div>
              <Separator />
            </>
          )}

          <div className="space-y-4">
            <h4 className="text-sm font-medium leading-none text-red-500">
              Danger Zone
            </h4>

            {eventStatus && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Event Status</Label>
                  <p className="text-[13px] text-muted-foreground">
                    {eventStatus === "published"
                      ? "Currently published"
                      : "Currently private draft"}
                  </p>
                </div>
                <Switch
                  checked={eventStatus === "published"}
                  onCheckedChange={handleStatusToggle}
                  disabled={savingPublish || !hasName || !eventId}
                />
              </div>
            )}

            {eventId && ticketingEnabled !== undefined && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Ticketing</Label>
                  <p className="text-[13px] text-muted-foreground">
                    {ticketingEnabled
                      ? "Currently enabled"
                      : "Currently disabled"}
                  </p>
                </div>
                <Switch
                  checked={ticketingEnabled}
                  onCheckedChange={handleTicketingToggle}
                  disabled={ticketingChanging}
                />
              </div>
            )}
          </div>
        </div>
      </ResponsiveModal>

      {/* Status Toggle Alert Dialog */}
      <AlertDialog open={statusAlertOpen} onOpenChange={setStatusAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatusAction === "publish"
                ? "Publishing this event will make it visible to the public."
                : "Unpublishing this event will move it back to drafts and hide it from the public."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingPublish}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant={
                pendingStatusAction === "publish" ? "default" : "destructive"
              }
              onClick={confirmStatusAction}
              disabled={savingPublish}
            >
              {savingPublish && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {pendingStatusAction === "publish"
                ? "Publish Event"
                : "Unpublish Event"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ticketing Toggle Alert Dialog */}
      <AlertDialog
        open={ticketingAlertOpen}
        onOpenChange={setTicketingAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingTicketingAction === "enable"
                ? "Enabling ticketing will allow you to start selling tickets for this event."
                : "Disabling ticketing will prevent any further ticket sales. This action will not refund or cancel existing orders."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ticketingChanging}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant={
                pendingTicketingAction === "enable" ? "default" : "destructive"
              }
              onClick={confirmTicketingAction}
              disabled={ticketingChanging}
            >
              {ticketingChanging && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {pendingTicketingAction === "enable"
                ? "Enable Ticketing"
                : "Disable Ticketing"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}



