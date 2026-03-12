"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/authStore";

/* ── Types (re-exported so consumers don't need their own) ── */

export interface ClubProfile {
  id: string;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
}

export interface ClubAdminRow {
  id: string;
  club_id: string;
  role: string;
  status: string;
  created_at: string;
  club: ClubProfile | null;
}

export interface UseClubSelectorReturn {
  /** All clubs the current user admins */
  clubs: ClubAdminRow[];
  /** True while the first fetch is in-flight */
  loading: boolean;
  /** The currently selected club ID */
  selectedClubId: string | null;
  /** Change the selected club */
  setSelectedClubId: (id: string) => void;
  /** Re-fetch the club list (e.g. on window focus) */
  refetchClubs: () => void;
}

/**
 * Shared hook that fetches the user's admin clubs from `/api/clubs/my-clubs`
 * and manages the selected-club state.
 *
 * @param initialClubId - Optional club ID from query params / props to
 *   pre-select. Falls back to the first club if not provided or invalid.
 */
export function useAdminClubSelector(
  initialClubId?: string | null,
): UseClubSelectorReturn {
  const { user } = useAuthStore();

  const [clubs, setClubs] = useState<ClubAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(
    initialClubId ?? null,
  );
  const hasFetched = useRef(false);

  const fetchClubs = useCallback(async () => {
    if (!user) return;
    if (!hasFetched.current) setLoading(true);
    try {
      const res = await fetch("/api/clubs/my-clubs");
      if (res.ok) {
        const { data } = await res.json();
        const rows: ClubAdminRow[] = data ?? [];
        setClubs(rows);
        if (rows.length > 0 && !selectedClubId) {
          if (initialClubId && rows.some((r) => r.club_id === initialClubId)) {
            setSelectedClubId(initialClubId);
          } else {
            setSelectedClubId(rows[0].club_id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch clubs:", err);
    } finally {
      hasFetched.current = true;
      setLoading(false);
    }
  }, [user, selectedClubId, initialClubId]);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  /* Re-fetch on window focus */
  useEffect(() => {
    const onFocus = () => fetchClubs();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchClubs]);

  return {
    clubs,
    loading,
    selectedClubId,
    setSelectedClubId,
    refetchClubs: fetchClubs,
  };
}
