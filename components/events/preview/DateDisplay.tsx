import { CalendarDays } from "lucide-react";
import type { DateTimeData, PreviewInputProps } from "../shared/types";

function formatDisplayDate(date: string, time: string): string {
  if (!date) return "";
  const d = new Date(`${date}T${time || "00:00"}`);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  };
  let str = d.toLocaleDateString("en-AU", opts);
  if (time) {
    str += ` · ${d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}`;
  }
  return str;
}

type DateDisplayProps = PreviewInputProps<DateTimeData>;

/** Read-only date/time display with calendar icon and timezone badge. */
export function DateDisplay({ value }: DateDisplayProps) {
  const hasStart = !!value.startDate;
  const hasEnd = !!value.endDate;

  let displayText = "TBA";
  if (hasStart) {
    displayText = formatDisplayDate(value.startDate, value.startTime);
    if (hasEnd) {
      displayText += `  →  ${formatDisplayDate(value.endDate, value.endTime)}`;
    }
  }

  const tzShort = value.timezone
    ? (value.timezone.split("/").pop()?.replace(/_/g, " ") ?? "")
    : "";

  return (
    <div className="flex items-center gap-3">
      <CalendarDays className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span
        className={`text-base ${hasStart ? "font-medium text-foreground" : "text-muted-foreground"}`}
      >
        {displayText}
      </span>
      {hasStart && tzShort && (
        <span className="text-xs text-muted-foreground">{tzShort}</span>
      )}
    </div>
  );
}
