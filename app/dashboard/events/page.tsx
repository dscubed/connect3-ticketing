"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useIntersection } from "@/lib/hooks/useIntersection";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ArrowLeft,
  Building2,
  CalendarDays,
  Loader2,
  Pencil,
  Plus,
  Ticket,
  Trash2,
} from "lucide-react";
import { EventDisplayCard } from "@/components/dashboard/EventDisplayCard";
import type { EventCardDetails } from "@/lib/types/events";

interface ClubOption {
  club_id: string;
  club_name: string;
  avatar_url: string | null;
}

type EventTab = "all" | "published" | "draft";

const PAGE_SIZE = 20;

export default function DashboardEventsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialClubId = searchParams.get("club_id");
  const { user, loading: authLoading, isOrganisation } = useAuthStore();
  const [events, setEvents] = useState<EventCardDetails[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const hasFetchedOnce = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const [tab, setTab] = useState<EventTab>("all");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  /* ── Club selector state (for non-org users who admin clubs) ── */
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [activeClubId, setActiveClubId] = useState<string | null>(
    initialClubId,
  );
  const hasFetchedClubs = useRef(false);

  /* For org accounts, the club ID is always their own user ID */
  const effectiveClubId = isOrganisation() ? (user?.id ?? null) : activeClubId;

  /* Fetch admin clubs for non-org users */
  useEffect(() => {
    if (!user || isOrganisation() || hasFetchedClubs.current) return;
    hasFetchedClubs.current = true;
    (async () => {
      try {
        const res = await fetch("/api/clubs/my-clubs");
        if (!res.ok) return;
        const { data } = await res.json();
        const options: ClubOption[] = (data ?? []).map(
          (r: {
            club_id: string;
            club: { first_name: string; avatar_url: string | null } | null;
          }) => ({
            club_id: r.club_id,
            club_name: r.club?.first_name ?? "Unknown Club",
            avatar_url: r.club?.avatar_url ?? null,
          }),
        );
        setClubs(options);

        /* Validate the URL club_id belongs to the user's clubs */
        if (initialClubId && options.some((o) => o.club_id === initialClubId)) {
          setActiveClubId(initialClubId);
        } else if (
          initialClubId &&
          !options.some((o) => o.club_id === initialClubId)
        ) {
          /* club_id doesn't belong to this user — redirect home */
          router.replace("/");
          return;
        } else if (options.length > 0 && !activeClubId) {
          setActiveClubId(options[0].club_id);
        }
      } catch {
        /* silent */
      }
    })();
  }, [user, isOrganisation, initialClubId, activeClubId, router]);

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

  /* ── Fetch a page of events (SWR: stale-while-revalidate) ── */
  const fetchPage = useCallback(
    async (cursor: string | null, replace: boolean) => {
      if (!user) return;

      /* Only show full-page spinner on the very first load */
      if (replace && !hasFetchedOnce.current) setInitialLoading(true);
      if (!replace) setLoadingMore(true);

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
        });
        /* Use club_id mode when viewing a club's events, otherwise creator_id */
        if (effectiveClubId) {
          params.set("club_id", effectiveClubId);
        } else {
          params.set("creator_id", user.id);
        }
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
        console.error("Failed to fetch events:", err);
      } finally {
        hasFetchedOnce.current = true;
        setInitialLoading(false);
        setLoadingMore(false);
      }
    },
    [user, tab, effectiveClubId],
  );

  /* Initial fetch + refetch when tab changes (stale shown immediately) */
  useEffect(() => {
    cursorRef.current = null;
    fetchPage(null, true);
  }, [tab, fetchPage]);

  /* Infinite scroll */
  useEffect(() => {
    if (isIntersecting && hasMore && !loadingMore && !initialLoading) {
      fetchPage(cursorRef.current, false);
    }
  }, [isIntersecting, hasMore, loadingMore, initialLoading, fetchPage]);

  /* Re-fetch silently on window focus */
  useEffect(() => {
    const onFocus = () => {
      cursorRef.current = null;
      fetchPage(null, true);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchPage]);

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
    } catch (err) {
      console.error("Failed to delete event:", err);
      toast.error("Failed to delete event");
    } finally {
      setDeleting(false);
      setDeleteConfirm({ open: false, eventId: "", eventName: "" });
    }
  };

  const emptyLabel = useMemo(() => {
    if (tab === "published") return "No published events yet";
    if (tab === "draft") return "No drafts yet";
    return "No events yet";
  }, [tab]);

  /* Redirect unauthenticated users */
  if (!authLoading && !user) {
    router.replace("/");
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">All Events</h1>
            <p className="text-muted-foreground text-sm">
              View and manage all your events.
            </p>
          </div>
        </div>
        <Button className="gap-2" onClick={() => setCreateModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Event
        </Button>
      </div>

      <CreateEventModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        {...(effectiveClubId ? { clubId: effectiveClubId } : {})}
      />

      {/* Club selector (non-org users who admin multiple clubs) */}
      {!isOrganisation() && clubs.length > 0 && (
        <div className="flex items-center gap-3">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <Select
            value={activeClubId ?? undefined}
            onValueChange={(val) => {
              setActiveClubId(val);
              /* Reset list when switching clubs */
              hasFetchedOnce.current = false;
              cursorRef.current = null;
              setEvents([]);
            }}
          >
            <SelectTrigger className="w-70">
              <SelectValue placeholder="Select a club" />
            </SelectTrigger>
            <SelectContent>
              {clubs.map((club) => (
                <SelectItem key={club.club_id} value={club.club_id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      {club.avatar_url && (
                        <AvatarImage
                          src={club.avatar_url}
                          alt={club.club_name}
                        />
                      )}
                      <AvatarFallback className="text-[8px]">
                        {club.club_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{club.club_name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as EventTab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Events grid */}
      {initialLoading && !hasFetchedOnce.current ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-medium">{emptyLabel}</p>
              <p className="text-sm text-muted-foreground">
                Create an event to get started.
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
                    {user && event.host.id === user.id && (
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
                    )}
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
