"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { FieldGroup } from "@/lib/api/patchEvent";

/** A collaborator's presence / focus state. */
export interface CollaboratorPresence {
  userId: string;
  name: string;
  focusField: FieldGroup | null;
}

interface UseEventRealtimeOptions {
  eventId: string | undefined;
  userId: string | undefined;
  userName: string | undefined;
  enabled: boolean;
  /**
   * Called when another collaborator saves changes.
   * Receives the field groups they updated so we can selectively re-fetch.
   */
  onRemoteChange: (groups: FieldGroup[]) => void;
}

/**
 * Supabase Realtime hook for collaborative event editing.
 *
 * Uses **Presence** for focus/lock tracking — new joiners automatically
 * receive the full presence state of everyone already in the channel,
 * so refreshing never causes stale lock info.
 *
 * Uses **Broadcast** for one-shot `event-updated` notifications (saves).
 */
export function useEventRealtime({
  eventId,
  userId,
  userName,
  enabled,
  onRemoteChange,
}: UseEventRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onRemoteChangeRef = useRef(onRemoteChange);
  const [collaborators, setCollaborators] = useState<
    Map<string, CollaboratorPresence>
  >(new Map());

  useEffect(() => {
    onRemoteChangeRef.current = onRemoteChange;
  }, [onRemoteChange]);

  // Subscribe
  useEffect(() => {
    if (!eventId || !userId || !enabled) return;

    const supabase = createClient();
    const channel = supabase.channel(`event-edit:${eventId}`, {
      config: { broadcast: { self: false }, presence: { key: userId } },
    });

    /** Rebuild the collaborators map from the full presence state. */
    const syncCollaborators = () => {
      const state = channel.presenceState<{
        userId: string;
        name: string;
        focusField: FieldGroup | null;
      }>();
      const next = new Map<string, CollaboratorPresence>();
      for (const [key, presences] of Object.entries(state)) {
        if (key === userId) continue; // skip self
        const latest = presences[presences.length - 1];
        if (latest) {
          next.set(key, {
            userId: latest.userId,
            name: latest.name,
            focusField: latest.focusField,
          });
        }
      }
      setCollaborators(next);
    };

    channel
      // Broadcast: one-shot save notifications
      .on(
        "broadcast",
        { event: "event-updated" },
        (msg: { payload: { user_id: string; groups: FieldGroup[] } }) => {
          onRemoteChangeRef.current(msg.payload.groups ?? []);
        },
      )
      // Presence: sync & join/leave events all update the same way
      .on("presence", { event: "sync" }, () => {
        syncCollaborators();
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track our own presence (initially no focus)
          await channel.track({
            userId,
            name: userName ?? "Someone",
            focusField: null,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
      setCollaborators(new Map());
    };
  }, [eventId, userId, userName, enabled]);

  /** Notify others that we saved specific field groups. */
  const broadcast = useCallback(
    (groups: FieldGroup[]) => {
      if (!channelRef.current || !userId) return;
      channelRef.current.send({
        type: "broadcast",
        event: "event-updated",
        payload: { user_id: userId, groups },
      });
    },
    [userId],
  );

  /** Update our focus field in Presence state. */
  const broadcastFocus = useCallback(
    (field: FieldGroup | null) => {
      if (!channelRef.current || !userId) return;
      channelRef.current.track({
        userId,
        name: userName ?? "Someone",
        focusField: field,
      });
    },
    [userId, userName],
  );

  return { broadcast, broadcastFocus, collaborators };
}
