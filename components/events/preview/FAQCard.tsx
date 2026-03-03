import type { SectionData } from "../sections";

interface FAQCardProps {
  data: SectionData & { type: "faq" };
}

/** Read-only FAQ content for event preview. */
export function FAQCard({ data }: FAQCardProps) {
  return (
    <div className="space-y-4">
      {data.items
        .filter((q) => q.question || q.answer)
        .map((q, i) => (
          <div key={i}>
            <p className="font-medium">{q.question || "Untitled question"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {q.answer || "No answer yet"}
            </p>
          </div>
        ))}
      {data.items.every((q) => !q.question && !q.answer) && (
        <p className="text-sm italic text-muted-foreground">
          No questions added yet.
        </p>
      )}
    </div>
  );
}
