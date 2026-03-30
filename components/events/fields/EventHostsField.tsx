"use client";

import { HostsDialog } from "../create/HostsDialog";
import { HostsDisplay } from "../preview/HostsDisplay";
import { Users } from "lucide-react";
import { useEventEditor } from "../shared/EventEditorContext";

interface EventHostsFieldProps {
  /** Callback after invites are sent */
  onInvitesSent?: () => void;
}

export function EventHostsField({ onInvitesSent }: EventHostsFieldProps) {
  const {
    viewMode: mode,
    form,
    updateField,
    hostsData,
    setHostsData,
    creatorProfile,
    eventId,
    draftSaved,
  } = useEventEditor();

  const value = { ids: form.hostIds, data: hostsData };

  if (mode === "preview") {
    return <HostsDisplay creatorProfile={creatorProfile} value={hostsData} />;
  }

  return (
    <div className="flex items-center gap-3">
      <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
      <HostsDialog
        creatorProfile={creatorProfile}
        value={value}
        onChange={({ ids, data }) => {
          updateField("hostIds", ids);
          setHostsData(data);
        }}
        eventId={eventId}
        eventSaved={draftSaved}
        onInvitesSent={onInvitesSent}
      />
    </div>
  );
}
