import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveManagedProfileId } from "@/lib/auth/clubAdmin";
import { buildUtcTimestamp } from "@/lib/utils/timezone";

const BUCKET = "media";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const EVENT_CATEGORIES = [
  "Social",
  "Academic",
  "Sports",
  "Music",
  "Arts & Culture",
  "Networking",
  "Workshop",
  "Fundraiser",
  "Other",
] as const;

type EventCategory = (typeof EVENT_CATEGORIES)[number];

const EVENT_TAGS = [
  "Free",
  "Paid",
  "Food & Drinks",
  "Outdoor",
  "Indoor",
  "Live Music",
  "Networking",
  "Career",
  "Party",
  "Cultural",
  "Competition",
  "Charity",
  "Tech",
  "Study",
] as const;

type EventTag = (typeof EVENT_TAGS)[number];

type EasyImportFAQ = {
  question: string;
  answer: string;
};

type EasyImportResult = {
  name: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  timezone: string | null;
  location_type: "physical" | "custom" | "online" | "tba" | null;
  location_name: string | null;
  location_address: string | null;
  online_link: string | null;
  category: EventCategory | null;
  tags: EventTag[] | null;
  faqs: EasyImportFAQ[] | null;
};

function isValidDate(value: string | null) {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value: string | null) {
  if (!value) return false;
  return /^\d{2}:\d{2}$/.test(value);
}

function normalizeString(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeCategory(value: string | null): EventCategory | null {
  if (!value) return null;
  return EVENT_CATEGORIES.includes(value as EventCategory)
    ? (value as EventCategory)
    : null;
}

function getValidatedTimeZone(timeZone?: string | null) {
  if (!timeZone) return null;
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return null;
  }
}

