import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkEventPermission } from "@/lib/auth/clubAdmin";

/* ================================================================
   POST /api/events/[id]/invites
   Send collaboration invites for an event.
   Body: { invitee_ids: string[] }
   Only the event creator can send invites.
   Creates event_hosts rows with status='pending'.
================================================================ */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;

    /* Auth check */
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* Verify the user is the event creator or club admin */
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("creator_profile_id")
      .eq("id", eventId)
      .single();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const perm = await checkEventPermission(eventId, user.id);
    if (!perm.isCreator && !perm.isClubAdmin) {
      return NextResponse.json(
        { error: "Only the event creator or a club admin can send invites" },
        { status: 403 },
      );
    }

    /* Parse body */
    const body = await request.json();
    const inviteeIds: string[] = body.invitee_ids ?? [];

    if (inviteeIds.length === 0) {
      return NextResponse.json(
        { error: "No invitees specified" },
        { status: 400 },
      );
    }

    /* Filter out the creator */
    const creatorId = event.creator_profile_id;
    const validIds = inviteeIds.filter(
      (id) => id !== user.id && id !== creatorId,
    );

    if (validIds.length === 0) {
      return NextResponse.json({ data: { sent: 0 } });
    }

    /* Upsert host rows with status='pending' */
    const rows = validIds.map((inviteeId, i) => ({
      event_id: eventId,
      profile_id: inviteeId,
      sort_order: 100 + i,
      status: "pending",
      inviter_id: user.id,
    }));

    const { data: hosts, error } = await supabaseAdmin
      .from("event_hosts")
      .upsert(rows, { onConflict: "event_id,profile_id" })
      .select("id, profile_id, status");

    if (error) {
      console.error("Failed to create invites:", error);
      return NextResponse.json(
        { error: "Failed to send invites" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: { sent: hosts?.length ?? 0, hosts } });
  } catch (error) {
    console.error("POST /api/events/[id]/invites error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/* ================================================================
   GET /api/events/[id]/invites
   Get all invite-status hosts for an event (creator or accepted collaborator).
   Returns hosts with status in ('pending', 'accepted', 'declined').
================================================================ */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* Verify creator or accepted collaborator or club admin */
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("creator_profile_id")
      .eq("id", eventId)
      .single();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const getPerm = await checkEventPermission(eventId, user.id);
    if (!getPerm.isCreator && !getPerm.isCollaborator && !getPerm.isClubAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    /* Get all hosts with invite status */
    const { data, error } = await supabaseAdmin
      .from("event_hosts")
      .select(
        "id, profile_id, status, inviter_id, sort_order, profiles:profile_id(id, first_name, avatar_url)",
      )
      .eq("event_id", eventId)
      .in("status", ["pending", "accepted", "declined"])
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Failed to fetch invites:", error);
      return NextResponse.json(
        { error: "Failed to fetch invites" },
        { status: 500 },
      );
    }

    /* Reshape to match the InviteRecord format the frontend expects */
    const invites = (data ?? []).map((row) => ({
      id: row.id,
      invitee_id: row.profile_id,
      status: row.status,
      profiles: row.profiles,
    }));

    return NextResponse.json({ data: invites });
  } catch (error) {
    console.error("GET /api/events/[id]/invites error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/* ================================================================
   DELETE /api/events/[id]/invites
   Cancel a pending invite or remove an accepted collaborator.
   Body: { profile_id: string }
   Only the event creator can perform this action.
================================================================ */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* Verify the user is the event creator or club admin */
    const { data: delEvent } = await supabaseAdmin
      .from("events")
      .select("creator_profile_id")
      .eq("id", eventId)
      .single();

    if (!delEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const delPerm = await checkEventPermission(eventId, user.id);
    if (!delPerm.isCreator && !delPerm.isClubAdmin) {
      return NextResponse.json(
        { error: "Only the event creator or a club admin can manage invites" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const profileId: string = body.profile_id;

    if (!profileId) {
      return NextResponse.json(
        { error: "profile_id is required" },
        { status: 400 },
      );
    }

    /* Allow cancelling pending, removing accepted, or cleaning up declined */
    const { data: hostRow } = await supabaseAdmin
      .from("event_hosts")
      .select("id, status")
      .eq("event_id", eventId)
      .eq("profile_id", profileId)
      .in("status", ["pending", "accepted", "declined"])
      .maybeSingle();

    if (!hostRow) {
      return NextResponse.json(
        { error: "No cancellable invite found" },
        { status: 404 },
      );
    }

    const { error } = await supabaseAdmin
      .from("event_hosts")
      .delete()
      .eq("id", hostRow.id);

    if (error) {
      console.error("Failed to cancel invite:", error);
      return NextResponse.json(
        { error: "Failed to cancel invite" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: { removed: profileId, previousStatus: hostRow.status },
    });
  } catch (error) {
    console.error("DELETE /api/events/[id]/invites error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/* ================================================================
   PATCH /api/events/[id]/invites
   Resend a declined invite (sets status back to 'pending').
   Body: { profile_id: string }
   Only the event creator can perform this action.
================================================================ */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* Verify the user is the event creator or club admin */
    const { data: patchEvent } = await supabaseAdmin
      .from("events")
      .select("creator_profile_id")
      .eq("id", eventId)
      .single();

    if (!patchEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const patchPerm = await checkEventPermission(eventId, user.id);
    if (!patchPerm.isCreator && !patchPerm.isClubAdmin) {
      return NextResponse.json(
        { error: "Only the event creator or a club admin can resend invites" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const profileId: string = body.profile_id;

    if (!profileId) {
      return NextResponse.json(
        { error: "profile_id is required" },
        { status: 400 },
      );
    }

    /* Only allow resending declined invites */
    const { data: hostRow } = await supabaseAdmin
      .from("event_hosts")
      .select("id, status")
      .eq("event_id", eventId)
      .eq("profile_id", profileId)
      .eq("status", "declined")
      .maybeSingle();

    if (!hostRow) {
      return NextResponse.json(
        { error: "No declined invite found to resend" },
        { status: 404 },
      );
    }

    const { error } = await supabaseAdmin
      .from("event_hosts")
      .update({ status: "pending", inviter_id: user.id })
      .eq("id", hostRow.id);

    if (error) {
      console.error("Failed to resend invite:", error);
      return NextResponse.json(
        { error: "Failed to resend invite" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: { profile_id: profileId, status: "pending" },
    });
  } catch (error) {
    console.error("PATCH /api/events/[id]/invites error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
