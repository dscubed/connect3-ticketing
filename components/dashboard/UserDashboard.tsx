"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationsFeed } from "@/components/dashboard/NotificationsFeed";
import { ClubSelector } from "@/components/dashboard/ClubSelector";
import { ClubEventsSection } from "@/components/dashboard/ClubEventsSection";
import { Separator } from "@/components/ui/separator";
import {
  Ticket,
  CalendarDays,
  ShoppingBag,
  Loader2,
  Building2,
} from "lucide-react";

/* ── Types ── */

interface ClubProfile {
  id: string;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
}

interface ClubAdminRow {
  id: string;
  club_id: string;
  role: string;
  status: string;
  created_at: string;
  club: ClubProfile | null;
  events?: unknown[];
}

export function UserDashboard() {
  const { user } = useAuthStore();

  /* ── Clubs state ── */
  const [clubs, setClubs] = useState<ClubAdminRow[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const hasFetchedClubs = useRef(false);

  /* ── Fetch clubs (SWR: only spinner on first load, silent revalidate) ── */
  const fetchClubs = useCallback(async () => {
    if (!user) return;
    if (!hasFetchedClubs.current) setClubsLoading(true);
    try {
      const res = await fetch("/api/clubs/my-clubs");
      if (res.ok) {
        const { data } = await res.json();
        const rows: ClubAdminRow[] = data ?? [];
        setClubs(rows);
        // Auto‑select first club if none selected
        if (rows.length > 0 && !selectedClubId) {
          setSelectedClubId(rows[0].club_id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch clubs:", err);
    } finally {
      hasFetchedClubs.current = true;
      setClubsLoading(false);
    }
  }, [user, selectedClubId]);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  /* Re-fetch silently on window focus */
  useEffect(() => {
    const onFocus = () => fetchClubs();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchClubs]);

  const selectedClub = clubs.find((c) => c.club_id === selectedClubId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          View your tickets, orders, and manage club events.
        </p>
      </div>

      {/* Notifications (collab + club admin invites) */}
      <NotificationsFeed mode="user" />

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">My Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Active tickets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Upcoming Events
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Events you&apos;re attending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Total orders placed</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Clubs I Admin ── */}
      {clubsLoading && !hasFetchedClubs.current ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : clubs.length > 0 ? (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Clubs I Admin</h2>
              </div>
              <ClubSelector
                clubs={clubs}
                selectedClubId={selectedClubId}
                onSelect={setSelectedClubId}
              />
            </div>

            {selectedClub && selectedClub.club && (
              <ClubEventsSection
                clubId={selectedClub.club_id}
                clubName={selectedClub.club.first_name}
              />
            )}
          </div>
        </>
      ) : null}

      <Separator />

      {/* Upcoming events */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Upcoming Events</h2>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-medium">No upcoming events</p>
              <p className="text-sm text-muted-foreground">
                When you purchase tickets, your events will show up here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Recent Orders</h2>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-medium">No orders yet</p>
              <p className="text-sm text-muted-foreground">
                Your ticket purchases will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
