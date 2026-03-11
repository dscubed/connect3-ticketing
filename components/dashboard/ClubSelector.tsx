"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Building2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

/* ── Types ── */

interface ClubProfile {
  id: string;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
}

interface ClubAdminRow {
  id: string;
  club_id: string;
  role: string;
  status: string;
  created_at: string;
  club: ClubProfile | null;
  events?: unknown[];
  event_count?: number;
}

interface ClubSelectorProps {
  clubs: ClubAdminRow[];
  selectedClubId: string | null;
  onSelect: (clubId: string) => void;
}

export function ClubSelector({
  clubs,
  selectedClubId,
  onSelect,
}: ClubSelectorProps) {
  const selectedClub = clubs.find((c) => c.club_id === selectedClubId);
  const selectedProfile = selectedClub?.club;

  if (clubs.length === 0) return null;

  /* Single club — just show it, no dropdown needed */
  if (clubs.length === 1) {
    const club = clubs[0];
    const profile = club.club;
    return (
      <div className="flex items-center gap-2.5">
        <Avatar className="h-7 w-7">
          {profile?.avatar_url && (
            <AvatarImage src={profile.avatar_url} alt={profile.first_name} />
          )}
          <AvatarFallback className="text-[10px]">
            {profile?.first_name?.charAt(0).toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">{profile?.first_name}</span>
        <Badge variant="secondary" className="text-[10px]">
          {club.role}
        </Badge>
      </div>
    );
  }

  /* Multiple clubs — dropdown selector */
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          {selectedProfile ? (
            <>
              <Avatar className="h-5 w-5">
                {selectedProfile.avatar_url && (
                  <AvatarImage
                    src={selectedProfile.avatar_url}
                    alt={selectedProfile.first_name}
                  />
                )}
                <AvatarFallback className="text-[8px]">
                  {selectedProfile.first_name?.charAt(0).toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-32 truncate">
                {selectedProfile.first_name}
              </span>
            </>
          ) : (
            <>
              <Building2 className="h-4 w-4" />
              Select a club
            </>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {clubs.map((club) => {
          const profile = club.club;
          const isSelected = club.club_id === selectedClubId;
          return (
            <DropdownMenuItem
              key={club.club_id}
              onClick={() => onSelect(club.club_id)}
              className={cn("gap-2.5", isSelected && "bg-accent")}
            >
              <Avatar className="h-6 w-6">
                {profile?.avatar_url && (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile?.first_name ?? "Club"}
                  />
                )}
                <AvatarFallback className="text-[9px]">
                  {profile?.first_name?.charAt(0).toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate text-sm">
                {profile?.first_name}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {club.role}
              </Badge>
              {club.event_count !== undefined && (
                <span className="text-[10px] text-muted-foreground">
                  {club.event_count} events
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
