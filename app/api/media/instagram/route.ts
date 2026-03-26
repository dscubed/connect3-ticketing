import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveManagedProfileId } from "@/lib/auth/clubAdmin";

/**
 * GET /api/media/instagram
 *
 * Returns all Instagram image URLs accessible to the authenticated user.
 * Queries instagram_posts directly for posts where the user's club slug
 * is the creator (posted_by) or appears in the collaborators array,
 * then flattens the images arrays into individual rows.
 */
export async function GET(request: NextRequest) {
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

    const requestedClubId = request.nextUrl.searchParams.get("club_id");
    const targetProfileId = await resolveManagedProfileId(
      requestedClubId,
      user.id,
    );

    if (requestedClubId && !targetProfileId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    /* ── Find the instagram slugs linked to the resolved profile ── */
    const { data: fetches, error: fetchError } = await supabaseAdmin
      .from("instagram_club_fetches")
      .select("instagram_slug")
      .eq("profile_id", targetProfileId);

    if (fetchError) {
      console.error("Instagram fetches lookup error:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const slugs = (fetches ?? []).map(
      (f: { instagram_slug: string }) => f.instagram_slug,
    );

    if (slugs.length === 0) {
      return NextResponse.json({ data: [] });
    }

    /* ── Fetch posts where the club is the creator OR a collaborator ── */
    const { data: posts, error: postsError } = await supabaseAdmin
      .from("instagram_posts")
      .select(
        "id, posted_by, caption, timestamp, location, images, fetched_at",
      )
      .or(
        `posted_by.in.(${slugs.map((s: string) => `"${s}"`).join(",")}),collaborators.ov.{${slugs.join(",")}}`,
      )
      .order("timestamp", { ascending: false });

    if (postsError) {
      console.error("Instagram posts fetch error:", postsError);
      return NextResponse.json(
        { error: postsError.message },
        { status: 500 },
      );
    }

    /* ── Flatten posts → individual image rows ── */
    const data = (posts ?? []).flatMap(
      (post: {
        id: string;
        posted_by: string;
        caption: string;
        timestamp: number | null;
        location: string | null;
        images: string[];
        fetched_at: string;
      }) =>
        (post.images ?? []).map((url: string) => ({
          post_id: post.id,
          posted_by: post.posted_by,
          caption: post.caption,
          post_timestamp: post.timestamp,
          location: post.location,
          image_url: url,
          fetched_at: post.fetched_at,
        })),
    );

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/media/instagram error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
