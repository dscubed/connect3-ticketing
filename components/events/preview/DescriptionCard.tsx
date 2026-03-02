import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PreviewInputProps } from "../shared/types";

type DescriptionCardProps = PreviewInputProps<string>;

/** Read-only event description card with "No description provided" fallback. */
export function DescriptionCard({ value }: DescriptionCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Event Description</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={`whitespace-pre-wrap text-sm leading-relaxed ${
            value ? "text-foreground/90" : "italic text-muted-foreground"
          }`}
        >
          {value || "No description provided"}
        </p>
      </CardContent>
    </Card>
  );
}
