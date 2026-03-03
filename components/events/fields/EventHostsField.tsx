"use client";

import type { ClubProfile, HostsValue } from "../shared/types";
import { HostsPicker } from "../create/HostsPicker";
import { HostsDisplay } from "../preview/HostsDisplay";
import { Users } from "lucide-react";

interface EventHostsFieldProps {
  mode: "edit" | "preview";
  creatorProfile: ClubProfile;
  value: HostsValue;
  onChange?: (value: HostsValue) => void;
}

export function EventHostsField({
  mode,
  creatorProfile,
  value,
  onChange,
}: EventHostsFieldProps) {
  if (mode === "preview") {
    return <HostsDisplay creatorProfile={creatorProfile} value={value.data} />;
  }

  return (
    <div className="flex items-center gap-3">
      <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
      <HostsPicker
        creatorProfile={creatorProfile}
        value={value}
        onChange={onChange ?? (() => {})}
      />
    </div>
  );
}
