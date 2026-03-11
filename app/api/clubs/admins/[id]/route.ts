import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/* ================================================================
   PATCH /api/clubs/admins/[id]
   Accept or decline a club admin invite.
   The [id] is the club_admins row ID.
   Body: { action: "accept" | "decline" }
================================================================ */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: adminId } = await params;

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
    const action: string = body.action;

    if (!["accept", "decline"].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "accept" or "decline"' },
        { status: 400 },
      );
    }

    /* Fetch the admin row and verify the current user is the invitee */
    const { data: adminRow, error: fetchErr } = await supabaseAdmin
      .from("club_admins")
      .select("id, club_id, user_id, status")
      .eq("id", adminId)
      .single();

    if (fetchErr || !adminRow) {
      return NextResponse.json(
        { error: "Admin invite not found" },
        { status: 404 },
      );
    }

    if (adminRow.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (adminRow.status !== "pending") {
      return NextResponse.json(
        { error: `Invite already ${adminRow.status}` },
        { status: 409 },
      );
    }

    const newStatus = action === "accept" ? "accepted" : "declined";

    /* Update the admin row status */
    const { error: updateErr } = await supabaseAdmin
      .from("club_admins")
      .update({ status: newStatus })
      .eq("id", adminId);

    if (updateErr) {
      console.error("Failed to update admin invite:", updateErr);
      return NextResponse.json(
        { error: "Failed to update invite" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: { id: adminId, status: newStatus } });
  } catch (error) {
    console.error("PATCH /api/clubs/admins/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
