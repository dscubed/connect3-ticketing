"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useIntersection } from "@/lib/hooks/useIntersection";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreateEventModal } from "@/components/events/CreateEventModal";
import Image from "next/image";
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
  Plus,
  Ticket,
  Loader2,
  MapPin,
  Globe,
  Pencil,
  Mail,
  CheckCircle2,
  XCircle,
  Trash2,
} from "lucide-react";

interface Event {
  id: string;
  name: string | null;
  description: string | null;
  start: string | null;
  end: string | null;
  thumbnail: string | null;
  is_online: boolean;
  capacity: number | null;
  category: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  creator_profile_id: string;
}

interface InviteEvent {
  id: string;
  name: string | null;
  thumbnail: string | null;
  start: string | null;
  end: string | null;
  is_online: boolean;
  category: string | null;
  status: string;
}

interface InviterProfile {
  id: string;
  first_name: string;
  avatar_url: string | null;
}

interface Invite {
  id: string;
  event_id: string;
  inviter_id: string;
  status: string;
  sort_order: number;
  events: InviteEvent | null;
  inviter: InviterProfile | null;
}

type DashboardTab = "all" | "published" | "draft" | "invites";

const PAGE_SIZE = 20;

export function OrgDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const [tab, setTab] = useState<DashboardTab>("all");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  /* ── Invites state ── */
  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

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

  /* ── Fetch a page of events ── */
  const fetchPage = useCallback(
    async (cursor: string | null, replace: boolean) => {
      if (!user) return;
      if (replace) setLoading(true);
      else setLoadingMore(true);

      try {
        const params = new URLSearchParams({
          creator_id: user.id,
          limit: String(PAGE_SIZE),
        });
        if (tab !== "all" && tab !== "invites") params.set("status", tab);
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/events?${params}`);
        if (!res.ok) throw new Error("Failed to fetch events");

        const json = await res.json();
        const items: Event[] = json.data ?? [];
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
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, tab],
  );

  /* ── Fetch invites ── */
  const fetchInvites = useCallback(async () => {
    if (!user) return;
    setInvitesLoading(true);
    try {
      const res = await fetch("/api/invites?status=pending");
      if (res.ok) {
        const { data } = await res.json();
        setInvites(data ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch invites:", err);
    } finally {
      setInvitesLoading(false);
    }
  }, [user]);

  /* Initial fetch + refetch when tab changes */
  useEffect(() => {
    if (tab === "invites") {
      fetchInvites();
    } else {
      cursorRef.current = null;
      fetchPage(null, true);
    }
  }, [tab, fetchPage, fetchInvites]);

  /* Infinite scroll — load next page when sentinel is visible */
  useEffect(() => {
    if (
      tab !== "invites" &&
      isIntersecting &&
      hasMore &&
      !loadingMore &&
      !loading
    ) {
      fetchPage(cursorRef.current, false);
    }
  }, [tab, isIntersecting, hasMore, loadingMore, loading, fetchPage]);

  /* ── Respond to invite ── */
  const handleInviteResponse = async (
    inviteId: string,
    action: "accept" | "decline",
  ) => {
    setRespondingTo(inviteId);
    try {
      const res = await fetch(`/api/invites/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toast.success(
          action === "accept"
            ? "Invite accepted! The event now appears in your events."
            : "Invite declined.",
        );
        // Remove from the list
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to respond to invite");
      }
    } catch (err) {
      console.error("Failed to respond to invite:", err);
      toast.error("Failed to respond to invite");
    } finally {
      setRespondingTo(null);
    }
  };

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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "TBA";
    return new Date(dateStr).toLocaleDateString("en-AU", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const emptyLabel = useMemo(() => {
    if (tab === "published") return "No published events yet";
    if (tab === "draft") return "No drafts yet";
    if (tab === "invites") return "No pending invites";
    return "No events yet";
  }, [tab]);

  const pendingCount = invites.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Events</h1>
          <p className="text-muted-foreground">
            Manage your events and set up ticketing forms.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Event
        </Button>
      </div>

      <CreateEventModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as DashboardTab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="invites" className="gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Invites
            {pendingCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-5 min-w-5 px-1.5 text-[10px]"
              >
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Invites tab content */}
      {tab === "invites" ? (
        invitesLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : invites.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <Mail className="h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="font-medium">No pending invites</p>
                <p className="text-sm text-muted-foreground">
                  When someone invites you to collaborate on an event, it will
                  appear here.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {invites.map((invite) => {
              const event = invite.events;
              if (!event) return null;
              const isResponding = respondingTo === invite.id;

              return (
                <Card key={invite.id} className="overflow-hidden">
                  {event.thumbnail && (
                    <div className="aspect-video w-full overflow-hidden">
                      <Image
                        src={event.thumbnail}
                        alt={event.name ?? "Event"}
                        width={400}
                        height={225}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-tight">
                        {event.name || "Untitled Event"}
                      </CardTitle>
                      {event.category && (
                        <Badge variant="secondary" className="text-[11px]">
                          {event.category}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="flex items-center gap-1 text-xs">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(event.start)}
                      {event.is_online ? (
                        <span className="ml-2 flex items-center gap-1">
                          <Globe className="h-3 w-3" /> Online
                        </span>
                      ) : (
                        <span className="ml-2 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> In-person
                        </span>
                      )}
                    </CardDescription>
                    {/* Inviter info */}
                    {invite.inviter && (
                      <div className="flex items-center gap-2 pt-1">
                        <Avatar className="h-5 w-5">
                          {invite.inviter.avatar_url && (
                            <AvatarImage
                              src={invite.inviter.avatar_url}
                              alt={invite.inviter.first_name}
                            />
                          )}
                          <AvatarFallback className="text-[9px]">
                            {invite.inviter.first_name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">
                          Invited by{" "}
                          <span className="font-medium text-foreground">
                            {invite.inviter.first_name}
                          </span>
                        </span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() =>
                          handleInviteResponse(invite.id, "accept")
                        }
                        disabled={isResponding}
                      >
                        {isResponding ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() =>
                          handleInviteResponse(invite.id, "decline")
                        }
                        disabled={isResponding}
                      >
                        <XCircle className="h-4 w-4" />
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        /* Events grid (All / Published / Drafts) */
        <>
          {loading ? (
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
                  <Card key={event.id} className="overflow-hidden">
                    {event.thumbnail && (
                      <div className="aspect-video w-full overflow-hidden">
                        <Image
                          src={event.thumbnail}
                          alt={event.name ?? "Event"}
                          width={400}
                          height={225}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-tight">
                          {event.name || "Untitled Event"}
                        </CardTitle>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {event.status === "draft" && (
                            <Badge variant="outline" className="text-[11px]">
                              Draft
                            </Badge>
                          )}
                          {event.status === "published" && (
                            <Badge variant="default" className="text-[11px]">
                              Published
                            </Badge>
                          )}
                          {event.category && (
                            <Badge variant="secondary" className="text-[11px]">
                              {event.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardDescription className="flex items-center gap-1 text-xs">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(event.start)}
                        {event.is_online ? (
                          <span className="ml-2 flex items-center gap-1">
                            <Globe className="h-3 w-3" /> Online
                          </span>
                        ) : (
                          <span className="ml-2 flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> In-person
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() =>
                            router.push(`/events/${event.id}/edit`)
                          }
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
                        {user && event.creator_profile_id === user.id && (
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
                    </CardContent>
                  </Card>
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
