import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";

/* ── helpers ── */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

function publicUrl(bucket: string, path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

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

/* ── Types ── */
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
   GET /api/events/[id]
   Fetches a single event with all related data.
================================================================ */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    /* Event row + location + pricing */
    const { data: event, error } = await supabaseAdmin
      .from("events")
      .select(
        `
        *,
        event_locations (*),
        event_pricings (*)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    /* Related tables in parallel */
    const [images, hosts, tiers, links, theme, sections] = await Promise.all([
      supabaseAdmin
        .from("event_images")
        .select("*")
        .eq("event_id", id)
        .order("sort_order"),
      supabaseAdmin
        .from("event_hosts")
        .select(
          "profile_id, sort_order, profiles:profile_id(id, first_name, avatar_url)",
        )
        .eq("event_id", id)
        .order("sort_order"),
      supabaseAdmin
        .from("event_ticket_tiers")
        .select("*")
        .eq("event_id", id)
        .order("sort_order"),
      supabaseAdmin
        .from("event_links")
        .select("*")
        .eq("event_id", id)
        .order("sort_order"),
      supabaseAdmin
        .from("event_themes")
        .select("*")
        .eq("event_id", id)
        .single(),
      supabaseAdmin
        .from("event_sections")
        .select("*")
        .eq("event_id", id)
        .order("sort_order"),
    ]);

    return NextResponse.json({
      data: {
        ...event,
        images: images.data ?? [],
        hosts: hosts.data ?? [],
        ticket_tiers: tiers.data ?? [],
        links: links.data ?? [],
        theme: theme.data ?? null,
        sections: sections.data ?? [],
      },
    });
  } catch (error) {
    console.error("GET /api/events/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/* ================================================================
   PUT /api/events/[id]
   Updates an existing event and all associated records.
   Accepts multipart/form-data.
================================================================ */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;

    /* ── Auth check ── */
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* ── Verify ownership ── */
    const { data: existing } = await supabaseAdmin
      .from("events")
      .select("creator_profile_id")
      .eq("id", eventId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    if (existing.creator_profile_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    /* Existing images the user kept (URLs) */
    const keepImageUrls: string[] = JSON.parse(
      (formData.get("keepImageUrls") as string) || "[]",
    );

    /* New carousel files */
    const carouselFiles: File[] = formData.getAll("images") as File[];

    /* Section files */
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

    /* ── Build timestamps ── */
    const startTs =
      startDate && startTime
        ? new Date(`${startDate}T${startTime}`).toISOString()
        : null;
    const endTs =
      endDate && endTime
        ? new Date(`${endDate}T${endTime}`).toISOString()
        : null;

    /* ── Handle carousel images ── */
    // Delete images that were removed by the user
    const { data: oldImages } = await supabaseAdmin
      .from("event_images")
      .select("url")
      .eq("event_id", eventId);

    const oldUrls = (oldImages ?? []).map((i) => i.url);
    const removedUrls = oldUrls.filter((u) => !keepImageUrls.includes(u));

    // Delete removed files from storage
    for (const url of removedUrls) {
      try {
        // Extract path from public URL: .../storage/v1/object/public/event_images/{path}
        const match = url.match(/\/event_images\/(.+)$/);
        if (match) {
          await supabaseAdmin.storage.from("event_images").remove([match[1]]);
        }
      } catch {
        // Best effort
      }
    }

    // Upload new files
    const newImageUrls: string[] = [];
    for (const file of carouselFiles) {
      const url = await uploadFile("event_images", eventId, file);
      newImageUrls.push(url);
    }

    const allImageUrls = [...keepImageUrls, ...newImageUrls];

    /* ── Upload section files ── */
    for (const [key, file] of sectionFileMap) {
      const parts = key.split("-");
      const secIdx = parseInt(parts[1], 10);
      const itemIdx = parseInt(parts[2], 10);
      const section = sections[secIdx];
      if (!section) continue;

      let bucket = "event_images";
      if (section.type === "panelists") bucket = "event_panelist_images";
      if (section.type === "companies") bucket = "event_company_logos";

      const url = await uploadFile(bucket, eventId, file);

      const items = (section.data as { items?: Record<string, unknown>[] })
        .items;
      if (items && items[itemIdx]) {
        if (section.type === "panelists") items[itemIdx].imageUrl = url;
        else if (section.type === "companies") items[itemIdx].logoUrl = url;
      }
    }

    /* ── Upsert location ── */
    let locationId: string | null = null;
    if (locationDisplayName && !isOnline) {
      // Delete old location if exists, insert new one
      const { data: oldEvent } = await supabaseAdmin
        .from("events")
        .select("location_id")
        .eq("id", eventId)
        .single();

      if (oldEvent?.location_id) {
        // Update existing location
        const { error: locErr } = await supabaseAdmin
          .from("event_locations")
          .update({
            venue: locationDisplayName,
            address: locationAddress,
            latitude: locationLat,
            longitude: locationLon,
          })
          .eq("id", oldEvent.location_id);
        if (!locErr) locationId = oldEvent.location_id;
      }

      if (!locationId) {
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
        if (locErr)
          throw new Error(`Location insert failed: ${locErr.message}`);
        locationId = loc.id;
      }
    }

    /* ── Update event row ── */
    const thumbnail = allImageUrls[0] ?? null;
    const { error: eventErr } = await supabaseAdmin
      .from("events")
      .update({
        name,
        description,
        start: startTs,
        end: endTs,
        is_online: isOnline,
        thumbnail,
        location_id: locationId,
        category,
        tags,
        timezone,
      })
      .eq("id", eventId);
    if (eventErr) throw new Error(`Event update failed: ${eventErr.message}`);

    /* ── Replace carousel images (delete all, re-insert) ── */
    await supabaseAdmin.from("event_images").delete().eq("event_id", eventId);
    if (allImageUrls.length > 0) {
      const rows = allImageUrls.map((url, i) => ({
        event_id: eventId,
        url,
        sort_order: i,
      }));
      await supabaseAdmin.from("event_images").insert(rows);
    }

    /* ── Replace hosts ── */
    await supabaseAdmin.from("event_hosts").delete().eq("event_id", eventId);
    const allHostIds = [user.id, ...hostIds.filter((hid) => hid !== user.id)];
    if (allHostIds.length > 0) {
      const rows = allHostIds.map((pid, i) => ({
        event_id: eventId,
        profile_id: pid,
        sort_order: i,
      }));
      await supabaseAdmin.from("event_hosts").insert(rows);
    }

    /* ── Replace ticket tiers ── */
    await supabaseAdmin
      .from("event_ticket_tiers")
      .delete()
      .eq("event_id", eventId);
    if (pricing.length > 0) {
      const rows = pricing.map((t, i) => ({
        event_id: eventId,
        label: t.label,
        price: t.price,
        sort_order: i,
      }));
      await supabaseAdmin.from("event_ticket_tiers").insert(rows);
    }

    /* ── Replace links ── */
    await supabaseAdmin.from("event_links").delete().eq("event_id", eventId);
    if (links.length > 0) {
      const rows = links.map((l, i) => ({
        event_id: eventId,
        url: l.url,
        title: l.title || null,
        sort_order: i,
      }));
      await supabaseAdmin.from("event_links").insert(rows);
    }

    /* ── Upsert theme ── */
    if (theme) {
      await supabaseAdmin.from("event_themes").delete().eq("event_id", eventId);
      await supabaseAdmin.from("event_themes").insert({
        event_id: eventId,
        mode: theme.mode,
        layout: theme.layout,
        accent: theme.accent,
        accent_custom: theme.accentCustom || null,
        bg_color: theme.bgColor || null,
      });
    }

    /* ── Replace sections ── */
    await supabaseAdmin.from("event_sections").delete().eq("event_id", eventId);
    if (sections.length > 0) {
      const rows = sections.map((s, i) => ({
        event_id: eventId,
        type: s.type,
        data: s.data,
        sort_order: i,
      }));
      await supabaseAdmin.from("event_sections").insert(rows);
    }

    return NextResponse.json({ id: eventId, message: "Event updated" });
  } catch (error) {
    console.error("PUT /api/events/[id] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