async function extractEasyImportDetails({
  caption,
  location,
}: {
  caption: string;
  location: string | null;
}): Promise<EasyImportResult | null> {
  if (!OPENAI_API_KEY) return null;

  const today = new Date().toISOString().slice(0, 10);
  const prompt = [
    "Extract event details from the Instagram caption below.",
    "Return only JSON that matches the provided schema.",
    "Use null when information is missing or uncertain.",
    "Extract a short event name (3-8 words) if possible; avoid emojis and trailing punctuation.",
    "Dates must be YYYY-MM-DD. Times must be 24h HH:MM.",
    "If a date is given without a year, infer the next occurrence after today; otherwise return null.",
    "If end_time is present but end_date is missing, set end_date to start_date.",
    "Only include a timezone if it is explicitly mentioned; use IANA names (e.g. Australia/Melbourne).",
    "If an online meeting link is present, set location_type to online and include online_link.",
    "Choose a category from this list or return null: " +
      EVENT_CATEGORIES.join(", "),
    "Extract up to 5 tags from this list if clearly implied; otherwise return null: " +
      EVENT_TAGS.join(", "),
    "If the caption contains explicit FAQ-style Q/A (e.g. 'Q:'/'A:' or an 'FAQ' section), extract them into faqs as question/answer pairs. Otherwise return null.",
    "",
    `Today: ${today}`,
    "",
    `Caption: ${caption || "(empty)"}`,
    location ? `Instagram location field: ${location}` : "Instagram location field: (none)",
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      temperature: 1,
      messages: [
        {
          role: "system",
          content:
            "You are a precise information extraction assistant. Return only JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "event_easy_import",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: ["string", "null"] },
              start_date: { type: ["string", "null"] },
              start_time: { type: ["string", "null"] },
              end_date: { type: ["string", "null"] },
              end_time: { type: ["string", "null"] },
              timezone: { type: ["string", "null"] },
              location_type: {
                type: ["string", "null"],
                enum: ["physical", "custom", "online", "tba", null],
              },
              location_name: { type: ["string", "null"] },
              location_address: { type: ["string", "null"] },
              online_link: { type: ["string", "null"] },
              category: {
                type: ["string", "null"],
                enum: [...EVENT_CATEGORIES, null],
              },
              tags: {
                type: ["array", "null"],
                items: { type: "string", enum: EVENT_TAGS },
                maxItems: 5,
              },
              faqs: {
                type: ["array", "null"],
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    question: { type: "string" },
                    answer: { type: "string" },
                  },
                  required: ["question", "answer"],
                },
                maxItems: 5,
              },
            },
            required: [
              "name",
              "start_date",
              "start_time",
              "end_date",
              "end_time",
              "timezone",
              "location_type",
              "location_name",
              "location_address",
              "online_link",
              "category",
              "tags",
              "faqs",
            ],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.warn("Easy import extraction failed:", err);
    return null;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    return JSON.parse(content) as EasyImportResult;
  } catch (err) {
    console.warn("Easy import JSON parse failed:", err);
    return null;
  }
}

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
    const easyImport: boolean = body.easyImport === true;
    const clientTimezone =
      typeof body.clientTimezone === "string" ? body.clientTimezone : undefined;
    const requestedClubId =
      typeof body.clubId === "string" ? body.clubId : undefined;
    if (!postId) {
      return NextResponse.json(
        { error: "postId is required" },
        { status: 400 },
      );
    }

    const creatorProfileId = await resolveManagedProfileId(
      requestedClubId,
      user.id,
    );

    if (requestedClubId && !creatorProfileId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    /* ── Optional LLM extraction ── */
    let easyImportDetails: EasyImportResult | null = null;
    if (easyImport) {
      try {
        easyImportDetails = await extractEasyImportDetails({
          caption: post.caption ?? "",
          location: post.location ?? null,
        });
      } catch (err) {
        console.warn("Easy import extraction error:", err);
      }
    }

    const normalizedTimezone = getValidatedTimeZone(
      normalizeString(easyImportDetails?.timezone ?? null),
    );
    const resolvedTimezone =
      normalizedTimezone ?? getValidatedTimeZone(clientTimezone ?? null);

    const startDate = isValidDate(easyImportDetails?.start_date ?? null)
      ? easyImportDetails?.start_date ?? null
      : null;
    const startTime = isValidTime(easyImportDetails?.start_time ?? null)
      ? easyImportDetails?.start_time ?? null
      : null;
    let endDate = isValidDate(easyImportDetails?.end_date ?? null)
      ? easyImportDetails?.end_date ?? null
      : null;
    const endTime = isValidTime(easyImportDetails?.end_time ?? null)
      ? easyImportDetails?.end_time ?? null
      : null;
    if (!endDate && startDate && endTime) {
      endDate = startDate;
    }

    let locationType = easyImportDetails?.location_type ?? null;
    const locationName = normalizeString(easyImportDetails?.location_name ?? null);
    const locationAddress = normalizeString(
      easyImportDetails?.location_address ?? null,
    );
    const onlineLink = normalizeString(easyImportDetails?.online_link ?? null);

    if (!locationType) {
      if (onlineLink) {
        locationType = "online";
      } else if (locationName || locationAddress) {
        locationType = "custom";
      }
    }
    if (
      locationType &&
      locationType !== "online" &&
      !locationName &&
      !locationAddress
    ) {
      locationType = "tba";
    }

    const category = normalizeCategory(easyImportDetails?.category ?? null);
    const extractedTags = Array.from(
      new Set(
        (easyImportDetails?.tags ?? [])
          .map((tag) => normalizeString(tag) as EventTag | null)
          .filter((tag): tag is EventTag => !!tag && EVENT_TAGS.includes(tag)),
      ),
    ).slice(0, 5);
    const tags = extractedTags.length > 0 ? extractedTags : [];
    const extractedName = normalizeString(easyImportDetails?.name ?? null);
    const faqItems = (easyImportDetails?.faqs ?? [])
      .map((faq) => ({
        question: normalizeString(faq.question) ?? "",
        answer: normalizeString(faq.answer) ?? "",
      }))
      .filter((faq) => faq.question && faq.answer)
      .slice(0, 5);
    let safeName: string | null = extractedName;
    if (safeName) {
      try {
        const { data: existingName, error: nameCheckError } =
          await supabaseAdmin
            .from("events")
            .select("id")
            .eq("creator_profile_id", creatorProfileId)
            .eq("name", safeName)
            .limit(1);
        if (nameCheckError) {
          console.warn("Easy import name check failed:", nameCheckError.message);
          safeName = null;
        } else if (existingName && existingName.length > 0) {
          safeName = null;
        }
      } catch (err) {
        console.warn("Easy import name check error:", err);
        safeName = null;
      }
    }

    const startTimestamp =
      startDate && startTime
        ? buildUtcTimestamp(startDate, startTime, resolvedTimezone)
        : null;
    const endTimestamp =
      endDate && endTime
        ? buildUtcTimestamp(endDate, endTime, resolvedTimezone)
        : null;

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

    const { data: creatorFetches, error: creatorFetchesError } =
      await supabaseAdmin
        .from("instagram_club_fetches")
        .select("instagram_slug")
        .eq("profile_id", creatorProfileId);

    if (creatorFetchesError) {
      return NextResponse.json(
        { error: creatorFetchesError.message },
        { status: 500 },
      );
    }

    const creatorSlugs = (creatorFetches ?? []).map(
      (row) => row.instagram_slug,
    );
    const hasAccessToPost = creatorSlugs.some(
      (slug) =>
        slug === post.posted_by || (post.collaborators ?? []).includes(slug),
    );

    if (!hasAccessToPost) {
      return NextResponse.json(
        { error: "Selected club cannot import this Instagram post" },
        { status: 403 },
      );
    }

    /* ── Build collaborator profiles list (everyone except the owner) ── */
    const collaboratorProfiles: {
      id: string;
      first_name: string;
      avatar_url: string | null;
      slug: string;
    }[] = [];
    const hostProfileIds: string[] = [];

    for (const slug of everySlug) {
      const pid = slugToProfileId[slug];
      if (!pid || pid === creatorProfileId) continue;
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
        const storagePath = `${creatorProfileId}/events/${eventId}/images/${uniqueName}`;

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
      name: safeName,
      description: post.caption || null,
      start: startTimestamp,
      end: endTimestamp,
      creator_profile_id: creatorProfileId,
      status: "draft",
      published_at: null,
      is_online: locationType === "online",
      // thumbnail,
      // location_id: null,
      category,
      tags,
      timezone: resolvedTimezone,
      source: "instagram",
      location_type: locationType ?? "tba",
      online_link: locationType === "online" ? onlineLink : null,
    });

    if (eventErr) {
      throw new Error(`Event insert failed: ${eventErr.message}`);
    }

    /* ── Insert FAQ section (if any) ── */
    if (faqItems.length > 0) {
      await supabaseAdmin.from("event_sections").insert({
        event_id: eventId,
        type: "faq",
        data: { items: faqItems },
        sort_order: 0,
      });
    }

    /* ── Insert a venue for easy import (physical/custom only) ── */
    if (
      locationType &&
      locationType !== "online" &&
      locationType !== "tba" &&
      (locationName || locationAddress)
    ) {
      await supabaseAdmin.from("event_venues").insert({
        event_id: eventId,
        type: locationType,
        venue: locationName,
        address: locationAddress,
        latitude: null,
        longitude: null,
        online_link: null,
        sort_order: 0,
      });
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
      (id) => id !== creatorProfileId,
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
