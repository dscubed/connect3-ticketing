import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { SectionData } from "../sections";

interface CompaniesCardProps {
  data: SectionData & { type: "companies" };
}

/** Read-only Companies content for event preview. */
export function CompaniesCard({ data }: CompaniesCardProps) {
  return (
    <>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
        {data.items
          .filter((c) => c.name || c.logoUrl)
          .map((c, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2 text-center"
            >
              <Avatar className="h-14 w-14 rounded-lg">
                {c.logoUrl ? (
                  <AvatarImage
                    src={c.logoUrl}
                    alt={c.name}
                    className="rounded-lg object-contain"
                  />
                ) : null}
                <AvatarFallback className="rounded-lg">
                  {(c.name || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="text-xs font-medium">{c.name || "Unnamed"}</p>
            </div>
          ))}
      </div>
      {data.items.every((c) => !c.name && !c.logoUrl) && (
        <p className="text-sm italic text-muted-foreground">
          No companies added yet.
        </p>
      )}
    </>
  );
}
