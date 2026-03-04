import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";

/* ── helpers ── */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

function publicUrl(bucket: string, path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/** Upload a file to a storage bucket and return the public URL. */
async function uploadFile(
  bucket: string,
  folder: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${folder}/${nanoid()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error)
    throw new Error(`Storage upload failed (${bucket}): ${error.message}`);
  return publicUrl(bucket, path);
}

/* ── Types matching the FormData payload ── */

interface TicketTierPayload {
  label: string;
  price: number;
}
interface EventLinkPayload {
  url: string;
  title: string;
}
interface ThemePayload {
  mode: string;
  layout: string;
  accent: string;
  accentCustom?: string;
  bgColor?: string;
}
interface SectionPayload {
  type: string;
  data: unknown;
}

/* ================================================================
   GET /api/events
   Fetches events for a given creator (organisation).
   Query params:
     - creator_id: UUID of the organisation profile
     - limit: max results (default: 50)
================================================================ */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creator_id");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    if (!creatorId) {
      return NextResponse.json(
        { error: "creator_id is required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("events")
      .select(
        "id, name, description, start, end, thumbnail, is_online, capacity, category, published_at",
      )
      .eq("creator_profile_id", creatorId)
      .order("start", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Events fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Events route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/* ================================================================
   POST /api/events
   Creates a new event with all associated records.
   Accepts multipart/form-data.
================================================================ */
export async function POST(request: NextRequest) {
  try {
    /* ── Auth check ── */
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* ── Parse multipart form ── */
    const formData = await request.formData();

    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || null;
    const startDate = formData.get("startDate") as string;
    const startTime = formData.get("startTime") as string;
    const endDate = (formData.get("endDate") as string) || null;
    const endTime = (formData.get("endTime") as string) || null;
    const timezone = (formData.get("timezone") as string) || null;
    const isOnline = formData.get("isOnline") === "true";
    const category = (formData.get("category") as string) || null;
    const tags: string[] = JSON.parse((formData.get("tags") as string) || "[]");
    const hostIds: string[] = JSON.parse(
      (formData.get("hostIds") as string) || "[]",
    );
    const pricing: TicketTierPayload[] = JSON.parse(
      (formData.get("pricing") as string) || "[]",
    );
    const links: EventLinkPayload[] = JSON.parse(
      (formData.get("links") as string) || "[]",
    );
    const theme: ThemePayload | null = formData.get("theme")
      ? JSON.parse(formData.get("theme") as string)
      : null;
    const sections: SectionPayload[] = JSON.parse(
      (formData.get("sections") as string) || "[]",
    );

    /* Location */
    const locationDisplayName =
      (formData.get("location.displayName") as string) || null;
    const locationAddress =
      (formData.get("location.address") as string) || null;
    const locationLat = formData.get("location.lat")
      ? parseFloat(formData.get("location.lat") as string)
      : null;
    const locationLon = formData.get("location.lon")
      ? parseFloat(formData.get("location.lon") as string)
      : null;

    /* Files */
    const carouselFiles: File[] = formData.getAll("images") as File[];

    /* Section files (panelist images, company logos) packed as sectionFile-{sectionIdx}-{itemIdx} */
    const sectionFileMap = new Map<string, File>();
    for (const [key, val] of formData.entries()) {
      if (key.startsWith("sectionFile-") && val instanceof File) {
        sectionFileMap.set(key, val);
      }
    }

    if (!name) {
      return NextResponse.json(
        { error: "Event name is required" },
        { status: 400 },
      );
    }

    /* ── Generate event ID ── */
    const eventId = nanoid(21);

    /* ── Build start / end timestamps ── */
    const startTs =
      startDate && startTime
        ? new Date(`${startDate}T${startTime}`).toISOString()
        : null;
    const endTs =
      endDate && endTime
        ? new Date(`${endDate}T${endTime}`).toISOString()
        : null;

    /* ── Upload carousel images ── */
    const imageUrls: string[] = [];
    for (const file of carouselFiles) {
      const url = await uploadFile("event_images", eventId, file);
      imageUrls.push(url);
    }

    /* ── Upload section files (panelists / companies) ── */
    for (const [key, file] of sectionFileMap) {
      // key = sectionFile-{sectionIdx}-{itemIdx}
      const parts = key.split("-");
      const secIdx = parseInt(parts[1], 10);
      const itemIdx = parseInt(parts[2], 10);
      const section = sections[secIdx];
      if (!section) continue;

      let bucket = "event_images";
      if (section.type === "panelists") bucket = "event_panelist_images";
      if (section.type === "companies") bucket = "event_company_logos";

      const url = await uploadFile(bucket, eventId, file);

      // Patch the section data with the uploaded URL
      const items = (section.data as { items?: Record<string, unknown>[] })
        .items;
      if (items && items[itemIdx]) {
        if (section.type === "panelists") {
          items[itemIdx].imageUrl = url;
        } else if (section.type === "companies") {
          items[itemIdx].logoUrl = url;
        }
      }
    }

    /* ── Insert location ── */
    let locationId: string | null = null;
    if (locationDisplayName && !isOnline) {
      const { data: loc, error: locErr } = await supabaseAdmin
        .from("event_locations")
        .insert({
          venue: locationDisplayName,
          address: locationAddress,
          latitude: locationLat,
          longitude: locationLon,
        })
        .select("id")
        .single();
      if (locErr) throw new Error(`Location insert failed: ${locErr.message}`);
      locationId = loc.id;
    }

    /* ── Insert event row ── */
    const thumbnail = imageUrls[0] ?? null;
    const { error: eventErr } = await supabaseAdmin.from("events").insert({
      id: eventId,
      name,
      description,
      start: startTs,
      end: endTs,
      creator_profile_id: user.id,
      published_at: new Date().toISOString(),
      is_online: isOnline,
      thumbnail,
      location_id: locationId,
      category,
      tags,
      timezone,
      source: "connect3",
    });
    if (eventErr) throw new Error(`Event insert failed: ${eventErr.message}`);

    /* ── Insert carousel images ── */
    if (imageUrls.length > 0) {
      const rows = imageUrls.map((url, i) => ({
        event_id: eventId,
        url,
        sort_order: i,
      }));
      const { error } = await supabaseAdmin.from("event_images").insert(rows);
      if (error) console.error("event_images insert error:", error);
    }

    /* ── Insert hosts ── */
    const allHostIds = [user.id, ...hostIds.filter((id) => id !== user.id)];
    if (allHostIds.length > 0) {
      const rows = allHostIds.map((pid, i) => ({
        event_id: eventId,
        profile_id: pid,
        sort_order: i,
      }));
      const { error } = await supabaseAdmin.from("event_hosts").insert(rows);
      if (error) console.error("event_hosts insert error:", error);
    }

    /* ── Insert ticket tiers ── */
    if (pricing.length > 0) {
      const rows = pricing.map((t, i) => ({
        event_id: eventId,
        label: t.label,
        price: t.price,
        sort_order: i,
      }));
      const { error } = await supabaseAdmin
        .from("event_ticket_tiers")
        .insert(rows);
      if (error) console.error("event_ticket_tiers insert error:", error);
    }

    /* ── Insert links ── */
    if (links.length > 0) {
      const rows = links.map((l, i) => ({
        event_id: eventId,
        url: l.url,
        title: l.title || null,
        sort_order: i,
      }));
      const { error } = await supabaseAdmin.from("event_links").insert(rows);
      if (error) console.error("event_links insert error:", error);
    }

    /* ── Insert theme ── */
    if (theme) {
      const { error } = await supabaseAdmin.from("event_themes").insert({
        event_id: eventId,
        mode: theme.mode,
        layout: theme.layout,
        accent: theme.accent,
        accent_custom: theme.accentCustom || null,
        bg_color: theme.bgColor || null,
      });
      if (error) console.error("event_themes insert error:", error);
    }

    /* ── Insert sections ── */
    if (sections.length > 0) {
      const rows = sections.map((s, i) => ({
        event_id: eventId,
        type: s.type,
        data: s.data,
        sort_order: i,
      }));
      const { error } = await supabaseAdmin.from("event_sections").insert(rows);
      if (error) console.error("event_sections insert error:", error);
    }

    return NextResponse.json(
      { id: eventId, message: "Event created" },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/events error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
