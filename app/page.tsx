"use client";

import { useAuthStore } from "@/stores/authStore";
import { OrgDashboard } from "@/components/dashboard/OrgDashboard";
import { UserDashboard } from "@/components/dashboard/UserDashboard";
import { LoginButton } from "@/components/auth/LoginButton";
import { Ticket, Loader2 } from "lucide-react";

export default function Home() {
  const { user, profile, loading, isOrganisation } = useAuthStore();

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not signed in — landing
  if (!user || !profile) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="flex w-full max-w-md flex-col items-center gap-8 px-6 py-32 text-center">
          <div className="flex items-center gap-2">
            <Ticket className="h-8 w-8" />
            <span className="text-2xl font-bold tracking-tight">
              Connect3 Ticketing
            </span>
          </div>
          <p className="text-lg leading-8 text-muted-foreground">
            The all-in-one ticketing solution for clubs. Sign in to get started.
          </p>
          <LoginButton redirectPath="/" />
        </div>
      </div>
    );
  }

  // Signed in — render dashboard based on account type
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {isOrganisation() ? <OrgDashboard /> : <UserDashboard />}
    </div>
  );
}
