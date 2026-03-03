import type { SectionData } from "../sections";

interface WhatToBringCardProps {
  data: SectionData & { type: "what-to-bring" };
}

/** Read-only What-To-Bring content for event preview. */
export function WhatToBringCard({ data }: WhatToBringCardProps) {
  return (
    <>
      <ul className="space-y-2">
        {data.items
          .filter((it) => it.item)
          .map((it, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                {i + 1}
              </span>
              {it.item}
            </li>
          ))}
      </ul>
      {data.items.every((it) => !it.item) && (
        <p className="text-sm italic text-muted-foreground">
          No items added yet.
        </p>
      )}
    </>
  );
}
