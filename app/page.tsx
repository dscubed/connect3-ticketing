"use client";

import { LoginButton } from "@/components/auth/LoginButton";
import { useAuthStore } from "@/stores/authStore";
import { createClient } from "@/lib/supabase/client";
import { Ticket, Loader2, LogOut } from "lucide-react";

export default function Home() {
  const { user, loading } = useAuthStore();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-8 px-6 py-32 text-center">
        <div className="flex items-center gap-2 text-black dark:text-zinc-50">
          <Ticket className="h-8 w-8" />
          <span className="text-2xl font-bold tracking-tight">
            Connect3 Ticketing
          </span>
        </div>

        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        ) : user ? (
          <>
            <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              Signed in as{" "}
              <span className="font-medium text-black dark:text-zinc-50">
                {user.email}
              </span>
            </p>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-black/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </>
        ) : (
          <>
            <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              The all-in-one ticketing solution for clubs. Sign in to get
              started.
            </p>
            <LoginButton redirectPath="/" />
          </>
        )}
      </main>
    </div>
  );
}
