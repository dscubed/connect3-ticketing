"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  Search,
  Users,
  UserMinus,
  UserPlus,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

/* ── Types ── */

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  account_type?: string;
}

interface ClubAdmin {
  id: string;
  club_id: string;
  user_id: string;
  role: string;
  status: string;
  invited_by: string | null;
  created_at: string;
  profiles: UserProfile | null;
}

interface AdminManagePanelProps {
  /** The club/org profile ID */
  clubId: string;
}

const PAGE_SIZE = 20;

export function AdminManagePanel({ clubId }: AdminManagePanelProps) {
  const { user } = useAuthStore();

  /* ── Admins list ── */
  const [admins, setAdmins] = useState<ClubAdmin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const hasFetchedAdmins = useRef(false);

  /* ── Search state ── */
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const fetchingRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  /* ── Invite state ── */
  const [sending, setSending] = useState<string | null>(null);

  /* ── Remove state ── */
  const [removeConfirm, setRemoveConfirm] = useState<{
    open: boolean;
    userId: string;
    name: string;
  }>({ open: false, userId: "", name: "" });
  const [removing, setRemoving] = useState(false);

  /* ── Fetch admins (SWR: only spinner on first load) ── */
  const fetchAdmins = useCallback(async () => {
    if (!hasFetchedAdmins.current) setAdminsLoading(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/admins`);
      if (res.ok) {
        const { data } = await res.json();
        setAdmins(data ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch admins:", err);
    } finally {
      hasFetchedAdmins.current = true;
      setAdminsLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  /* ── Debounced search ── */
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
      setSearchResults([]);
      setHasMore(true);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  /* ── Search users ── */
  const searchUsers = useCallback(
    async (pageNum: number, searchTerm: string) => {
      if (fetchingRef.current || !searchTerm.trim()) return;
      fetchingRef.current = true;
      setSearchLoading(true);
      try {
        const params = new URLSearchParams({
          table: "profiles",
          select: "id,first_name,last_name,avatar_url,account_type",
          limit: String(PAGE_SIZE),
          offset: String(pageNum * PAGE_SIZE),
          search: searchTerm,
        });

        const res = await fetch(`/api/profiles/fetch?${params}`);
        if (!res.ok) return;
        const { data } = await res.json();
        const results = (data ?? []) as UserProfile[];

        // Filter out organisations and self
        const filtered = results.filter(
          (r) => r.account_type !== "organisation" && r.id !== clubId,
        );

        if (pageNum === 0) {
          setSearchResults(filtered);
        } else {
          setSearchResults((prev) => {
            const ids = new Set(prev.map((p) => p.id));
            return [...prev, ...filtered.filter((p) => !ids.has(p.id))];
          });
        }
        setHasMore(results.length === PAGE_SIZE);
      } catch (err) {
        console.error("Failed to search users:", err);
      } finally {
        setSearchLoading(false);
        fetchingRef.current = false;
      }
    },
    [clubId],
  );

  useEffect(() => {
    if (debouncedSearch.trim()) {
      searchUsers(page, debouncedSearch);
    } else {
      setSearchResults([]);
    }
  }, [page, debouncedSearch, searchUsers]);

  const handleScroll = () => {
    if (!listRef.current || fetchingRef.current || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    if (scrollHeight - scrollTop - clientHeight < 40) {
      setPage((p) => p + 1);
    }
  };

  /* ── Invite user ── */
  const handleInvite = async (userId: string) => {
    setSending(userId);
    try {
      const res = await fetch(`/api/clubs/${clubId}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: [userId] }),
      });
      if (res.ok) {
        toast.success("Admin invite sent");
        fetchAdmins();
        // Clear search
        setSearch("");
        setSearchOpen(false);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to send invite");
      }
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setSending(null);
    }
  };

  /* ── Remove admin ── */
  const handleRemove = async () => {
    setRemoving(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/admins`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: removeConfirm.userId }),
      });
      if (res.ok) {
        toast.success("Admin removed");
        setAdmins((prev) =>
          prev.filter((a) => a.user_id !== removeConfirm.userId),
        );
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to remove admin");
      }
    } catch {
      toast.error("Failed to remove admin");
    } finally {
      setRemoving(false);
      setRemoveConfirm({ open: false, userId: "", name: "" });
    }
  };

  const adminUserIds = new Set(admins.map((a) => a.user_id));
  const activeAdmins = admins.filter(
    (a) => a.status === "accepted" || a.status === "pending",
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Manage Admins</h2>
          {activeAdmins.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {activeAdmins.length}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setSearchOpen(!searchOpen)}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invite Admin
        </Button>
      </div>

      {/* Search panel */}
      {searchOpen && (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search users by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            {search.trim() && (
              <div
                ref={listRef}
                onScroll={handleScroll}
                className="mt-3 max-h-48 space-y-1 overflow-y-auto"
              >
                {searchResults.length === 0 && !searchLoading && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No users found
                  </p>
                )}
                {searchResults.map((profile) => {
                  const alreadyAdmin = adminUserIds.has(profile.id);
                  const isSending = sending === profile.id;
                  return (
                    <button
                      key={profile.id}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
                      disabled={alreadyAdmin || isSending}
                      onClick={() => handleInvite(profile.id)}
                    >
                      <Avatar className="h-7 w-7">
                        {profile.avatar_url && (
                          <AvatarImage
                            src={profile.avatar_url}
                            alt={profile.first_name}
                          />
                        )}
                        <AvatarFallback className="text-[10px]">
                          {profile.first_name?.charAt(0).toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate text-sm">
                        {profile.first_name}
                        {profile.last_name ? ` ${profile.last_name}` : ""}
                      </span>
                      {alreadyAdmin ? (
                        <Check className="h-4 w-4 text-muted-foreground" />
                      ) : isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
                {searchLoading && (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Current admins list */}
      {adminsLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : activeAdmins.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Users className="h-10 w-10 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">No admins yet</p>
              <p className="text-xs text-muted-foreground">
                Invite users to help manage your club&apos;s events.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {activeAdmins.map((admin) => {
            const profile = admin.profiles;
            return (
              <div
                key={admin.id}
                className="flex items-center gap-3 rounded-lg border px-4 py-3"
              >
                <Avatar className="h-8 w-8">
                  {profile?.avatar_url && (
                    <AvatarImage
                      src={profile.avatar_url}
                      alt={profile.first_name}
                    />
                  )}
                  <AvatarFallback className="text-xs">
                    {profile?.first_name?.charAt(0).toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {profile?.first_name ?? "Unknown"}
                    {profile?.last_name ? ` ${profile.last_name}` : ""}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={
                        admin.status === "accepted" ? "default" : "outline"
                      }
                      className="text-[10px]"
                    >
                      {admin.status === "accepted" ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      ) : admin.status === "pending" ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> {admin.status}
                        </span>
                      )}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {admin.role}
                    </span>
                  </div>
                </div>
                {user && admin.user_id !== user.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() =>
                      setRemoveConfirm({
                        open: true,
                        userId: admin.user_id,
                        name: profile?.first_name
                          ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}`
                          : "this admin",
                      })
                    }
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Remove confirmation */}
      <AlertDialog
        open={removeConfirm.open}
        onOpenChange={(open) => {
          if (!open) setRemoveConfirm({ open: false, userId: "", name: "" });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Admin</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium text-foreground">
                {removeConfirm.name}
              </span>{" "}
              as an admin? They will no longer be able to manage events for this
              club.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserMinus className="mr-2 h-4 w-4" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
