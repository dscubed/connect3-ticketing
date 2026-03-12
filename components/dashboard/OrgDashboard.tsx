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
import {
  ArrowRight,
  CalendarDays,
  Loader2,
  Plus,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { EventDisplayCard } from "./EventDisplayCard";
import type { EventCardDetails } from "@/lib/types/events";

/* ── Types ── */

interface AdminRow {
  id: string;
  user_id?: string;
  role: string;
  status: string;
  created_at: string;
  profiles: {
    id: string;
    first_name: string;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

const ADMIN_PREVIEW = 3;
const EVENT_PREVIEW = 3;

/* ─────────────────────────────────────────────────────────────────────────────
 * OrgDashboardContent — the reusable dashboard body.
 * Receives a clubId and renders admins, events, notifications.
 * Used by both OrgDashboard (org accounts) and the manage page (club admins).
 * ────────────────────────────────────────────────────────────────────────── */

export interface OrgDashboardContentProps {
  /** The club / org profile ID to display data for */
  clubId: string;
  /** Notification feed mode */
  notificationMode?: "org" | "user";
  /** "View all" events link — defaults to /dashboard/events */
  eventsHref?: string;
  /** "Manage" club link — defaults to /dashboard/club */
  clubHref?: string;
}

export function OrgDashboardContent({
  clubId,
  notificationMode = "org",
  eventsHref = "/dashboard/events",
  clubHref = "/dashboard/club",
}: OrgDashboardContentProps) {
  const router = useRouter();

  /* ── Admins state ── */
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminCount, setAdminCount] = useState(0);
  const hasFetchedAdmins = useRef(false);

  /* ── Events state ── */
  const [events, setEvents] = useState<EventCardDetails[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const hasFetchedEvents = useRef(false);

  /* ── Fetch admins ── */
  const fetchAdmins = useCallback(async () => {
    if (!hasFetchedAdmins.current) setAdminsLoading(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/admins`);
      if (res.ok) {
        const { data } = await res.json();
        const active = (data ?? []).filter(
          (a: AdminRow) => a.status === "accepted" || a.status === "pending",
        );
        setAdminCount(active.length);
        setAdmins(active.slice(0, ADMIN_PREVIEW));
      }
    } catch (err) {
      console.error("Failed to fetch admins:", err);
    } finally {
      hasFetchedAdmins.current = true;
      setAdminsLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    hasFetchedAdmins.current = false;
    fetchAdmins();
  }, [fetchAdmins]);

  /* ── Fetch events ── */
  const fetchEvents = useCallback(async () => {
    if (!hasFetchedEvents.current) setEventsLoading(true);
    try {
      /* Try recent edits first */
      const recentParams = new URLSearchParams({
        recent: "true",
        limit: String(EVENT_PREVIEW),
      });
      const recentRes = await fetch(`/api/events?${recentParams}`);
      if (recentRes.ok) {
        const { data } = await recentRes.json();
        if ((data ?? []).length > 0) {
          setEvents(data);
          return;
        }
      }

      /* Fallback: by club_id */
      const params = new URLSearchParams({
        club_id: clubId,
        limit: String(EVENT_PREVIEW),
      });
      const res = await fetch(`/api/events?${params}`);
      if (res.ok) {
        const { data } = await res.json();
        setEvents(data ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      hasFetchedEvents.current = true;
      setEventsLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    hasFetchedEvents.current = false;
    fetchEvents();
  }, [fetchEvents]);

  /* Re-fetch silently on window focus */
  useEffect(() => {
    const onFocus = () => {
      fetchAdmins();
      fetchEvents();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchAdmins, fetchEvents]);

  return (
    <>
      {/* ── Notifications ── */}
      <NotificationsFeed mode={notificationMode} />

      {/* ── Club Admins ── */}
      <Separator />
      <div className="space-y-3">
        {adminsLoading && !hasFetchedAdmins.current ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Left: admin list */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
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
                    onClick={() => router.push(clubHref)}
                  >
                    View more
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                {admins.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No admins yet —{" "}
                    <button
                      className="underline hover:text-foreground"
                      onClick={() => router.push(clubHref)}
                    >
                      invite some
                    </button>
                  </p>
                ) : (
                  admins.map((admin) => {
                    const p = admin.profiles;
                    return (
                      <div key={admin.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          {p?.avatar_url && (
                            <AvatarImage
                              src={p.avatar_url}
                              alt={p.first_name}
                            />
                          )}
                          <AvatarFallback className="text-[10px]">
                            {p?.first_name?.charAt(0).toUpperCase() ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-sm font-medium">
                          {p?.first_name ?? "Unknown"}
                          {p?.last_name ? ` ${p.last_name}` : ""}
                        </span>
                      </div>
                    );
                  })
                )}
                {adminCount > ADMIN_PREVIEW && (
                  <p className="text-xs text-muted-foreground">
                    +{adminCount - ADMIN_PREVIEW} more
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Right: stats */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Club Admins
                    </span>
                  </div>
                  <span className="text-sm font-semibold">{adminCount}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Club Members
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    Coming Soon
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Members Updated
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">Never</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ── Events ── */}
      <Separator />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Recent Events</h2>
          </div>
          {events.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              onClick={() => router.push(eventsHref)}
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {eventsLoading && !hasFetchedEvents.current ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium">No events yet</p>
                <p className="text-xs text-muted-foreground">
                  Create an event to get started.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {events.map((event) => (
              <EventDisplayCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * OrgDashboard — wrapper used on the home page for org accounts.
 * Provides its own header + Create Event button, then renders Content.
 * ────────────────────────────────────────────────────────────────────────── */

export function OrgDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  if (!user) return null;

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => router.push("/dashboard/club")}
          >
            <Settings className="h-3.5 w-3.5" />
            Manage
          </Button>
          <Button className="gap-2" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Event
          </Button>
        </div>
      </div>

      <CreateEventModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      <OrgDashboardContent
        clubId={user.id}
        notificationMode="org"
        eventsHref="/dashboard/events"
        clubHref="/dashboard/club"
      />
    </div>
  );
}
