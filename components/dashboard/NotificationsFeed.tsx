"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";
import { toast } from "sonner";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Globe,
  Loader2,
  MapPin,
  Shield,
  XCircle,
} from "lucide-react";

/* ── Types ── */

interface ProfileSnippet {
  id: string;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
}

/** Collaborator invite (event_hosts) */
interface CollabInvite {
  id: string;
  event_id: string;
  inviter_id: string;
  status: string;
  sort_order: number;
  events: {
    id: string;
    name: string | null;
    thumbnail: string | null;
    start: string | null;
    end: string | null;
    is_online: boolean;
    category: string | null;
    status: string;
  } | null;
  inviter: ProfileSnippet | null;
}

/** Club admin invite */
interface ClubAdminInvite {
  id: string;
  club_id: string;
  role: string;
  status: string;
  invited_by: string;
  created_at: string;
  club: ProfileSnippet | null;
  inviter: ProfileSnippet | null;
}

interface NotificationsFeedProps {
  /** "org" shows collab invites only; "user" shows collab + club admin invites */
  mode: "org" | "user";
}

export function NotificationsFeed({ mode }: NotificationsFeedProps) {
  const { user } = useAuthStore();

  /* ── Collab invites ── */
  const [collabInvites, setCollabInvites] = useState<CollabInvite[]>([]);
  const [collabLoading, setCollabLoading] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const hasFetchedCollab = useRef(false);

  /* ── Club admin invites (user mode only) ── */
  const [adminInvites, setAdminInvites] = useState<ClubAdminInvite[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminRespondingTo, setAdminRespondingTo] = useState<string | null>(
    null,
  );
  const hasFetchedAdmin = useRef(false);

  const fetchCollabInvites = useCallback(async () => {
    if (!user) return;
    if (!hasFetchedCollab.current) setCollabLoading(true);
    try {
      const res = await fetch("/api/invites?status=pending");
      if (res.ok) {
        const { data } = await res.json();
        setCollabInvites(data ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch collab invites:", err);
    } finally {
      hasFetchedCollab.current = true;
      setCollabLoading(false);
    }
  }, [user]);

  const fetchAdminInvites = useCallback(async () => {
    if (!user) return;
    if (!hasFetchedAdmin.current) setAdminLoading(true);
    try {
      const res = await fetch("/api/clubs/my-invites");
      if (res.ok) {
        const { data } = await res.json();
        setAdminInvites(data ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch admin invites:", err);
    } finally {
      hasFetchedAdmin.current = true;
      setAdminLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCollabInvites();
    if (mode === "user") fetchAdminInvites();
  }, [fetchCollabInvites, fetchAdminInvites, mode]);

  /* Re-fetch silently on window focus */
  useEffect(() => {
    const onFocus = () => {
      fetchCollabInvites();
      if (mode === "user") fetchAdminInvites();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchCollabInvites, fetchAdminInvites, mode]);

  /* ── Respond to collab invite ── */
  const handleCollabResponse = async (
    inviteId: string,
    action: "accept" | "decline",
  ) => {
    setRespondingTo(inviteId);
    try {
      const res = await fetch(`/api/invites/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toast.success(
          action === "accept" ? "Invite accepted!" : "Invite declined.",
        );
        setCollabInvites((prev) => prev.filter((i) => i.id !== inviteId));
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to respond");
      }
    } catch {
      toast.error("Failed to respond to invite");
    } finally {
      setRespondingTo(null);
    }
  };

  /* ── Respond to club admin invite ── */
  const handleAdminResponse = async (
    inviteId: string,
    action: "accept" | "decline",
  ) => {
    setAdminRespondingTo(inviteId);
    try {
      const res = await fetch(`/api/clubs/admins/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toast.success(
          action === "accept"
            ? "You are now a club admin!"
            : "Admin invite declined.",
        );
        setAdminInvites((prev) => prev.filter((i) => i.id !== inviteId));
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to respond");
      }
    } catch {
      toast.error("Failed to respond to invite");
    } finally {
      setAdminRespondingTo(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "TBA";
    return new Date(dateStr).toLocaleDateString("en-AU", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isLoading =
    (collabLoading && !hasFetchedCollab.current) ||
    (adminLoading && !hasFetchedAdmin.current);
  const totalCount = collabInvites.length + adminInvites.length;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (totalCount === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">
          Notifications
          <Badge
            variant="destructive"
            className="ml-2 h-5 min-w-5 px-1.5 text-[10px]"
          >
            {totalCount}
          </Badge>
        </h2>
      </div>

      {/* Club admin invites */}
      {adminInvites.map((invite) => {
        const isResponding = adminRespondingTo === invite.id;
        return (
          <Card key={`admin-${invite.id}`} className="border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm leading-tight">
                    Club Admin Invitation
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {invite.inviter ? (
                      <>
                        <span className="font-medium text-foreground">
                          {invite.inviter.first_name}
                          {invite.inviter.last_name
                            ? ` ${invite.inviter.last_name}`
                            : ""}
                        </span>{" "}
                        invited you to manage{" "}
                      </>
                    ) : (
                      <>You&apos;ve been invited to manage </>
                    )}
                    {invite.club && (
                      <span className="font-medium text-foreground">
                        {invite.club.first_name}
                      </span>
                    )}
                    <span className="ml-1 text-muted-foreground">
                      as {invite.role}
                    </span>
                  </CardDescription>
                </div>
                {invite.club?.avatar_url && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage
                      src={invite.club.avatar_url}
                      alt={invite.club.first_name}
                    />
                    <AvatarFallback className="text-[10px]">
                      {invite.club.first_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => handleAdminResponse(invite.id, "accept")}
                  disabled={isResponding}
                >
                  {isResponding ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Accept
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => handleAdminResponse(invite.id, "decline")}
                  disabled={isResponding}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Decline
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Collab invites */}
      {collabInvites.map((invite) => {
        const event = invite.events;
        if (!event) return null;
        const isResponding = respondingTo === invite.id;

        return (
          <Card key={`collab-${invite.id}`} className="overflow-hidden">
            <div className="flex gap-3 p-4">
              {event.thumbnail && (
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md">
                  <Image
                    src={event.thumbnail}
                    alt={event.name ?? "Event"}
                    width={96}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">
                  {event.name || "Untitled Event"}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  {formatDate(event.start)}
                  {event.is_online ? (
                    <span className="ml-1.5 flex items-center gap-0.5">
                      <Globe className="h-3 w-3" /> Online
                    </span>
                  ) : (
                    <span className="ml-1.5 flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" /> In-person
                    </span>
                  )}
                </p>
                {invite.inviter && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <Avatar className="h-4 w-4">
                      {invite.inviter.avatar_url && (
                        <AvatarImage
                          src={invite.inviter.avatar_url}
                          alt={invite.inviter.first_name}
                        />
                      )}
                      <AvatarFallback className="text-[8px]">
                        {invite.inviter.first_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[11px] text-muted-foreground">
                      Invited by{" "}
                      <span className="font-medium text-foreground">
                        {invite.inviter.first_name}
                        {invite.inviter.last_name
                          ? ` ${invite.inviter.last_name}`
                          : ""}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 border-t px-4 py-3">
              <Button
                variant="default"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => handleCollabResponse(invite.id, "accept")}
                disabled={isResponding}
              >
                {isResponding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Accept
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => handleCollabResponse(invite.id, "decline")}
                disabled={isResponding}
              >
                <XCircle className="h-3.5 w-3.5" />
                Decline
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
