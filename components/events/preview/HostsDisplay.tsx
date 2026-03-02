import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { HostAvatarStack } from "../shared/HostAvatarStack";
import type { ClubProfile, PreviewInputProps } from "../shared/types";

interface HostsDisplayProps extends PreviewInputProps<ClubProfile[]> {
  creatorProfile: ClubProfile;
}

/** Read-only hosts display — avatar stack with HoverCard listing all hosts. */
export function HostsDisplay({ creatorProfile, value }: HostsDisplayProps) {
  const othersCount = value.length;
  const displayLabel =
    othersCount > 0
      ? `${creatorProfile.first_name} + ${othersCount} other${othersCount > 1 ? "s" : ""}`
      : creatorProfile.first_name;

  return (
    <div className="flex items-center gap-3">
      <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <div className="flex cursor-pointer items-center gap-2">
            <HostAvatarStack creator={creatorProfile} hosts={value} />
            <span className="text-sm text-muted-foreground">
              {displayLabel}
            </span>
          </div>
        </HoverCardTrigger>
        <HoverCardContent className="w-56 p-3" align="start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Hosts
          </p>
          <div className="space-y-2">
            {[creatorProfile, ...value].map((h) => (
              <div key={h.id} className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  {h.avatar_url && (
                    <AvatarImage src={h.avatar_url} alt={h.first_name} />
                  )}
                  <AvatarFallback className="text-[10px]">
                    {h.first_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{h.first_name}</span>
              </div>
            ))}
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
