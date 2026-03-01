"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { PlusCircle, Search, Loader2, X } from "lucide-react";

export interface ClubProfile {
  id: string;
  first_name: string;
  avatar_url: string | null;
}

interface EventHostsPickerProps {
  /** The creator's own profile — always displayed, cannot be removed */
  creatorProfile: ClubProfile;
  /** Currently selected additional host IDs (NOT including the creator) */
  selectedHosts: string[];
  /** Selected host profile data (cached, excluding creator) */
  selectedHostsData: ClubProfile[];
  /** Called when selection changes */
  onChange: (ids: string[], data: ClubProfile[]) => void;
}

const PAGE_SIZE = 20;

export function EventHostsPicker({
  creatorProfile,
  selectedHosts,
  selectedHostsData,
  onChange,
}: EventHostsPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [clubs, setClubs] = useState<ClubProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
      setClubs([]);
      setHasMore(true);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch clubs
  const fetchClubs = useCallback(
    async (pageNum: number, searchTerm: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          table: "profiles",
          select: "id,first_name,avatar_url",
          filter: JSON.stringify({ account_type: "organisation" }),
          limit: String(PAGE_SIZE),
        });
        if (searchTerm) {
          params.set("search", searchTerm);
        }
        params.set("limit", String(PAGE_SIZE));

        const res = await fetch(`/api/profiles/fetch?${params}`);
        if (!res.ok) return;
        const { data } = await res.json();
        const results = (data ?? []) as ClubProfile[];

        if (pageNum === 0) {
          setClubs(results);
        } else {
          setClubs((prev) => {
            const ids = new Set(prev.map((c) => c.id));
            return [...prev, ...results.filter((c) => !ids.has(c.id))];
          });
        }
        setHasMore(results.length === PAGE_SIZE);
      } catch (err) {
        console.error("Failed to fetch clubs:", err);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Fetch clubs when popover is open and search/page changes
  useEffect(() => {
    if (open) {
      fetchClubs(page, debouncedSearch);
    }
  }, [open, page, debouncedSearch, fetchClubs]);

  const handleScroll = () => {
    if (!listRef.current || loading || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    if (scrollHeight - scrollTop - clientHeight < 40) {
      setPage((p) => p + 1);
    }
  };

  const toggleClub = (club: ClubProfile) => {
    // Cannot toggle the creator
    if (club.id === creatorProfile.id) return;
    const isSelected = selectedHosts.includes(club.id);
    if (isSelected) {
      onChange(
        selectedHosts.filter((id) => id !== club.id),
        selectedHostsData.filter((c) => c.id !== club.id),
      );
    } else {
      onChange([...selectedHosts, club.id], [...selectedHostsData, club]);
    }
  };

  const clearAll = () => {
    onChange([], []);
  };

  // Build display label: "CreatorName" or "CreatorName + 2 others"
  const othersCount = selectedHostsData.length;
  const displayLabel =
    othersCount > 0
      ? `${creatorProfile.first_name} + ${othersCount} other${othersCount > 1 ? "s" : ""}`
      : creatorProfile.first_name;

  return (
    <div className="flex items-center gap-2">
      {/* Stacked avatars */}
      <div className="flex items-center -space-x-2">
        {/* Creator avatar — always visible */}
        <Avatar className="h-8 w-8 border-2 border-background z-10">
          {creatorProfile.avatar_url && (
            <AvatarImage
              src={creatorProfile.avatar_url}
              alt={creatorProfile.first_name}
            />
          )}
          <AvatarFallback className="text-xs">
            {creatorProfile.first_name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Additional host avatars (max 2 shown) */}
        {selectedHostsData.slice(0, 2).map((club, i) => (
          <Avatar
            key={club.id}
            className="h-8 w-8 border-2 border-background"
            style={{ zIndex: 9 - i }}
          >
            {club.avatar_url && (
              <AvatarImage src={club.avatar_url} alt={club.first_name} />
            )}
            <AvatarFallback className="text-xs">
              {club.first_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}

        {/* +N badge if more than 2 additional hosts */}
        {selectedHostsData.length > 2 && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold text-foreground z-0">
            +{selectedHostsData.length - 2}
          </div>
        )}
      </div>

      {/* Label */}
      <span className="text-sm font-medium text-foreground">
        {displayLabel}
      </span>

      {/* Add button */}
      <Popover
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            setSearch("");
            setDebouncedSearch("");
            setClubs([]);
            setPage(0);
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PlusCircle className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          {/* Search */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search clubs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>

          <div
            ref={listRef}
            onScroll={handleScroll}
            className="max-h-52 overflow-y-auto py-1"
          >
            {/* Creator pinned at very top — always checked, not toggleable */}
            <div className="flex w-full items-center gap-2 px-3 py-1.5 text-sm opacity-60">
              <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-primary bg-primary text-primary-foreground">
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path
                    d="M2 5l2 2 4-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
              <Avatar className="h-5 w-5">
                {creatorProfile.avatar_url && (
                  <AvatarImage
                    src={creatorProfile.avatar_url}
                    alt={creatorProfile.first_name}
                  />
                )}
                <AvatarFallback className="text-[9px]">
                  {creatorProfile.first_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate font-medium">
                {creatorProfile.first_name}
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                You
              </span>
            </div>

            {/* Selected additional clubs */}
            {selectedHostsData.map((club) => (
              <button
                key={`sel-${club.id}`}
                type="button"
                onClick={() => toggleClub(club)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted"
              >
                <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-primary bg-primary text-primary-foreground">
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <path
                      d="M2 5l2 2 4-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
                <Avatar className="h-5 w-5">
                  {club.avatar_url && (
                    <AvatarImage src={club.avatar_url} alt={club.first_name} />
                  )}
                  <AvatarFallback className="text-[9px]">
                    {club.first_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate font-medium">{club.first_name}</span>
              </button>
            ))}

            {(selectedHostsData.length > 0 || true) &&
              clubs.some(
                (c) =>
                  !selectedHosts.includes(c.id) && c.id !== creatorProfile.id,
              ) && <Separator className="my-1" />}

            {/* Unselected clubs (excluding creator) */}
            {clubs
              .filter(
                (club) =>
                  !selectedHosts.includes(club.id) &&
                  club.id !== creatorProfile.id,
              )
              .map((club) => (
                <button
                  key={club.id}
                  type="button"
                  onClick={() => toggleClub(club)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  <div className="h-4 w-4 rounded-sm border border-muted-foreground/30" />
                  <Avatar className="h-5 w-5">
                    {club.avatar_url && (
                      <AvatarImage
                        src={club.avatar_url}
                        alt={club.first_name}
                      />
                    )}
                    <AvatarFallback className="text-[9px]">
                      {club.first_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{club.first_name}</span>
                </button>
              ))}

            {loading && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && clubs.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No clubs found
              </div>
            )}
          </div>

          {selectedHosts.length > 0 && (
            <>
              <Separator />
              <button
                type="button"
                onClick={clearAll}
                className="flex w-full items-center justify-center gap-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Clear All
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
