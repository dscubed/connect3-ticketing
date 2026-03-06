import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "media";

/**
 * POST /api/media/instagram/posts/import
 *
 * Import an Instagram post as a draft event:
 * 1. Uses the post ID as the event ID (prevents duplicate imports)
 * 2. Duplicates images → event storage bucket
 * 3. Maps caption → description
 * 4. Resolves the post owner as event creator, collaborators as hosts
 * 5. Returns eventId + detected collaborator profiles
 */
export async function POST(request: NextRequest) {
  try {
    /* ── Auth ── */
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* ── Parse body ── */
    const body = await request.json();
    const postId: string | undefined = body.postId;
    if (!postId) {
      return NextResponse.json(
        { error: "postId is required" },
        { status: 400 },
      );
    }

    /* ── Check if already imported (event ID = post ID) ── */
    const { data: existingEvent } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("id", postId)
      .maybeSingle();

    if (existingEvent) {
      return NextResponse.json(
        { error: "This post has already been imported", eventId: postId },
        { status: 409 },
      );
    }

    /* ── Fetch the Instagram post ── */
    const { data: post, error: postError } = await supabaseAdmin
      .from("instagram_posts")
      .select(
        "id, posted_by, caption, timestamp, location, images, collaborators",
      )
      .eq("id", postId)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: "Instagram post not found" },
        { status: 404 },
      );
    }

    /* ── Event ID = Post ID ── */
    const eventId = post.id;

    /* ── Resolve ALL slugs (posted_by + collaborators) → profiles ── */
    const everySlug = new Set<string>();
    if (post.posted_by) everySlug.add(post.posted_by);
    for (const c of post.collaborators ?? []) everySlug.add(c);

    const slugToProfileId: Record<string, string> = {};
    const profileMap = new Map<
      string,
      { id: string; first_name: string; avatar_url: string | null }
    >();

    if (everySlug.size > 0) {
      const { data: fetchRows } = await supabaseAdmin
        .from("instagram_club_fetches")
        .select("instagram_slug, profile_id")
        .in("instagram_slug", Array.from(everySlug));

      if (fetchRows && fetchRows.length > 0) {
        const profileIds = [...new Set(fetchRows.map((r) => r.profile_id))];

        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, first_name, avatar_url")
          .in("id", profileIds);

        for (const p of profiles ?? []) profileMap.set(p.id, p);
        for (const row of fetchRows)
          slugToProfileId[row.instagram_slug] = row.profile_id;
      }
    }

    /* ── Determine the event creator (the post owner) ── */
    const ownerProfileId = slugToProfileId[post.posted_by] ?? user.id;

    /* ── Build collaborator profiles list (everyone except the owner) ── */
    const collaboratorProfiles: {
      id: string;
      first_name: string;
      avatar_url: string | null;
      slug: string;
    }[] = [];
    const hostProfileIds: string[] = [];

    for (const slug of everySlug) {
      if (slug === post.posted_by) continue; // skip the owner
      const pid = slugToProfileId[slug];
      if (!pid) continue;
      const prof = profileMap.get(pid);
      if (prof) {
        collaboratorProfiles.push({
          id: prof.id,
          first_name: prof.first_name,
          avatar_url: prof.avatar_url,
          slug,
        });
        hostProfileIds.push(prof.id);
      }
    }

    // If the authenticated user is a collaborator (not the poster),
    // they should also appear as a host on the event.
    if (ownerProfileId !== user.id && !hostProfileIds.includes(user.id)) {
      hostProfileIds.push(user.id);
    }

    /* ── Duplicate images to event storage ── */
    const imageUrls: string[] = [];

    for (let i = 0; i < (post.images ?? []).length; i++) {
      const igUrl = post.images[i];
      try {
        const imgRes = await fetch(igUrl);
        if (!imgRes.ok) {
          console.warn(`Failed to fetch image ${i}: ${imgRes.status}`);
          continue;
        }

        const contentType = imgRes.headers.get("content-type") || "image/jpeg";
        const ext = contentType.includes("png") ? "png" : "jpg";
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const storagePath = `${ownerProfileId}/events/${eventId}/images/${uniqueName}`;

        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(storagePath, buffer, {
            contentType,
            upsert: false,
          });

        if (uploadErr) {
          console.warn(`Upload failed for image ${i}:`, uploadErr.message);
          continue;
        }

        const { data: urlData } = supabaseAdmin.storage
          .from(BUCKET)
          .getPublicUrl(storagePath);

        imageUrls.push(urlData.publicUrl);
      } catch (err) {
        console.warn(`Image duplication failed for index ${i}:`, err);
      }
    }

    /* ── Create draft event (creator = post owner) ── */
    const thumbnail = imageUrls[0] ?? null;

    const { error: eventErr } = await supabaseAdmin.from("events").insert({
      id: eventId,
      name: "",
      description: post.caption || null,
      start: null,
      end: null,
      creator_profile_id: ownerProfileId,
      status: "draft",
      published_at: null,
      is_online: false,
      thumbnail,
      location_id: null,
      category: null,
      tags: [],
      timezone: null,
      source: "instagram",
    });

    if (eventErr) {
      throw new Error(`Event insert failed: ${eventErr.message}`);
    }

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

    /* ── Insert hosts (collaborators + current user if not owner) ── */
    const uniqueHostIds = [...new Set(hostProfileIds)].filter(
      (id) => id !== ownerProfileId,
    );
    if (uniqueHostIds.length > 0) {
      const rows = uniqueHostIds.map((pid, i) => ({
        event_id: eventId,
        profile_id: pid,
        sort_order: i,
        // Current user is auto-accepted; everyone else is pending
        status: pid === user.id ? "accepted" : "pending",
        inviter_id: user.id,
      }));
      const { error } = await supabaseAdmin.from("event_hosts").insert(rows);
      if (error) console.error("event_hosts insert error:", error);
    }

    return NextResponse.json({
      eventId,
      collaboratorProfiles,
      imageCount: imageUrls.length,
    });
  } catch (error) {
    console.error("POST /api/media/instagram/posts/import error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
