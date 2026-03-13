import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkEventPermission } from "@/lib/auth/clubAdmin";
import { buildUtcTimestamp } from "@/lib/utils/timezone";

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
interface LocationPayload {
  displayName: string;
  address: string;
  lat?: number;
  lon?: number;
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
          "profile_id, sort_order, status, inviter_id, profiles:profile_id(id, first_name, avatar_url)",
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
   Accepts JSON body. All images are already uploaded as URLs.
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

    /* ── Verify ownership, accepted collaborator, or club admin ── */
    const { isCreator, isCollaborator, isClubAdmin } =
      await checkEventPermission(eventId, user.id);

    if (!isCreator && !isCollaborator && !isClubAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    /* ── Parse JSON body ── */
    const body = await request.json();

    const name: string = body.name ?? "";
    const description: string | null = body.description || null;
    const startDate: string = body.startDate;
    const startTime: string = body.startTime;
    const endDate: string | null = body.endDate || null;
    const endTime: string | null = body.endTime || null;
    const timezone: string | null = body.timezone || null;
    const isOnline: boolean = body.isOnline ?? false;
    const category: string | null = body.category || null;
    const tags: string[] = body.tags ?? [];
    const hostIds: string[] = body.hostIds ?? [];
    const pricing: TicketTierPayload[] = body.pricing ?? [];
    const links: EventLinkPayload[] = body.links ?? [];
    const theme: ThemePayload | null = body.theme ?? null;
    const location: LocationPayload | null = body.location ?? null;
    const imageUrls: string[] = body.imageUrls ?? [];
    const sections: SectionPayload[] = body.sections ?? [];
    const eventStatus: string | undefined = body.status;

    /* Name is required only when publishing */
    if (eventStatus === "published" && !name) {
      return NextResponse.json(
        { error: "Event name is required" },
        { status: 400 },
      );
    }

    /* Block publishing if there are pending collaborators */
    if (eventStatus === "published") {
      const { data: pendingHosts } = await supabaseAdmin
        .from("event_hosts")
        .select("id")
        .eq("event_id", eventId)
        .eq("status", "pending");
      if (pendingHosts && pendingHosts.length > 0) {
        return NextResponse.json(
          {
            error:
              "Cannot publish: all collaborators must accept their invites first.",
          },
          { status: 400 },
        );
      }
    }

    /* ── Build timestamps ── */
    const startTs = buildUtcTimestamp(startDate, startTime, timezone);
    const endTs = buildUtcTimestamp(endDate, endTime, timezone);

    /* ── Clean up removed carousel images from storage ── */
    const { data: oldImages } = await supabaseAdmin
      .from("event_images")
      .select("url")
      .eq("event_id", eventId);

    const oldUrls = (oldImages ?? []).map((i) => i.url);
    const removedUrls = oldUrls.filter((u) => !imageUrls.includes(u));

    for (const url of removedUrls) {
      try {
        const match = url.match(/\/media\/(.+)$/);
        if (match) {
          await supabaseAdmin.storage.from("media").remove([match[1]]);
        }
      } catch {
        // Best effort
      }
    }

    /* ── Upsert location ── */
    let locationId: string | null = null;
    if (location?.displayName && !isOnline) {
      const { data: oldEvent } = await supabaseAdmin
        .from("events")
        .select("location_id")
        .eq("id", eventId)
        .single();

      if (oldEvent?.location_id) {
        const { error: locErr } = await supabaseAdmin
          .from("event_locations")
          .update({
            venue: location.displayName,
            address: location.address || null,
            latitude: location.lat ?? null,
            longitude: location.lon ?? null,
          })
          .eq("id", oldEvent.location_id);
        if (!locErr) locationId = oldEvent.location_id;
      }

      if (!locationId) {
        const { data: loc, error: locErr } = await supabaseAdmin
          .from("event_locations")
          .insert({
            venue: location.displayName,
            address: location.address || null,
            latitude: location.lat ?? null,
            longitude: location.lon ?? null,
          })
          .select("id")
          .single();
        if (locErr)
          throw new Error(`Location insert failed: ${locErr.message}`);
        locationId = loc.id;
      }
    }

    /* ── Update event row ── */
    const thumbnail = imageUrls[0] ?? null;
    const updatePayload: Record<string, unknown> = {
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
    };
    if (eventStatus) {
      updatePayload.status = eventStatus;
      if (eventStatus === "published") {
        updatePayload.published_at = new Date().toISOString();
      }
    }
    const { error: eventErr } = await supabaseAdmin
      .from("events")
      .update(updatePayload)
      .eq("id", eventId);
    if (eventErr) throw new Error(`Event update failed: ${eventErr.message}`);

    /* ── Replace carousel images ── */
    await supabaseAdmin.from("event_images").delete().eq("event_id", eventId);
    if (imageUrls.length > 0) {
      const rows = imageUrls.map((url, i) => ({
        event_id: eventId,
        url,
        sort_order: i,
      }));
      await supabaseAdmin.from("event_images").insert(rows);
    }

    /* ── Hosts are managed through the invite flow ── */
    /* Collaborators are added/removed via /api/events/[id]/invites.
       No display-only host rows are created here. */

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

/* ================================================================
   PATCH /api/events/[id]
   Field-level partial update.
   Body: { fields: string[], ...partialPayload }
   `fields` lists which field groups to update.
   Valid groups: event, location, images, hosts, pricing, links, theme, section:<type>
   Only the listed groups are touched — everything else is left alone.
================================================================ */
export async function PATCH(
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

    /* ── Verify ownership, accepted collaborator, or club admin ── */
    const { data: existing } = await supabaseAdmin
      .from("events")
      .select("creator_profile_id, location_id")
      .eq("id", eventId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const patchPerm = await checkEventPermission(eventId, user.id);
    if (
      !patchPerm.isCreator &&
      !patchPerm.isCollaborator &&
      !patchPerm.isClubAdmin
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const groups: string[] = body.fields ?? [];

    if (groups.length === 0) {
      return NextResponse.json({ id: eventId, message: "Nothing to update" });
    }

    const updatedGroups: string[] = [];

    /* ── event (main row columns) ── */
    if (groups.includes("event")) {
      const payload: Record<string, unknown> = {};
      if ("name" in body) payload.name = body.name ?? "";
      if ("description" in body) payload.description = body.description || null;
      if ("category" in body) payload.category = body.category || null;
      if ("tags" in body) payload.tags = body.tags ?? [];
      if ("isOnline" in body) payload.is_online = body.isOnline ?? false;
      if ("timezone" in body) payload.timezone = body.timezone || null;
      if ("startDate" in body || "startTime" in body) {
        const sd = body.startDate;
        const st = body.startTime;
        payload.start = buildUtcTimestamp(sd, st, body.timezone);
      }
      if ("endDate" in body || "endTime" in body) {
        const ed = body.endDate;
        const et = body.endTime;
        payload.end = buildUtcTimestamp(ed, et, body.timezone);
      }
      if ("status" in body) {
        payload.status = body.status;
        if (body.status === "published") {
          payload.published_at = new Date().toISOString();
        }
      }

      /* Block publishing if there are pending collaborators */
      if (body.status === "published") {
        const { data: pendingHosts } = await supabaseAdmin
          .from("event_hosts")
          .select("id")
          .eq("event_id", eventId)
          .eq("status", "pending");
        if (pendingHosts && pendingHosts.length > 0) {
          return NextResponse.json(
            {
              error:
                "Cannot publish: all collaborators must accept their invites first.",
            },
            { status: 400 },
          );
        }
      }

      if (Object.keys(payload).length > 0) {
        const { error } = await supabaseAdmin
          .from("events")
          .update(payload)
          .eq("id", eventId);
        if (error) throw new Error(`Event update failed: ${error.message}`);
        updatedGroups.push("event");
      }
    }

    /* ── location ── */
    if (groups.includes("location")) {
      const location: LocationPayload | null = body.location ?? null;
      const isOnline = body.isOnline ?? false;
      let locationId: string | null = null;

      if (location?.displayName && !isOnline) {
        if (existing.location_id) {
          const { error: locErr } = await supabaseAdmin
            .from("event_locations")
            .update({
              venue: location.displayName,
              address: location.address || null,
              latitude: location.lat ?? null,
              longitude: location.lon ?? null,
            })
            .eq("id", existing.location_id);
          if (!locErr) locationId = existing.location_id;
        }
        if (!locationId) {
          const { data: loc, error: locErr } = await supabaseAdmin
            .from("event_locations")
            .insert({
              venue: location.displayName,
              address: location.address || null,
              latitude: location.lat ?? null,
              longitude: location.lon ?? null,
            })
            .select("id")
            .single();
          if (locErr)
            throw new Error(`Location insert failed: ${locErr.message}`);
          locationId = loc.id;
        }
      }
      await supabaseAdmin
        .from("events")
        .update({ location_id: locationId })
        .eq("id", eventId);
      updatedGroups.push("location");
    }

    /* ── images ── */
    if (groups.includes("images")) {
      const imageUrls: string[] = body.imageUrls ?? [];

      /* Clean up removed images from storage */
      const { data: oldImages } = await supabaseAdmin
        .from("event_images")
        .select("url")
        .eq("event_id", eventId);
      const oldUrls = (oldImages ?? []).map((i) => i.url);
      const removedUrls = oldUrls.filter((u) => !imageUrls.includes(u));
      for (const url of removedUrls) {
        try {
          const match = url.match(/\/media\/(.+)$/);
          if (match) {
            await supabaseAdmin.storage.from("media").remove([match[1]]);
          }
        } catch {
          /* best effort */
        }
      }

      await supabaseAdmin.from("event_images").delete().eq("event_id", eventId);
      if (imageUrls.length > 0) {
        const rows = imageUrls.map((url, i) => ({
          event_id: eventId,
          url,
          sort_order: i,
        }));
        await supabaseAdmin.from("event_images").insert(rows);
      }
      /* Update thumbnail on event row */
      await supabaseAdmin
        .from("events")
        .update({ thumbnail: imageUrls[0] ?? null })
        .eq("id", eventId);
      updatedGroups.push("images");
    }

    /* ── hosts ── */
    if (groups.includes("hosts")) {
      /* Hosts are managed through the invite flow
         (POST/DELETE /api/events/[id]/invites).
         The "hosts" group is acknowledged so auto-save considers it synced. */
      updatedGroups.push("hosts");
    }

    /* ── pricing ── */
    if (groups.includes("pricing")) {
      const pricing: TicketTierPayload[] = body.pricing ?? [];
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
      updatedGroups.push("pricing");
    }

    /* ── links ── */
    if (groups.includes("links")) {
      const linkItems: EventLinkPayload[] = body.links ?? [];
      await supabaseAdmin.from("event_links").delete().eq("event_id", eventId);
      if (linkItems.length > 0) {
        const rows = linkItems.map((l, i) => ({
          event_id: eventId,
          url: l.url,
          title: l.title || null,
          sort_order: i,
        }));
        await supabaseAdmin.from("event_links").insert(rows);
      }
      updatedGroups.push("links");
    }

    /* ── theme ── */
    if (groups.includes("theme")) {
      const theme: ThemePayload | null = body.theme ?? null;
      if (theme) {
        await supabaseAdmin
          .from("event_themes")
          .delete()
          .eq("event_id", eventId);
        await supabaseAdmin.from("event_themes").insert({
          event_id: eventId,
          mode: theme.mode,
          layout: theme.layout,
          accent: theme.accent,
          accent_custom: theme.accentCustom || null,
          bg_color: theme.bgColor || null,
        });
      }
      updatedGroups.push("theme");
    }

    /* ── Per-section upserts (section:faq, section:panelists, etc.) ── */
    /* ── Per-section upserts (section:faq, section:panelists, etc.) ── */
    const sectionItems: SectionPayload[] = body.sectionItems ?? [];
    for (const s of sectionItems) {
      await supabaseAdmin
        .from("event_sections")
        .delete()
        .eq("event_id", eventId)
        .eq("type", s.type);

      await supabaseAdmin.from("event_sections").insert({
        event_id: eventId,
        type: s.type,
        data: s.data,
        sort_order: 0,
      });
      updatedGroups.push(`section:${s.type}`);
    }

    /* ── Per-section deletes ── */
    const deletedSections: string[] = body.deletedSections ?? [];
    for (const type of deletedSections) {
      await supabaseAdmin
        .from("event_sections")
        .delete()
        .eq("event_id", eventId)
        .eq("type", type);
      updatedGroups.push(`section:${type}`);
    }

    /* ── Re-sync sort_order from client hint ── */
    const sectionOrder: string[] | undefined = body.sectionOrder;
    if (sectionOrder && sectionOrder.length > 0) {
      for (let i = 0; i < sectionOrder.length; i++) {
        await supabaseAdmin
          .from("event_sections")
          .update({ sort_order: i })
          .eq("event_id", eventId)
          .eq("type", sectionOrder[i]);
      }
    }

    return NextResponse.json({
      id: eventId,
      updated: updatedGroups,
      message: "Partial update complete",
    });
  } catch (error) {
    console.error("PATCH /api/events/[id] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

/* ================================================================
   DELETE /api/events/[id]
   Deletes an event and all associated records.
   Only the event creator can delete.
================================================================ */
export async function DELETE(
  _request: NextRequest,
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

    /* ── Verify the event exists and user is the creator or club admin ── */
    const { data: event, error: fetchError } = await supabaseAdmin
      .from("events")
      .select("id, creator_profile_id")
      .eq("id", eventId)
      .single();

    if (fetchError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const delPerm = await checkEventPermission(eventId, user.id);
    if (!delPerm.isCreator && !delPerm.isClubAdmin) {
      return NextResponse.json(
        {
          error: "Only the event creator or a club admin can delete this event",
        },
        { status: 403 },
      );
    }

    /* ── Delete related records in parallel ── */
    await Promise.all([
      supabaseAdmin.from("event_images").delete().eq("event_id", eventId),
      supabaseAdmin.from("event_hosts").delete().eq("event_id", eventId),
      supabaseAdmin.from("event_ticket_tiers").delete().eq("event_id", eventId),
      supabaseAdmin.from("event_links").delete().eq("event_id", eventId),
      supabaseAdmin.from("event_themes").delete().eq("event_id", eventId),
      supabaseAdmin.from("event_sections").delete().eq("event_id", eventId),
    ]);

    /* ── Delete the event itself ── */
    const { error: deleteError } = await supabaseAdmin
      .from("events")
      .delete()
      .eq("id", eventId);

    if (deleteError) {
      throw new Error(`Event delete failed: ${deleteError.message}`);
    }

    /* ── Clean up storage (best-effort) ── */
    try {
      const { data: files } = await supabaseAdmin.storage
        .from("media")
        .list(`${user.id}/events/${eventId}/images`);
      if (files && files.length > 0) {
        const paths = files.map(
          (f) => `${user.id}/events/${eventId}/images/${f.name}`,
        );
        await supabaseAdmin.storage.from("media").remove(paths);
      }
    } catch {
      // Non-critical — storage cleanup failure shouldn't block delete
    }

    return NextResponse.json({ message: "Event deleted" });
  } catch (error) {
    console.error("DELETE /api/events/[id] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
