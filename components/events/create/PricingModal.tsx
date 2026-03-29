"use client";

import { useState } from "react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, Plus, Trash2, Settings2, AlertTriangle } from "lucide-react";
import type { TicketTier } from "../shared/types";
import { validateTicketTier as validateTier } from "../shared/pricingUtils";
import { TicketOfferWindowFields } from "./TicketOfferWindowFields";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: TicketTier[];
  onSave: (tiers: TicketTier[], eventCapacity: number | null) => void;
  eventCapacity?: number | null;
  eventStartDate?: string;
  eventStartTime?: string;
  ticketingEnabled: boolean;
}

let nextId = 1;
function genId() {
  return `tier-${Date.now()}-${nextId++}`;
}

export function PricingModal({
  open,
  onOpenChange,
  value,
  onSave,
  eventCapacity: initialEventCapacity,
  eventStartDate,
  eventStartTime,
  ticketingEnabled,
}: PricingModalProps) {
  const [tiers, setTiers] = useState<TicketTier[]>(value);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openSettings, setOpenSettings] = useState<Set<string>>(new Set());
  const [offerWindowOpen, setOfferWindowOpen] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const t of value) {
      if (t.offerStartDate || t.offerEndDate) ids.add(t.id);
    }
    return ids;
  });
  const [eventCapacity, setEventCapacity] = useState<number | null>(
    initialEventCapacity ?? null,
  );

  const eventId = window.location.pathname.split("/")[2];

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setTiers(value);
      setErrors({});
      setOpenSettings(new Set());
      const ids = new Set<string>();
      for (const t of value) {
        if (t.offerStartDate || t.offerEndDate) ids.add(t.id);
      }
      setOfferWindowOpen(ids);
      setEventCapacity(initialEventCapacity ?? null);
    }
    onOpenChange(next);
  };

  const addTier = () => {
    const pendingErrors: Record<string, string> = {};
    tiers.forEach((tier) => {
      const error = validateTier(tier);
      if (error) pendingErrors[tier.id] = error;
    });
    if (Object.keys(pendingErrors).length > 0) {
      setErrors(pendingErrors);
      return;
    }

    const id = genId();
    setTiers((prev) => [...prev, { id, name: "", price: 0, quantity: null }]);
  };

  const addFreeTier = () => {
    const id = genId();
    setTiers((prev) => [
      ...prev,
      { id, name: "Free Ticket", price: 0, quantity: null },
    ]);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const addMembersOnlyTier = () => {
    const id = genId();
    setTiers((prev) => [
      ...prev,
      {
        id,
        memberVerification: true,
        name: "Members Only",
        price: 0,
        quantity: null,
      },
    ]);
    setOpenSettings((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const removeTier = (id: string) => {
    setTiers((prev) => prev.filter((t) => t.id !== id));
    setOpenSettings((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setOfferWindowOpen((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateTier = (id: string, updates: Partial<TicketTier>) => {
    setTiers((prev) => {
      const nextTiers = prev.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      );

      if ("quantity" in updates) {
        const sumQuantities = nextTiers.reduce(
          (sum, tier) => sum + (tier.quantity ?? 0),
          0,
        );
        setEventCapacity((prevCap) => {
          if (prevCap !== null && sumQuantities > prevCap) {
            return sumQuantities;
          }
          return prevCap;
        });
      }

      return nextTiers;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const toggleSettings = (id: string) => {
    setOpenSettings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    const validTiers: TicketTier[] = [];

    let sumQuantities = 0;

    tiers.forEach((tier) => {
      const error = validateTier(tier);
      if (error) newErrors[tier.id] = error;
      else {
        validTiers.push(tier);
        if (tier.quantity != null) {
          sumQuantities += tier.quantity;
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    let finalCapacity = eventCapacity;
    if (finalCapacity !== null && sumQuantities > finalCapacity) {
      finalCapacity = sumQuantities;
    }

    onSave(validTiers, finalCapacity);
    onOpenChange(false);
  };

  const canAddTier = tiers.length < 10;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={handleOpenChange}
      title="Ticket Pricing"
      description="Set up ticket tiers, prices, and optional settings."
      className="sm:max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {errors.capacity && (
            <p className="text-xs text-red-500 px-1">{errors.capacity}</p>
          )}
        </div>

        {/* Empty ticketing tiers warning */}
        {ticketingEnabled && tiers.length === 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex gap-3 items-start text-red-800 dark:border-red-900/50 dark:bg-red-900/10 dark:text-red-400">
            <AlertTriangle className="h-full shrink-0" />
            <div className="text-xs">
              <p className="font-semibold">
                Ticketing is enabled but no tickets are configured.
              </p>
              <p className="mt-1 opacity-90">
                Please add at least one ticket tier, or guests won&apos;t be
                able to register.
              </p>
            </div>
          </div>
        )}

        {/* Enable ticketing alert */}
        {!ticketingEnabled && tiers.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex gap-3 items-start text-blue-800 dark:border-blue-900/50 dark:bg-blue-900/10 dark:text-blue-400">
            <AlertTriangle className="h-full shrink-0" />
            <div className="text-xs">
              <p className="font-semibold">Ticketing is not enabled!</p>
              <p className="mt-1 opacity-90">
                You have ticket tiers configured, please{" "}
                <Link
                  href={`/events/${eventId}/checkout/edit`}
                  className="underline"
                >
                  enable ticketing
                </Link>{" "}
                to allow guests to register.
              </p>
            </div>
          </div>
        )}

        {/* Event-level capacity */}
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <Label className="shrink-0 text-xs font-medium text-muted-foreground">
              Event Capacity
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 shrink-0 cursor-help text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-52">
                  Total tickets available across all tiers. Leave empty for
                  unlimited.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            type="number"
            min={1}
            value={eventCapacity ?? ""}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : null;
              if (val !== null && !isNaN(val)) {
                setEventCapacity(val);
              } else if (e.target.value === "") {
                setEventCapacity(null);
              }

              // Clear any capacity errors while typing
              setErrors((prev) => {
                if (!prev.capacity) return prev;
                const next = { ...prev };
                delete next.capacity;
                return next;
              });
            }}
            onBlur={() => {
              if (eventCapacity !== null) {
                const sumQuantities = tiers.reduce(
                  (sum, t) => sum + (t.quantity ?? 0),
                  0,
                );
                if (eventCapacity < sumQuantities) {
                  setEventCapacity(sumQuantities);
                  setErrors((prev) => ({
                    ...prev,
                    capacity: `Capacity cannot be lower than the sum of ticket quantities (${sumQuantities})`,
                  }));

                  // Clear the error message smoothly after 3 seconds
                  setTimeout(() => {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.capacity;
                      return next;
                    });
                  }, 3000);
                } else {
                  // Just enforce min bounds
                  setEventCapacity(Math.max(1, eventCapacity));
                }
              }
            }}
            placeholder="Unlimited"
            className="h-8 w-32 text-sm"
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-md border">
          {/* Header */}
          <div className="grid grid-cols-[1fr_88px_88px_72px] border-b bg-muted/40 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              Ticket Name <span className="text-red-500">*</span>
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              Price <span className="text-red-500">*</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Quantity
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 cursor-help text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-52">
                    Max tickets sold for this tier. Leave empty for unlimited.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-right text-xs font-medium text-muted-foreground">
              Actions
            </span>
          </div>

          {/* Tier rows */}
          <div className="max-h-80 overflow-y-auto divide-y">
            {tiers.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No ticket tiers yet — this event is free.
              </p>
            )}

            {tiers.map((tier) => {
              const isSettingsOpen = openSettings.has(tier.id);
              const isMembersOnly = tier.memberVerification === true;
              const isOfferWindowOn = offerWindowOpen.has(tier.id);
              const hasSettings = isMembersOnly || isOfferWindowOn;
              const error = errors[tier.id];

              return (
                <div key={tier.id}>
                  {/* Main row */}
                  <div
                    className={cn(
                      "grid grid-cols-[1fr_88px_88px_72px] items-center gap-1.5 px-3 py-2",
                      error && "bg-red-50/50 dark:bg-red-950/10",
                    )}
                  >
                    {/* Name */}
                    <Input
                      value={tier.name}
                      onChange={(e) =>
                        updateTier(tier.id, { name: e.target.value })
                      }
                      placeholder="e.g. General Admission"
                      className="h-8 text-sm"
                    />

                    {/* Price */}
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={tier.price === 0 ? "" : tier.price}
                        onChange={(e) =>
                          updateTier(tier.id, {
                            price: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        placeholder="0.00"
                        className="h-8 pl-5 text-sm"
                      />
                    </div>

                    {/* Quantity */}
                    <Input
                      type="number"
                      min={1}
                      value={tier.quantity ?? ""}
                      onChange={(e) =>
                        updateTier(tier.id, {
                          quantity: e.target.value
                            ? Math.max(1, parseInt(e.target.value, 10) || 1)
                            : null,
                        })
                      }
                      placeholder="∞"
                      className="h-8 text-sm"
                    />

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7 shrink-0",
                          isSettingsOpen || hasSettings
                            ? "text-foreground"
                            : "text-muted-foreground",
                          (isSettingsOpen || hasSettings) && "bg-muted",
                        )}
                        onClick={() => toggleSettings(tier.id)}
                        aria-label="Ticket settings"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeTier(tier.id)}
                        aria-label="Remove tier"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Validation error */}
                  {error && (
                    <div className="mx-3 mb-2 rounded border border-red-300 bg-red-50 px-2 py-1 dark:border-red-900 dark:bg-red-950/20">
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {error}
                      </p>
                    </div>
                  )}

                  {/* Settings panel */}
                  {isSettingsOpen && (
                    <div className="space-y-3 border-t bg-muted/20 px-3 py-3">
                      {/* Members Only */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium">Members Only</p>
                          <p className="text-xs text-muted-foreground">
                            Restrict this ticket to verified members
                          </p>
                        </div>
                        <Switch
                          checked={isMembersOnly}
                          onCheckedChange={(checked) =>
                            updateTier(tier.id, {
                              memberVerification: checked,
                            })
                          }
                        />
                      </div>

                      {/* Offer Window */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium">Offer Window</p>
                            <p className="text-xs text-muted-foreground">
                              Limit when this ticket can be purchased
                            </p>
                          </div>
                          <Switch
                            checked={isOfferWindowOn}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setOfferWindowOpen((prev) =>
                                  new Set(prev).add(tier.id),
                                );
                              } else {
                                setOfferWindowOpen((prev) => {
                                  const next = new Set(prev);
                                  next.delete(tier.id);
                                  return next;
                                });
                                updateTier(tier.id, {
                                  offerStartDate: "",
                                  offerStartTime: "",
                                  offerEndDate: "",
                                  offerEndTime: "",
                                });
                              }
                            }}
                          />
                        </div>

                        {isOfferWindowOn && (
                          <TicketOfferWindowFields
                            startDate={tier.offerStartDate}
                            startTime={tier.offerStartTime}
                            endDate={tier.offerEndDate}
                            endTime={tier.offerEndTime}
                            eventStartDate={eventStartDate}
                            eventStartTime={eventStartTime}
                            onChange={(next) =>
                              updateTier(tier.id, {
                                offerStartDate:
                                  next.startDate !== undefined
                                    ? next.startDate
                                    : tier.offerStartDate,
                                offerStartTime:
                                  next.startTime !== undefined
                                    ? next.startTime
                                    : tier.offerStartTime,
                                offerEndDate:
                                  next.endDate !== undefined
                                    ? next.endDate
                                    : tier.offerEndDate,
                                offerEndTime:
                                  next.endTime !== undefined
                                    ? next.endTime
                                    : tier.offerEndTime,
                              })
                            }
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add row */}
          <div className="flex items-center justify-between border-t px-3 py-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addTier}
                disabled={!canAddTier}
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                title={!canAddTier ? "Maximum 10 tiers" : undefined}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Ticket Type
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFreeTier}
                disabled={!canAddTier}
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Free
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMembersOnlyTier}
                disabled={!canAddTier}
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Members Only
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave}>
            Save Pricing
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
