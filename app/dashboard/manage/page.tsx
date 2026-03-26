"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useAdminClubSelector } from "@/lib/hooks/useAdminClubSelector";
import { AdminClubSelector } from "@/components/dashboard/AdminClubSelector";
import { OrgDashboardContent } from "@/components/dashboard/OrgDashboard";
import { CreateEventModal } from "@/components/events/CreateEventModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Loader2, Plus, Settings } from "lucide-react";

function ManageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialClubId = searchParams.get("club_id");
  const { user, loading: authLoading } = useAuthStore();

  /* Shared club selector hook */
  const {
    clubs,
    loading: clubsLoading,
    selectedClubId,
    setSelectedClubId,
  } = useAdminClubSelector(initialClubId);

  /* ── Modal ── */
  const [createModalOpen, setCreateModalOpen] = useState(false);

  /* Redirect unauthenticated */
  if (!authLoading && !user) {
    router.replace("/");
    return null;
  }

  /* Loading */
  if (clubsLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* No clubs */
  if (!clubsLoading && clubs.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-medium">
                You&apos;re not an admin of any clubs
              </p>
              <p className="text-sm text-muted-foreground">
                You need to be invited as a club admin to manage clubs.
              </p>
            </div>
            <Button variant="outline" onClick={() => router.push("/")}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Clubs</h1>
          <p className="text-muted-foreground">
            View admins, members, and events for your clubs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedClubId && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                router.push(`/dashboard/club?club_id=${selectedClubId}`)
              }
            >
              <Settings className="h-3.5 w-3.5" />
              Manage
            </Button>
          )}
          <Button className="gap-2" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Event
          </Button>
        </div>
      </div>

      <CreateEventModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        clubId={selectedClubId || undefined}
      />

      {/* ── Club selector ── */}
      <AdminClubSelector
        clubs={clubs}
        selectedClubId={selectedClubId}
        onSelect={setSelectedClubId}
      />

      {/* ── Dashboard content (admins + events) ── */}
      {selectedClubId && (
        <OrgDashboardContent
          clubId={selectedClubId}
          notificationMode="user"
          eventsHref={`/dashboard/events?club_id=${selectedClubId}`}
          clubHref={`/dashboard/club?club_id=${selectedClubId}`}
        />
      )}
    </div>
  );
}

export default function DashboardManagePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <ManageContent />
      </Suspense>
    </div>
  );
}
