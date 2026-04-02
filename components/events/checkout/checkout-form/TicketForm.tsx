"use client";

import { Loader2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SectionWrapper } from "@/components/events/preview/SectionWrapper";
import { TicketFieldPreview } from "@/components/events/checkout/TicketFieldPreview";
import { CHECKOUT_PRESET_FIELDS } from "@/lib/types/ticketing";
import type { TicketingFieldDraft } from "@/lib/types/ticketing";
import type { ThemeColors, ThemeLayout } from "@/components/events/shared/types";
import type { User } from "@supabase/supabase-js";

interface TicketFormProps {
  ticketIndex: number;
  layout: ThemeLayout;
  isDark: boolean;
  colors: ThemeColors;
  fields: TicketingFieldDraft[];
  user: User | null;
  fillingMyData: boolean;
  getFieldValue: (ticketIndex: number, fieldKey: string) => string;
  setFieldValue: (ticketIndex: number, fieldKey: string, value: string) => void;
  handleBuyForMyself: (ticketIndex: number) => void;
}

export function TicketForm({
  ticketIndex,
  layout,
  isDark,
  colors,
  fields,
  user,
  fillingMyData,
  getFieldValue,
  setFieldValue,
  handleBuyForMyself,
}: TicketFormProps) {
  return (
    <div className="space-y-8">
      <SectionWrapper
        title="Checkout Info"
        layout={layout}
        isDark={isDark}
        headerRight={
          user ? (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 text-xs",
                isDark
                  ? "text-white/70 hover:text-white hover:bg-white/10"
                  : "text-black/60 hover:text-black hover:bg-black/10",
              )}
              onClick={() => handleBuyForMyself(ticketIndex)}
              disabled={fillingMyData}
            >
              {fillingMyData ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserCheck className="h-3.5 w-3.5" />
              )}
              Buy for myself
            </Button>
          ) : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {CHECKOUT_PRESET_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label className={cn("text-sm font-medium", colors.text)}>
                {field.label}
                <span className="ml-0.5 text-red-500">*</span>
              </Label>
              <Input
                type={field.type}
                placeholder={field.label}
                className={cn(
                  colors.inputBg,
                  colors.inputBorder,
                  colors.placeholder,
                )}
                value={getFieldValue(ticketIndex, field.key)}
                onChange={(e) =>
                  setFieldValue(ticketIndex, field.key, e.target.value)
                }
              />
            </div>
          ))}
        </div>
      </SectionWrapper>

      {fields.length > 0 && (
        <SectionWrapper title="Ticket Info" layout={layout} isDark={isDark}>
          <div className="space-y-4">
            {fields.map((field) => (
              <TicketFieldPreview
                key={field.id}
                field={field}
                colors={colors}
                value={getFieldValue(ticketIndex, field.id)}
                onChange={(val) =>
                  setFieldValue(ticketIndex, field.id, val)
                }
              />
            ))}
          </div>
        </SectionWrapper>
      )}
    </div>
  );
}
