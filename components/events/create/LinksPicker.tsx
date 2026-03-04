"use client";

import { useState } from "react";
import { Link2, Pencil } from "lucide-react";
import { LinksModal } from "./LinksModal";
import type { EventLink, EditInputProps } from "../shared/types";

type LinksPickerProps = EditInputProps<EventLink[]>;

/** Strip protocol prefix for display. */
function stripProtocol(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

/**
 * Inline links display that opens a modal to manage event links.
 * Shows "{LinkIcon} first-url" with an edit button.
 */
export function LinksPicker({ value, onChange }: LinksPickerProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const hasLinks = value.length > 0;
  const firstUrl = hasLinks ? stripProtocol(value[0].url) : "";

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="group flex items-center gap-3 rounded-md transition-colors hover:bg-muted/60 -ml-2 px-2 py-1 w-full"
      >
        <Link2 className="h-5 w-5 shrink-0 text-muted-foreground" />
        {hasLinks ? (
          <span className="flex-1 truncate text-left text-base text-muted-foreground group-hover:text-foreground transition-colors">
            {firstUrl}
          </span>
        ) : (
          <span className="text-base text-muted-foreground group-hover:text-foreground transition-colors">
            Add Links
          </span>
        )}
        {hasLinks && (
          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      <LinksModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        value={value}
        onSave={onChange}
      />
    </>
  );
}
