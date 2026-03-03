interface DescriptionCardProps {
  value: string;
}

/** Read-only event description content with "No description provided" fallback. */
export function DescriptionCard({ value }: DescriptionCardProps) {
  return (
    <p
      className={`whitespace-pre-wrap text-sm leading-relaxed ${
        value ? "text-foreground/90" : "italic text-muted-foreground"
      }`}
    >
      {value || "No description provided"}
    </p>
  );
}
