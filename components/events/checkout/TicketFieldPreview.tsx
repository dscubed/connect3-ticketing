"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TicketingFieldDraft } from "@/lib/types/ticketing";
import type { ThemeColors } from "@/components/events/shared/types";

interface TicketFieldPreviewProps {
  field: TicketingFieldDraft;
  colors: ThemeColors;
  /** Current field value (multiselect stored as comma-separated) */
  value: string;
  onChange: (value: string) => void;
}

export function TicketFieldPreview({
  field,
  colors,
  value,
  onChange,
}: TicketFieldPreviewProps) {
  const inputClass = cn(colors.inputBg, colors.inputBorder, colors.placeholder);

  // Multiselect: comma-separated selected options
  const selectedOptions = field.input_type === "multiselect"
    ? value.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const toggleOption = (opt: string) => {
    const next = selectedOptions.includes(opt)
      ? selectedOptions.filter((o) => o !== opt)
      : [...selectedOptions, opt];
    onChange(next.join(","));
  };

  return (
    <div className="space-y-1.5">
      <Label className={cn("text-sm font-medium", colors.text)}>
        {field.label || "Untitled"}
        {field.required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>

      {field.input_type === "text" && (
        <Input
          placeholder={field.placeholder || field.label}
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.input_type === "textarea" && (
        <Textarea
          placeholder={field.placeholder || field.label}
          rows={3}
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.input_type === "number" && (
        <Input
          type="number"
          placeholder={field.placeholder || "0"}
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.input_type === "date" && (
        <Input
          type="date"
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.input_type === "select" && (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder={field.placeholder || "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt, i) => (
              <SelectItem key={i} value={opt || `opt-${i}`}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.input_type === "multiselect" && (
        <div className="flex flex-wrap gap-1.5 rounded-md border p-2">
          {field.options.map((opt, i) => {
            const active = selectedOptions.includes(opt);
            return (
              <Badge
                key={i}
                variant={active ? "default" : "outline"}
                className={cn(
                  "cursor-pointer select-none transition-colors",
                  !active && colors.hoverBg,
                  !active && colors.isDark && "border-neutral-600",
                )}
                onClick={() => toggleOption(opt)}
              >
                {opt}
              </Badge>
            );
          })}
          {field.options.length === 0 && (
            <span className="text-xs text-muted-foreground">No options</span>
          )}
        </div>
      )}

      {field.input_type === "slider" && (
        <div className="flex items-center gap-3 pt-1">
          <span className="text-xs text-muted-foreground">1</span>
          <Slider
            value={[value ? Number(value) : 5]}
            onValueChange={([v]) => onChange(String(v))}
            min={1}
            max={10}
            step={1}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground">
            {value || "5"}
          </span>
        </div>
      )}
    </div>
  );
}
