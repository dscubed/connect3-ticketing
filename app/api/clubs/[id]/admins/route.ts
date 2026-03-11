import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/* ================================================================
   Helper: check if a user is the club owner or an accepted admin
================================================================ */
async function isClubOwnerOrAdmin(
  clubId: string,
  userId: string,
): Promise<{ isOwner: boolean; isAdmin: boolean }> {
  /* Check ownership */
  const { data: club } = await supabaseAdmin
    .from("profiles")
    .select("id, account_type")
    .eq("id", clubId)
    .eq("account_type", "organisation")
    .single();

  if (!club) return { isOwner: false, isAdmin: false };

  const isOwner = clubId === userId; // org account IS the user

  if (isOwner) return { isOwner: true, isAdmin: false };

  /* Check admin status */
  const { data: adminRow } = await supabaseAdmin
    .from("club_admins")
    .select("status, role")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();

  return { isOwner: false, isAdmin: !!adminRow };
}

/* ================================================================
   GET /api/clubs/[id]/admins
   List all admins for a club.
   Only the club owner or an accepted admin can view.
   Returns profiles with their admin role/status.
================================================================ */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: clubId } = await params;

    /* Auth check */
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* Verify the caller is the club owner or an accepted admin */
    const { isOwner, isAdmin } = await isClubOwnerOrAdmin(clubId, user.id);
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    /* Fetch all admin rows with profile info */
    const { data, error } = await supabaseAdmin
      .from("club_admins")
      .select(
        `id, club_id, user_id, role, status, invited_by, created_at,
         profiles:user_id(id, first_name, last_name, avatar_url, account_type)`,
      )
      .eq("club_id", clubId)
      .in("status", ["pending", "accepted", "declined"])
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch club admins:", error);
      return NextResponse.json(
        { error: "Failed to fetch admins" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/clubs/[id]/admins error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/* ================================================================
   POST /api/clubs/[id]/admins
   Invite one or more users as club admins.
   Body: { user_ids: string[], role?: string }
   Only the club owner or an existing accepted admin can invite.
================================================================ */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: clubId } = await params;

    /* Auth check */
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* Verify the caller is the club owner or an accepted admin */
    const { isOwner, isAdmin } = await isClubOwnerOrAdmin(clubId, user.id);
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Only the club owner or an existing admin can invite admins" },
        { status: 403 },
      );
    }

    /* Verify the target is actually an organisation */
    const { data: club } = await supabaseAdmin
      .from("profiles")
      .select("id, account_type")
      .eq("id", clubId)
      .eq("account_type", "organisation")
      .single();

    if (!club) {
      return NextResponse.json(
        { error: "Club not found or is not an organisation" },
        { status: 404 },
      );
    }

    /* Parse body */
    const body = await request.json();
    const userIds: string[] = body.user_ids ?? [];
    const role: string = body.role ?? "admin";

    if (!["admin", "editor", "viewer"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be admin, editor, or viewer" },
        { status: 400 },
      );
    }

    if (userIds.length === 0) {
      return NextResponse.json(
        { error: "No users specified" },
        { status: 400 },
      );
    }

    /* Filter out the club's own ID (can't admin yourself) */
    const validIds = userIds.filter((id) => id !== clubId);

    if (validIds.length === 0) {
      return NextResponse.json({ data: { sent: 0 } });
    }

    /* Upsert admin rows with status='pending' */
    const rows = validIds.map((userId) => ({
      club_id: clubId,
      user_id: userId,
      role,
      status: "pending",
      invited_by: user.id,
    }));

    const { data: admins, error } = await supabaseAdmin
      .from("club_admins")
      .upsert(rows, { onConflict: "club_id,user_id" })
      .select("id, user_id, role, status");

    if (error) {
      console.error("Failed to create admin invites:", error);
      return NextResponse.json(
        { error: "Failed to send invites" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: { sent: admins?.length ?? 0, admins },
    });
  } catch (error) {
    console.error("POST /api/clubs/[id]/admins error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/* ================================================================
   DELETE /api/clubs/[id]/admins
   Remove an admin from the club.
   Body: { user_id: string }
   Only the club owner or the admin themselves can remove.
================================================================ */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: clubId } = await params;

    /* Auth check */
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* Parse body */
    const body = await request.json();
    const targetUserId: string = body.user_id;

    if (!targetUserId) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 },
      );
    }

    /* The caller must be either:
       1. The club owner (can remove any admin)
       2. The admin themselves (leaving the club) */
    const { isOwner } = await isClubOwnerOrAdmin(clubId, user.id);
    const isSelf = user.id === targetUserId;

    if (!isOwner && !isSelf) {
      return NextResponse.json(
        { error: "Only the club owner can remove other admins" },
        { status: 403 },
      );
    }

    /* Delete the admin row */
    const { error } = await supabaseAdmin
      .from("club_admins")
      .delete()
      .eq("club_id", clubId)
      .eq("user_id", targetUserId);

    if (error) {
      console.error("Failed to remove admin:", error);
      return NextResponse.json(
        { error: "Failed to remove admin" },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: "Admin removed" });
  } catch (error) {
    console.error("DELETE /api/clubs/[id]/admins error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
