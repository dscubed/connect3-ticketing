import { CalendarDays } from "lucide-react";
import type { DateTimeData, PreviewInputProps } from "../shared/types";

/** Compact format: 12/03 12:00 PM */
function formatCompactDate(date: string, time: string): string {
  if (!date) return "";
  const d = new Date(`${date}T${time || "00:00"}`);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  let str = `${dd}/${mm}`;
  if (time) {
    str += ` ${d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()}`;
  }
  return str;
}

function getTzAbbrev(timezone: string): string {
  if (!timezone) return "";
  try {
    const parts = new Date()
      .toLocaleString("en-AU", { timeZone: timezone, timeZoneName: "short" })
      .split(/\s/);
    return parts[parts.length - 1] ?? "";
  } catch {
    return "";
  }
}

type DateDisplayProps = PreviewInputProps<DateTimeData>;

/** Read-only date/time display with calendar icon. */
export function DateDisplay({ value }: DateDisplayProps) {
  const hasStart = !!value.startDate;
  const hasEnd = !!value.endDate;
  const extra = value.extraOccurrences ?? 0;

  let displayText = "TBA";
  if (hasStart) {
    displayText = formatCompactDate(value.startDate, value.startTime);
    if (extra > 0) {
      displayText += ` + ${extra} more`;
    } else if (hasEnd) {
      displayText += `  →  ${formatCompactDate(value.endDate, value.endTime)}`;
    }
  }

  const tzAbbrev = hasStart ? getTzAbbrev(value.timezone) : "";

  return (
    <div className="flex min-w-0 items-center gap-x-3 gap-y-1">
      <CalendarDays className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span
        className={`truncate text-sm sm:text-base ${
          hasStart ? "font-medium text-foreground" : "text-muted-foreground"
        }`}
      >
        {displayText}
      </span>
      {tzAbbrev && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {tzAbbrev}
        </span>
      )}
    </div>
  );
}
