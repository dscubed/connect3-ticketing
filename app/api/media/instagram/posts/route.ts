import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/media/instagram/posts
 *
 * Returns all Instagram posts accessible to the authenticated user's club,
 * including posts where the club is the creator (posted_by) OR a collaborator.
 *
 * Also returns a `slugToProfile` map so the client can resolve collaborator
 * slugs to club profiles (avatar + name) without extra round-trips.
 *
 * Uses the admin client because Instagram tables have no RLS policies.
 */
export async function GET() {
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

    /* ── Find the instagram slugs linked to this user's profile ── */
    const { data: fetches, error: fetchError } = await supabaseAdmin
      .from("instagram_club_fetches")
      .select("instagram_slug")
      .eq("profile_id", user.id);

    if (fetchError) {
      console.error("Instagram fetches lookup error:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const slugs = (fetches ?? []).map((f) => f.instagram_slug);

    if (slugs.length === 0) {
      return NextResponse.json({ data: [], slugToProfile: {} });
    }

    /* ── Get post IDs from the junction table for these slugs ── */
    const { data: clubPosts, error: cpError } = await supabaseAdmin
      .from("instagram_club_posts")
      .select("post_id")
      .in("instagram_slug", slugs);

    if (cpError) {
      console.error("Instagram club posts lookup error:", cpError);
      return NextResponse.json({ error: cpError.message }, { status: 500 });
    }

    const postIdsFromSlugs = new Set((clubPosts ?? []).map((cp) => cp.post_id));

    /* ── Also get posts where this club's slug is in the collaborators array ── */
    const { data: collabPosts, error: collabError } = await supabaseAdmin
      .from("instagram_posts")
      .select("id")
      .overlaps("collaborators", slugs);

    if (collabError) {
      console.error("Instagram collab posts lookup error:", collabError);
      return NextResponse.json({ error: collabError.message }, { status: 500 });
    }

    for (const cp of collabPosts ?? []) {
      postIdsFromSlugs.add(cp.id);
    }

    const allPostIds = Array.from(postIdsFromSlugs);

    if (allPostIds.length === 0) {
      return NextResponse.json({ data: [], slugToProfile: {} });
    }

    /* ── Fetch the actual post data ── */
    const { data: posts, error: postsError } = await supabaseAdmin
      .from("instagram_posts")
      .select(
        "id, posted_by, caption, timestamp, location, images, collaborators, fetched_at",
      )
      .in("id", allPostIds)
      .order("timestamp", { ascending: false });

    if (postsError) {
      console.error("Instagram posts fetch error:", postsError);
      return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    /* ── Build slug → profile map for collaborator resolution ── */
    // Collect all unique slugs across posted_by + collaborators
    const allSlugs = new Set<string>();
    for (const p of posts ?? []) {
      if (p.posted_by) allSlugs.add(p.posted_by);
      for (const c of p.collaborators ?? []) allSlugs.add(c);
    }

    const slugToProfile: Record<
      string,
      {
        id: string;
        first_name: string;
        avatar_url: string | null;
        slug: string;
      }
    > = {};

    if (allSlugs.size > 0) {
      const { data: fetchRows } = await supabaseAdmin
        .from("instagram_club_fetches")
        .select("instagram_slug, profile_id")
        .in("instagram_slug", Array.from(allSlugs));

      if (fetchRows && fetchRows.length > 0) {
        const profileIds = [...new Set(fetchRows.map((r) => r.profile_id))];

        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, first_name, avatar_url")
          .in("id", profileIds);

        const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

        for (const row of fetchRows) {
          const prof = profileMap.get(row.profile_id);
          if (prof) {
            slugToProfile[row.instagram_slug] = {
              id: prof.id,
              first_name: prof.first_name,
              avatar_url: prof.avatar_url,
              slug: row.instagram_slug,
            };
          }
        }
      }
    }

    return NextResponse.json({ data: posts ?? [], slugToProfile });
  } catch (error) {
    console.error("GET /api/media/instagram/posts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
