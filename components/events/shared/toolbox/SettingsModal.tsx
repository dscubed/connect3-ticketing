import { useState, useRef } from "react";
import { useEventEditor } from "../EventEditorContext";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Palette, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AlertDialogFooter } from "@/components/ui/alert-dialog";
import { AlertDialogHeader } from "@/components/ui/alert-dialog";
import { AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertDialogDescription } from "@/components/ui/alert-dialog";
import { AlertDialogCancel } from "@/components/ui/alert-dialog";
import { AlertDialogContent } from "@/components/ui/alert-dialog";
import { AlertDialog } from "@/components/ui/alert-dialog";

export function SettingsModal({
  settingsOpen,
  setSettingsOpen,
}: {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}) {
  const {
    eventId,
    initialUrlSlug,
    setThemeOpen,
    eventStatus,
    hasName,
    ticketingEnabled,
    ticketingChanging,
    enableTicketing,
    disableTicketing,
    savingPublish,
    handlePublish,
    handleUnpublish,
  } = useEventEditor();

  // Slug State
  const [urlSlug, setUrlSlug] = useState(initialUrlSlug || "");
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [savingSlug, setSavingSlug] = useState(false);

  // Status Alert State
  const [statusAlertOpen, setStatusAlertOpen] = useState(false);
  const [pendingStatusAction, setPendingStatusAction] = useState<
    "publish" | "unpublish"
  >("publish");

  // Ticketing Alert State
  const [ticketingAlertOpen, setTicketingAlertOpen] = useState(false);
  const [pendingTicketingAction, setPendingTicketingAction] = useState<
    "enable" | "disable"
  >("enable");

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = e.target.value
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "");

    setUrlSlug(formatted);

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
    if (typingTimer.current) clearTimeout(typingTimer.current);

    typingTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/events/${eventId}/slug?slug=${encodeURIComponent(formatted)}`,
        );
        if (!res.ok) throw new Error("Failed to check");
        const json = await res.json();
        setSlugStatus(json.available ? "available" : "taken");
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
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to save URL slug",
      );
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
    if (pendingStatusAction === "publish") handlePublish();
    else handleUnpublish();
    setStatusAlertOpen(false);
  };

  const confirmTicketingAction = () => {
    if (pendingTicketingAction === "enable") enableTicketing();
    else disableTicketing();
    setTicketingAlertOpen(false);
  };

  return (
    <>
      <ResponsiveModal
        title="Event Settings"
        description="Manage your event details and features."
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      >
        <div className="space-y-6 py-4">
          <>
            <div className="space-y-4">
              <h4 className="text-base font-medium leading-none">Customise</h4>
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
                  <div className="flex items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors w-full">
                    <span className="text-muted-foreground mr-1">
                      tix.connect3.app/event/
                    </span>
                    <input
                      id="url-slug"
                      type="text"
                      placeholder={eventId || "my-awesome-event"}
                      value={urlSlug}
                      onChange={handleSlugChange}
                      className="flex-1 bg-transparent py-1 shadow-none outline-none focus:outline-none focus:ring-0 min-w-12.5"
                    />
                    <div className="w-4 h-4 ml-2 shrink-0 flex items-center justify-center">
                      {slugStatus === "checking" && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                      {slugStatus === "available" && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      {slugStatus === "taken" && (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleSaveSlug}
                    disabled={
                      savingSlug ||
                      slugStatus === "taken" ||
                      slugStatus === "idle" ||
                      slugStatus === "checking"
                    }
                  >
                    {savingSlug ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <Separator />
          </>

          <div className="space-y-4">
            <h4 className="text-md font-medium leading-none text-red-500">
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
