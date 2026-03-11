"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateEventModal } from "@/components/events/CreateEventModal";
import { NotificationsFeed } from "@/components/dashboard/NotificationsFeed";
import { AdminManagePanel } from "@/components/dashboard/AdminManagePanel";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import {
  ArrowRight,
  CalendarDays,
  Globe,
  Loader2,
  MapPin,
  Plus,
  Users,
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

const PREVIEW_COUNT = 3;

export function OrgDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const hasFetchedOnce = useRef(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  /* ── Fetch first few events (SWR: show stale, revalidate silently) ── */
  const fetchPreview = useCallback(async () => {
    if (!user) return;

    /* Only show spinner on very first load */
    if (!hasFetchedOnce.current) setInitialLoading(true);

    try {
      const params = new URLSearchParams({
        creator_id: user.id,
        limit: String(PREVIEW_COUNT),
      });
      const res = await fetch(`/api/events?${params}`);
      if (!res.ok) throw new Error("Failed to fetch events");
      const json = await res.json();
      setEvents(json.data ?? []);
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      hasFetchedOnce.current = true;
      setInitialLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  /* Re-fetch silently when window regains focus */
  useEffect(() => {
    const onFocus = () => fetchPreview();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchPreview]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "TBA";
    return new Date(dateStr).toLocaleDateString("en-AU", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Events</h1>
          <p className="text-muted-foreground">
            Manage your events, admins, and ticketing.
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

      {/* Notifications (collab invites) */}
      <NotificationsFeed mode="org" />

      {/* Manage admins — trigger + modal */}
      {user && (
        <>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Club Admins</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setAdminModalOpen(true)}
            >
              <Users className="h-3.5 w-3.5" />
              Manage
            </Button>
          </div>

          <ResponsiveModal
            open={adminModalOpen}
            onOpenChange={setAdminModalOpen}
            title="Manage Club Admins"
            description="Invite users as admins to help manage your club's events."
            className="sm:max-w-lg"
          >
            <AdminManagePanel clubId={user.id} />
          </ResponsiveModal>
        </>
      )}

      <Separator />

      {/* Events preview — first 3 cards */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Recent Events</h2>
        {events.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            onClick={() => router.push("/dashboard/events")}
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {initialLoading && !hasFetchedOnce.current ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-medium">No events yet</p>
              <p className="text-sm text-muted-foreground">
                Create an event to get started.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {events.slice(0, PREVIEW_COUNT).map((event) => (
            <Card
              key={event.id}
              className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
              onClick={() => router.push(`/events/${event.id}/edit`)}
            >
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
              <CardHeader className="p-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm leading-tight line-clamp-1">
                    {event.name || "Untitled Event"}
                  </CardTitle>
                  {event.status === "draft" && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      Draft
                    </Badge>
                  )}
                </div>
                <CardDescription className="flex items-center gap-1 text-[11px]">
                  <CalendarDays className="h-3 w-3" />
                  {formatDate(event.start)}
                  {event.is_online ? (
                    <span className="ml-1.5 flex items-center gap-0.5">
                      <Globe className="h-3 w-3" /> Online
                    </span>
                  ) : (
                    <span className="ml-1.5 flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" /> In-person
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
