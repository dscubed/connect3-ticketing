import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveManagedProfileId } from "@/lib/auth/clubAdmin";

/**
 * /events/create — creates a bare draft event and redirects to the editor.
 *
 * Supported query params:
 *   ?ig_post_id=xxx  — links the new draft to an Instagram post (for future use)
 *   ?source=xxx      — records where the event creation was triggered from
 *   ?club_id=xxx     — creates the event under a club (user must be a club admin)
 *
 * Auth is required — unauthenticated users are sent to the home page.
 */
export default async function CreateEventPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  /* ── Auth check ── */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  /* ── Read optional query params ── */
  const params = await searchParams;
  const igPostId =
    typeof params.ig_post_id === "string" ? params.ig_post_id : undefined;
  const source = typeof params.source === "string" ? params.source : "connect3";
  const clubId =
    typeof params.club_id === "string" ? params.club_id : undefined;

  /* ── If club_id provided, verify user can create on behalf of that profile ── */
  const creatorProfileId = await resolveManagedProfileId(clubId, user.id);
  if (clubId && !creatorProfileId) {
    redirect("/dashboard/events");
  }

  /* ── Create a minimal draft row ── */
  const eventId = nanoid(21);

  const { error } = await supabaseAdmin.from("events").insert({
    id: eventId,
    name: "",
    description: null,
    start: null,
    end: null,
    creator_profile_id: creatorProfileId,
    status: "draft",
    published_at: null,
    is_online: false,
    // thumbnail: null,
    // location_id: null,
    category: null,
    tags: [],
    timezone: null,
    source,
    ...(igPostId ? { ig_post_id: igPostId } : {}),
  });

  if (error) {
    console.error("Failed to create draft event:", error);
    redirect("/");
  }

  /* ── Redirect to the editor ── */
  redirect(`/events/${eventId}/edit`);
}
