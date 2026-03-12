"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreateEventModal } from "@/components/events/CreateEventModal";
import { NotificationsFeed } from "@/components/dashboard/NotificationsFeed";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, CalendarDays, Loader2, Plus, Users } from "lucide-react";
import { EventDisplayCard } from "./EventDisplayCard";
import type { EventCardDetails } from "@/lib/types/events";

interface AdminPreview {
  id: string;
  status: string;
  profiles: {
    id: string;
    first_name: string;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

const PREVIEW_COUNT = 3;
const ADMIN_PREVIEW_COUNT = 5;

export function OrgDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [events, setEvents] = useState<EventCardDetails[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const hasFetchedOnce = useRef(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  /* ── Admin preview state ── */
  const [adminPreviews, setAdminPreviews] = useState<AdminPreview[]>([]);
  const [adminCount, setAdminCount] = useState(0);
  const hasFetchedAdmins = useRef(false);

  /* ── Fetch first few events (SWR: show stale, revalidate silently) ── */
  const fetchPreview = useCallback(async () => {
    if (!user) return;

    /* Only show spinner on very first load */
    if (!hasFetchedOnce.current) setInitialLoading(true);

    try {
      // Try recent events first (sorted by last edit)
      const recentParams = new URLSearchParams({
        recent: "true",
        limit: String(PREVIEW_COUNT),
      });
      const recentRes = await fetch(`/api/events?${recentParams}`);
      if (recentRes.ok) {
        const { data } = await recentRes.json();
        if ((data ?? []).length > 0) {
          setEvents(data);
          return;
        }
      }

      // Fallback: fetch latest by created_at
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

  /* ── Fetch admin preview ── */
  const fetchAdminPreview = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/clubs/${user.id}/admins`);
      if (!res.ok) return;
      const { data } = await res.json();
      const active = (data ?? []).filter(
        (a: AdminPreview) => a.status === "accepted" || a.status === "pending",
      );
      setAdminCount(active.length);
      setAdminPreviews(active.slice(0, ADMIN_PREVIEW_COUNT));
    } catch {
      /* silent */
    } finally {
      hasFetchedAdmins.current = true;
    }
  }, [user]);

  useEffect(() => {
    fetchAdminPreview();
  }, [fetchAdminPreview]);

  /* Re-fetch silently when window regains focus */
  useEffect(() => {
    const onFocus = () => {
      fetchPreview();
      fetchAdminPreview();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchPreview, fetchAdminPreview]);

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

      {/* Club admins preview */}
      {user && (
        <>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Club Admins</h2>
              {adminCount > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {adminCount}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              onClick={() => router.push("/dashboard/club")}
            >
              View more
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {hasFetchedAdmins.current && adminPreviews.length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {adminPreviews.map((admin) => {
                  const p = admin.profiles;
                  return (
                    <Avatar
                      key={admin.id}
                      className="h-8 w-8 border-2 border-background"
                    >
                      {p?.avatar_url && (
                        <AvatarImage src={p.avatar_url} alt={p.first_name} />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {p?.first_name?.charAt(0).toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                  );
                })}
              </div>
              {adminCount > ADMIN_PREVIEW_COUNT && (
                <span className="text-xs text-muted-foreground">
                  +{adminCount - ADMIN_PREVIEW_COUNT} more
                </span>
              )}
            </div>
          ) : hasFetchedAdmins.current ? (
            <p className="text-xs text-muted-foreground">
              No admins yet —{" "}
              <button
                className="underline hover:text-foreground"
                onClick={() => router.push("/dashboard/club")}
              >
                invite some
              </button>
            </p>
          ) : null}
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
            <EventDisplayCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
