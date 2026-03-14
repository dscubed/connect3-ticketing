import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "Missing slug parameter" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("url_slug", slug)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error checking slug:", error);
    return NextResponse.json({ error: "Failed to check slug availability" }, { status: 500 });
  }

  // It is available if no event has it, OR if the current event has it
  const isAvailable = !data || data.id === eventId;

  return NextResponse.json({ available: isAvailable });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Add proper permission check (e.g., matching profile/club admin)

  let body;
  try {
    body = await request.json();
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { slug } = body;

  if (slug === undefined) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  if (slug) {
    // Check again before saving
    const { data: existing, error: checkErr } = await supabase
      .from("events")
      .select("id")
      .eq("url_slug", slug)
      .single();

    if (checkErr && checkErr.code !== "PGRST116") {
       return NextResponse.json({ error: "Failed to check slug availability" }, { status: 500 });
    }

    if (existing && existing.id !== eventId) {
       return NextResponse.json({ error: "Slug is already taken" }, { status: 409 });
    }
  }

  const { error: updateError } = await supabase
    .from("events")
    .update({ url_slug: slug || null })
    .eq("id", eventId);

  if (updateError) {
    console.error("Failed to update slug:", updateError);
    return NextResponse.json({ error: "Failed to update slug" }, { status: 500 });
  }

  return NextResponse.json({ success: true, slug });
}


