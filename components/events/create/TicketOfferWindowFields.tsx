import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface TicketOfferWindowFieldsProps {
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  eventStartDate?: string;
  eventStartTime?: string;
  onChange: (next: {
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
  }) => void;
}

/** Compact reusable start/end date-time controls for ticket offer windows. */
export function TicketOfferWindowFields({
  startDate,
  startTime,
  endDate,
  endTime,
  eventStartDate,
  eventStartTime,
  onChange,
}: TicketOfferWindowFieldsProps) {
  const hasEventStart = !!(eventStartDate && eventStartTime);

  const handleSetToday = () => {
    onChange({
      startDate: new Date().toISOString().split("T")[0],
      startTime: "00:00",
    });
  };

  const handleSetEventStart = () => {
    if (hasEventStart) {
      onChange({ endDate: eventStartDate, endTime: eventStartTime });
    }
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            Offer start <span className="text-red-500">*</span>
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] text-muted-foreground"
            onClick={handleSetToday}
          >
            Today
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={startDate ?? ""}
            onChange={(e) => onChange({ startDate: e.target.value })}
            className="h-8 text-sm"
          />
          <Input
            type="time"
            value={startTime ?? ""}
            onChange={(e) => onChange({ startTime: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            Offer end <span className="text-red-500">*</span>
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] text-muted-foreground"
            onClick={handleSetEventStart}
            disabled={!hasEventStart}
            title={
              hasEventStart
                ? "Set to event start date/time"
                : "Set an event start date first"
            }
          >
            Event Start
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={endDate ?? ""}
            min={startDate || undefined}
            onChange={(e) => onChange({ endDate: e.target.value })}
            className="h-8 text-sm"
          />
          <Input
            type="time"
            value={endTime ?? ""}
            onChange={(e) => onChange({ endTime: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
