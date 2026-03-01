"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import type { Profile } from "@/stores/authStore";

const supabase = createClient();

async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const res = await fetch(
      `/api/profiles/fetch?id=${userId}&select=id,account_type,first_name,avatar_url`,
    );
    if (!res.ok) return null;
    const { data } = await res.json();
    return data as Profile;
  } catch {
    return null;
  }
}

/**
 * Initialises auth state on mount and subscribes to auth changes.
 * Fetches the user profile after authentication.
 * Place this once in your root layout.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    // Fetch initial session + profile
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const profile = await fetchProfile(data.user.id);
        setProfile(profile);
      }
      setLoading(false);
    });

    // Listen for sign-in / sign-out events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      setUser(user);
      if (user) {
        const profile = await fetchProfile(user.id);
        setProfile(profile);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setProfile, setLoading]);

  return <>{children}</>;
}
