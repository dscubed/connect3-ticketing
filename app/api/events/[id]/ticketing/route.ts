import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkEventPermission } from "@/lib/auth/clubAdmin";

/* ================================================================
   GET /api/events/[id]/ticketing
   Returns the ticketing config + custom fields for the event.
================================================================ */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    /* ticketing_enabled lives on the events row; custom fields stay in their own table */
    const [eventRow, fields] = await Promise.all([
      supabaseAdmin
        .from("events")
        .select("ticketing_enabled")
        .eq("id", id)
        .single(),
      supabaseAdmin
        .from("event_ticketing_fields")
        .select("*")
        .eq("event_id", id)
        .order("sort_order"),
    ]);

    return NextResponse.json({
      data: {
        ticketing: { enabled: eventRow.data?.ticketing_enabled ?? true },
        fields: fields.data ?? [],
      },
    });
  } catch (err) {
    console.error("[GET /api/events/[id]/ticketing]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/* ================================================================
   POST /api/events/[id]/ticketing
   Enables ticketing for the event.
================================================================ */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    /* Auth */
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowed = await checkEventPermission(id, user.id);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    /* Set ticketing_enabled = true on the event row */
    const { error } = await supabaseAdmin
      .from("events")
      .update({ ticketing_enabled: true })
      .eq("id", id);

    if (error) {
      console.error("[POST ticketing] update error:", error);
      return NextResponse.json(
        { error: "Failed to enable ticketing" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: { enabled: true } });
  } catch (err) {
    console.error("[POST /api/events/[id]/ticketing]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/* ================================================================
   PATCH /api/events/[id]/ticketing
   Updates ticketing enabled flag + custom fields.
================================================================ */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    /* Auth */
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowed = await checkEventPermission(id, user.id);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { enabled, fields } = body as {
      enabled?: boolean;
      fields?: {
        id?: string;
        label: string;
        input_type: string;
        placeholder?: string;
        required?: boolean;
        options?: string[];
        sort_order: number;
      }[];
    };

    /* Update enabled flag directly on the events row */
    if (enabled !== undefined) {
      await supabaseAdmin
        .from("events")
        .update({ ticketing_enabled: enabled })
        .eq("id", id);
    }

    /* Replace custom fields if provided */
    if (fields) {
      await supabaseAdmin
        .from("event_ticketing_fields")
        .delete()
        .eq("event_id", id);

      if (fields.length > 0) {
        const rows = fields.map((f, i) => ({
          event_id: id,
          label: f.label,
          input_type: f.input_type,
          placeholder: f.placeholder ?? null,
          required: f.required ?? false,
          options: f.options ?? null,
          sort_order: f.sort_order ?? i,
        }));

        const { error } = await supabaseAdmin
          .from("event_ticketing_fields")
          .insert(rows);

        if (error) {
          console.error("[PATCH ticketing] fields insert error:", error);
          return NextResponse.json(
            { error: "Failed to update fields" },
            { status: 500 },
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/events/[id]/ticketing]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
