import { CategoryPill } from "../shared/EventPills";
import type { PreviewInputProps } from "../shared/types";

type CategoryDisplayProps = PreviewInputProps<string>;

/** Read-only category pill display. */
export function CategoryDisplay({ value }: CategoryDisplayProps) {
  return <CategoryPill value={value} />;
}
