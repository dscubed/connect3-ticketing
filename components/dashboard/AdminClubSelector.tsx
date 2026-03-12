"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClubAdminRow } from "@/lib/hooks/useAdminClubSelector";

interface ClubSelectorProps {
  clubs: ClubAdminRow[];
  selectedClubId: string | null;
  onSelect: (clubId: string) => void;
}

export function AdminClubSelector({
  clubs,
  selectedClubId,
  onSelect,
}: ClubSelectorProps) {
  if (clubs.length === 0) return null;

  /* Multiple clubs — Select dropdown */
  return (
    <div className="flex items-center gap-3">
      <Select
        value={selectedClubId ?? undefined}
        onValueChange={(val) => onSelect(val)}
      >
        <SelectTrigger className="w-72">
          <SelectValue placeholder="Select a club" />
        </SelectTrigger>
        <SelectContent>
          {clubs.map((c) => {
            const p = c.club;
            return (
              <SelectItem key={c.club_id} value={c.club_id}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    {p?.avatar_url && (
                      <AvatarImage src={p.avatar_url} alt={p.first_name} />
                    )}
                    <AvatarFallback className="text-[8px]">
                      {p?.first_name?.charAt(0).toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{p?.first_name}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
