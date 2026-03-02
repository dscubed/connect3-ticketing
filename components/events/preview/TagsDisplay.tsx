import { TagPill } from "../shared/EventPills";
import type { PreviewInputProps } from "../shared/types";

type TagsDisplayProps = PreviewInputProps<string[]>;

/** Read-only tags display — shows tag pills or "No tags selected" fallback. */
export function TagsDisplay({ value }: TagsDisplayProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.length > 0 ? (
        value.map((tag) => <TagPill key={tag} tag={tag} />)
      ) : (
        <span className="text-sm text-muted-foreground">No tags selected</span>
      )}
    </div>
  );
}
