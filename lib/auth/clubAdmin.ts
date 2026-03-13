import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Check if a user is an accepted admin for a given club.
 * Returns the admin row if found, null otherwise.
 */
export async function getClubAdminRow(clubId: string, userId: string) {
  console.log(
    "[getClubAdminRow] querying club_admins — clubId:",
    clubId,
    "userId:",
    userId,
  );
  const { data, error } = await supabaseAdmin
    .from("club_admins")
    .select("id, club_id, user_id, role, status")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();
  console.log(
    "[getClubAdminRow] data:",
    JSON.stringify(data),
    "error:",
    JSON.stringify(error),
  );
  return data;
}

export async function resolveManagedProfileId(
  requestedProfileId: string | null | undefined,
  userId: string,
): Promise<string | null> {
  if (!requestedProfileId) {
    return userId;
  }

  if (requestedProfileId === userId) {
    return requestedProfileId;
  }

  const adminRow = await getClubAdminRow(requestedProfileId, userId);
  return adminRow ? requestedProfileId : null;
}

/**
 * Check if a user has permission to manage an event.
 * Returns:
 *  - isCreator: the user owns the event directly
 *  - isCollaborator: the user is an accepted event_host
 *  - isClubAdmin: the user is an accepted admin for the club that created the event
 */
export async function checkEventPermission(
  eventId: string,
  userId: string,
): Promise<{
  isCreator: boolean;
  isCollaborator: boolean;
  isClubAdmin: boolean;
  creatorProfileId: string | null;
}> {
  /* Fetch the event creator */
  const { data: event } = await supabaseAdmin
    .from("events")
    .select("creator_profile_id")
    .eq("id", eventId)
    .single();

  if (!event) {
    return {
      isCreator: false,
      isCollaborator: false,
      isClubAdmin: false,
      creatorProfileId: null,
    };
  }

  const creatorProfileId = event.creator_profile_id;
  const isCreator = creatorProfileId === userId;

  if (isCreator) {
    return {
      isCreator: true,
      isCollaborator: false,
      isClubAdmin: false,
      creatorProfileId,
    };
  }

  /* Check if user is an accepted collaborator on the event */
  const { data: hostRow } = await supabaseAdmin
    .from("event_hosts")
    .select("status")
    .eq("event_id", eventId)
    .eq("profile_id", userId)
    .eq("status", "accepted")
    .maybeSingle();

  if (hostRow) {
    return {
      isCreator: false,
      isCollaborator: true,
      isClubAdmin: false,
      creatorProfileId,
    };
  }

  /* Check if user is a club admin for the event's creator (organisation) */
  if (creatorProfileId) {
    const adminRow = await getClubAdminRow(creatorProfileId, userId);
    if (adminRow) {
      return {
        isCreator: false,
        isCollaborator: false,
        isClubAdmin: true,
        creatorProfileId,
      };
    }
  }

  /* Check if user is a club admin for any collaborator org on the event */
  const { data: allHosts } = await supabaseAdmin
    .from("event_hosts")
    .select("profile_id")
    .eq("event_id", eventId)
    .eq("status", "accepted");

  if (allHosts && allHosts.length > 0) {
    for (const host of allHosts) {
      const adminRow = await getClubAdminRow(host.profile_id, userId);
      if (adminRow) {
        return {
          isCreator: false,
          isCollaborator: false,
          isClubAdmin: true,
          creatorProfileId,
        };
      }
    }
  }

  return {
    isCreator: false,
    isCollaborator: false,
    isClubAdmin: false,
    creatorProfileId,
  };
}

/**
 * Get all club IDs where the user is an accepted admin.
 */
export async function getAdminClubIds(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("club_admins")
    .select("club_id")
    .eq("user_id", userId)
    .eq("status", "accepted");
  return (data ?? []).map((r) => r.club_id);
}
