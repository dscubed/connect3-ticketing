import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { AvatarProfile } from "@/lib/types/events";

export type { AvatarProfile } from "@/lib/types/events";

interface AvatarStackProps {
  /** List of profiles to display as avatars */
  profiles: AvatarProfile[];
  /** Maximum number of avatars to display before showing "+N" badge */
  limit?: number;
  /** Size of each avatar */
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

/**
 * Renders a horizontally-overlapping stack of avatars.
 * Displays up to `limit` avatars, then shows a "+N" badge for remaining profiles.
 */
export function AvatarStack({
  profiles,
  limit = 2,
  size = "md",
}: AvatarStackProps) {
  const sizeClass = sizeMap[size];
  const displayedProfiles = profiles.slice(0, limit);
  const remainingCount = Math.max(0, profiles.length - limit);

  return (
    <div className="flex items-center -space-x-2">
      {displayedProfiles.map((profile, i) => (
        <Avatar
          key={profile.id}
          className={`${sizeClass} border-2 border-background`}
          style={{ zIndex: limit - i }}
        >
          {profile.avatar_url && (
            <AvatarImage src={profile.avatar_url} alt={profile.first_name} />
          )}
          <AvatarFallback className="text-xs">
            {profile.first_name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {remainingCount > 0 && (
        <div
          className={`${sizeClass} flex items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold text-foreground`}
          style={{ zIndex: 0 }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
