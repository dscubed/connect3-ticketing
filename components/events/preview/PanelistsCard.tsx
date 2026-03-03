import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { SectionData } from "../sections";

interface PanelistsCardProps {
  data: SectionData & { type: "panelists" };
}

/** Read-only Panelists content for event preview. */
export function PanelistsCard({ data }: PanelistsCardProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {data.items
          .filter((p) => p.name)
          .map((p, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2 text-center"
            >
              <Avatar className="h-16 w-16">
                {p.imageUrl ? (
                  <AvatarImage src={p.imageUrl} alt={p.name} />
                ) : null}
                <AvatarFallback>
                  {p.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                {p.title && (
                  <p className="text-xs text-muted-foreground">{p.title}</p>
                )}
              </div>
            </div>
          ))}
      </div>
      {data.items.every((p) => !p.name) && (
        <p className="text-sm italic text-muted-foreground">
          No panelists added yet.
        </p>
      )}
    </>
  );
}
