"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { AdminManagePanel } from "@/components/dashboard/AdminManagePanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Shield, Users, Loader2 } from "lucide-react";

function ClubManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, isOrganisation } = useAuthStore();
  const isOrg = !authLoading && !!user && isOrganisation();
  const [verified, setVerified] = useState(false);
  const hasFetched = useRef(false);

  /*
   * Determine the club ID to manage:
   *  - Org accounts: always their own user.id (they ARE the club)
   *  - Regular users (club admins): must provide ?club_id=xxx
   */
  const clubId = isOrg ? (user?.id ?? null) : searchParams.get("club_id");

  /* Validate non-org users actually admin the club */
  useEffect(() => {
    console.log(
      "[ClubManagementPage] useEffect — authLoading:",
      authLoading,
      "user:",
      user,
      "isOrg:",
      isOrg,
      "clubId:",
      clubId,
    );
    if (authLoading || !user) {
      router.replace("/");
      return;
    }
    if (isOrg) return;
    if (!clubId) {
      router.replace("/");
      return;
    }
    if (hasFetched.current) return;
    hasFetched.current = true;
    (async () => {
      try {
        const res = await fetch("/api/clubs/my-clubs");
        if (!res.ok) {
          router.replace("/");
          return;
        }
        const { data } = await res.json();
        const isAdmin = (data ?? []).some(
          (r: { club_id: string }) => r.club_id === clubId,
        );
        if (!isAdmin) {
          router.replace("/");
          return;
        }
        setVerified(true);
      } catch {
        router.replace("/");
      }
    })();
  }, [authLoading, user, isOrg, clubId, router]);

  if (authLoading || (!isOrg && !verified)) return null;

  if (!user) {
    router.replace("/");
    return null;
  }

  if (!clubId) {
    router.replace("/");
    return null;
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Club Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage your club admins and members.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="admins">
        <TabsList className="mb-4">
          <TabsTrigger value="admins" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Admins
          </TabsTrigger>
          <TabsTrigger value="members" disabled className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Members
            <Badge
              variant="outline"
              className="ml-1 text-[9px] px-1.5 py-0 leading-4"
            >
              Soon
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="admins">
          <AdminManagePanel clubId={clubId} />
        </TabsContent>

        <TabsContent value="members">
          {/* Placeholder — tab is disabled so this won't render */}
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Users className="h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">Coming soon</p>
            <p className="text-xs">
              Member management will be available in a future update.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function ClubManagementPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <ClubManagementContent />
      </Suspense>
    </div>
  );
}
