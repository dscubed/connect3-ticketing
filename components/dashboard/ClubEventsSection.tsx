"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useIntersection } from "@/lib/hooks/useIntersection";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateEventModal } from "@/components/events/CreateEventModal";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CalendarDays,
  Loader2,
  Pencil,
  Plus,
  Ticket,
  Trash2,
} from "lucide-react";
import { EventDisplayCard } from "./EventDisplayCard";
import type { EventCardDetails } from "@/lib/types/events";

type EventTab = "all" | "published" | "draft";

const PAGE_SIZE = 20;

interface ClubEventsSectionProps {
  /** The club's profile ID — events will be fetched for this club */
  clubId: string;
  /** The club name for display */
  clubName: string;
}

export function ClubEventsSection({
  clubId,
  clubName,
}: ClubEventsSectionProps) {
  const router = useRouter();
  const [events, setEvents] = useState<EventCardDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const [tab, setTab] = useState<EventTab>("all");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  /* ── Delete state ── */
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    eventId: string;
    eventName: string;
  }>({ open: false, eventId: "", eventName: "" });
  const [deleting, setDeleting] = useState(false);

  const { ref: sentinelRef, isIntersecting } = useIntersection({
    rootMargin: "200px",
  });

  /* ── Fetch events for the club ── */
  const fetchPage = useCallback(
    async (cursor: string | null, replace: boolean) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);

      try {
        const params = new URLSearchParams({
          club_id: clubId,
          limit: String(PAGE_SIZE),
        });
        if (tab !== "all") params.set("status", tab);
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/events?${params}`);
        if (!res.ok) throw new Error("Failed to fetch events");

        const json = await res.json();
        const items: EventCardDetails[] = json.data ?? [];
        setHasMore(json.hasMore ?? false);
        cursorRef.current = json.nextCursor ?? null;

        if (replace) {
          setEvents(items);
        } else {
          setEvents((prev) => [...prev, ...items]);
        }
      } catch (err) {
        console.error("Failed to fetch club events:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [clubId, tab],
  );

  /* Refetch when tab or club changes */
  useEffect(() => {
    cursorRef.current = null;
    fetchPage(null, true);
  }, [fetchPage]);

  /* Infinite scroll */
  useEffect(() => {
    if (isIntersecting && hasMore && !loadingMore && !loading) {
      fetchPage(cursorRef.current, false);
    }
  }, [isIntersecting, hasMore, loadingMore, loading, fetchPage]);

  /* ── Delete event ── */
  const handleDeleteEvent = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${deleteConfirm.eventId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Event deleted");
        setEvents((prev) => prev.filter((e) => e.id !== deleteConfirm.eventId));
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete event");
      }
    } catch {
      toast.error("Failed to delete event");
    } finally {
      setDeleting(false);
      setDeleteConfirm({ open: false, eventId: "", eventName: "" });
    }
  };

  const emptyLabel = useMemo(() => {
    if (tab === "published") return "No published events";
    if (tab === "draft") return "No drafts";
    return "No events yet";
  }, [tab]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as EventTab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="draft">Drafts</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setCreateModalOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Create Event
        </Button>
      </div>

      <CreateEventModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        clubId={clubId}
      />

      {/* Events grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">{emptyLabel}</p>
              <p className="text-xs text-muted-foreground">
                Create an event for {clubName} to get started.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {events.map((event) => (
              <EventDisplayCard
                key={event.id}
                event={event}
                content={
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => router.push(`/events/${event.id}/edit`)}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      disabled
                    >
                      <Ticket className="h-4 w-4" />
                      Ticketing
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() =>
                        setDeleteConfirm({
                          open: true,
                          eventId: event.id,
                          eventName: event.name || "Untitled Event",
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                }
              />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="flex justify-center py-4">
            {loadingMore && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </div>
        </>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => {
          if (!open)
            setDeleteConfirm({ open: false, eventId: "", eventName: "" });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteConfirm.eventName}
              &rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
