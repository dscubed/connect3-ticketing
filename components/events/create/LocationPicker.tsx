"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Search,
  Loader2,
  X,
  Navigation,
  Info,
  ArrowLeft,
  Pencil,
} from "lucide-react";
import type { LocationData, EditInputProps } from "../shared/types";

/* ── Nominatim types ── */
interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  namedetails?: {
    name?: string;
    "name:en"?: string;
  };
  address?: {
    house_number?: string;
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    country_code?: string;
    postcode?: string;
  };
}

/* ── Helpers ── */

function getPlaceName(result: NominatimResult): string | null {
  const name =
    result.namedetails?.["name:en"] || result.namedetails?.name || null;
  if (!name) return null;
  const addr = result.address;
  if (addr?.road && name === addr.road) return null;
  if (/^\d+$/.test(name)) return null;
  return name;
}

function formatStreetAddress(result: NominatimResult): string {
  const addr = result.address;
  if (!addr) return result.display_name;
  const parts: string[] = [];
  if (addr.road) {
    const street = addr.house_number
      ? `${addr.house_number} ${addr.road}`
      : addr.road;
    parts.push(street);
  }
  if (addr.suburb) parts.push(addr.suburb);
  const city = addr.city || addr.town || addr.village;
  if (city) parts.push(city);
  if (addr.country) parts.push(addr.country);
  return parts.length > 0 ? parts.join(", ") : result.display_name;
}

function isAustralian(result: NominatimResult): boolean {
  return result.address?.country_code === "au";
}

/* ── Geolocation helpers ── */

interface Coords {
  lat: number;
  lon: number;
}

/** Haversine distance in kilometres between two coordinates. */
function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/* ── Hook: debounced Nominatim search ── */
function useNominatimSearch(
  query: string,
  userCoords: Coords | null,
  debounceMs = 500,
) {
  const [rawResults, setRawResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setRawResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const params = new URLSearchParams({
          q: trimmed,
          format: "json",
          addressdetails: "1",
          namedetails: "1",
          dedupe: "1",
          limit: "10",
          viewbox: "112.0,-44.0,154.0,-10.0",
          bounded: "0",
        });
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?${params}`,
          {
            headers: {
              "User-Agent": "Connect3Ticketing/1.0",
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        );
        if (!res.ok) throw new Error("Nominatim request failed");
        const data: NominatimResult[] = await res.json();
        setRawResults(data);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Location search error:", err);
        setRawResults([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [query, debounceMs]);

  /* Sort: AU first, then by distance to user (if available) */
  const results = useMemo(() => {
    return [...rawResults].sort((a, b) => {
      const aAu = isAustralian(a) ? 0 : 1;
      const bAu = isAustralian(b) ? 0 : 1;
      if (aAu !== bAu) return aAu - bAu;
      if (userCoords) {
        const distA = haversineKm(userCoords, {
          lat: parseFloat(a.lat),
          lon: parseFloat(a.lon),
        });
        const distB = haversineKm(userCoords, {
          lat: parseFloat(b.lat),
          lon: parseFloat(b.lon),
        });
        return distA - distB;
      }
      return 0;
    });
  }, [rawResults, userCoords]);

  return { results, loading };
}

/* ── Dialog pages ── */
type DialogPage = "search" | "confirm";

type LocationPickerProps = EditInputProps<LocationData>;

/** Location picker with dialog-based Nominatim search + manual input. */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<DialogPage>("search");
  const [searchQuery, setSearchQuery] = useState("");

  /* ── Geolocation for sorting ── */
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [locationAsked, setLocationAsked] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  const { results, loading } = useNominatimSearch(searchQuery, userCoords);

  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [draftAddress, setDraftAddress] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);

  const handleOpen = useCallback(() => {
    setSearchQuery("");
    setPage("search");
    setOpen(true);
  }, []);

  const handleSelectResult = useCallback((result: NominatimResult) => {
    const placeName = getPlaceName(result);
    const address = formatStreetAddress(result);
    setDraftDisplayName(placeName || address);
    setDraftAddress(placeName ? address : "");
    setPage("confirm");
    setTimeout(() => displayNameRef.current?.focus(), 50);
  }, []);

  const handleInputManually = useCallback(() => {
    const query = searchQuery.trim();
    setDraftDisplayName(query);
    setDraftAddress("");
    setPage("confirm");
    setTimeout(() => displayNameRef.current?.focus(), 50);
  }, [searchQuery]);

  const handleConfirm = useCallback(() => {
    const name = draftDisplayName.trim();
    if (!name) return;
    onChange({ displayName: name, address: draftAddress.trim() });
    setOpen(false);
  }, [draftDisplayName, draftAddress, onChange]);

  const handleClear = useCallback(() => {
    onChange({ displayName: "", address: "" });
    setOpen(false);
  }, [onChange]);

  const handleEnableLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationAsked(true);
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
        setLocationAsked(true);
        setGeoLoading(false);
      },
      () => {
        // Denied or error — just hide the banner
        setLocationAsked(true);
        setGeoLoading(false);
      },
      { timeout: 10000 },
    );
  }, []);

  const handleBack = useCallback(() => {
    setPage("search");
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const hasValue = !!value.displayName;

  return (
    <>
      {/* ── Trigger ── */}
      <div className="flex min-w-0 items-center gap-3">
        <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" />

        {hasValue ? (
          <button
            type="button"
            onClick={handleOpen}
            className="flex min-w-0 items-baseline gap-1.5 text-left transition-colors hover:text-foreground"
          >
            <span className="shrink-0 text-base font-medium text-foreground">
              {value.displayName}
            </span>
            {value.address && (
              <span className="truncate text-sm text-muted-foreground">
                {value.address}
              </span>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOpen}
            className="text-left text-base text-muted-foreground transition-colors hover:text-foreground"
          >
            TBA
          </button>
        )}
      </div>

      {/* ── Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          {page === "search" ? (
            /* ═══ PAGE 1: SEARCH ═══ */
            <>
              <DialogHeader>
                <DialogTitle>Event Location</DialogTitle>
                <DialogDescription>
                  Search for an address or enter a custom location.
                </DialogDescription>
              </DialogHeader>

              {/* Location opt-in banner */}
              {!locationAsked && (
                <div className="flex items-start gap-2.5 rounded-md border border-border/60 bg-muted/40 px-3 py-2.5">
                  <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
                    Your location helps show the nearest results first.
                    It&apos;s optional and won&apos;t be stored.
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={handleEnableLocation}
                      disabled={geoLoading}
                    >
                      {geoLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Enable"
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setLocationAsked(true)}
                      className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search for an address…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (results.length > 0) {
                        handleSelectResult(results[0]);
                      } else if (searchQuery.trim()) {
                        handleInputManually();
                      }
                    }
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Results */}
              <div className="max-h-64 overflow-y-auto">
                {loading && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!loading && results.length > 0 && (
                  <ul className="space-y-1">
                    {results.map((result) => {
                      const placeName = getPlaceName(result);
                      const address = formatStreetAddress(result);
                      return (
                        <li key={result.place_id}>
                          <button
                            type="button"
                            onClick={() => handleSelectResult(result)}
                            className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                          >
                            <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              {placeName && (
                                <p className="font-medium leading-snug">
                                  {placeName}
                                </p>
                              )}
                              <p
                                className={`leading-snug ${
                                  placeName
                                    ? "text-xs text-muted-foreground"
                                    : ""
                                }`}
                              >
                                {address}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {!loading &&
                  results.length === 0 &&
                  searchQuery.trim().length >= 3 && (
                    <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                      No results found. Use the button below to input manually.
                    </p>
                  )}

                {!loading && searchQuery.trim().length < 3 && (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                    Type at least 3 characters to search.
                  </p>
                )}
              </div>

              {/* Attribution */}
              <div className="px-3 pt-2">
                <p className="text-center text-xs text-muted-foreground/70">
                  Location data &copy;{" "}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-muted-foreground"
                  >
                    OpenStreetMap contributors
                  </a>
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t pt-3">
                {hasValue ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="text-xs text-muted-foreground"
                  >
                    Clear location
                  </Button>
                ) : (
                  <div />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleInputManually}
                  className="gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Input manually
                </Button>
              </div>
            </>
          ) : (
            /* ═══ PAGE 2: CONFIRM ═══ */
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <DialogTitle>Confirm Location</DialogTitle>
                </div>
                <DialogDescription>
                  Edit the display name and address as you&apos;d like them to
                  appear.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Info banner */}
                <div className="flex items-start gap-2.5 rounded-md bg-muted/60 px-3 py-2.5">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Add any additional info like room number or floor to the
                    display name.
                    <br />
                    <span className="italic text-muted-foreground/70">
                      e.g. L4-421, Kwong Lee Dow Building (Building 263)
                    </span>
                  </p>
                </div>

                {/* Display name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Display name *
                  </Label>
                  <Input
                    ref={displayNameRef}
                    placeholder="e.g. Kwong Lee Dow Building"
                    value={draftDisplayName}
                    onChange={(e) => setDraftDisplayName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleConfirm();
                      }
                    }}
                  />
                </div>

                {/* Address (optional) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Address{" "}
                    <span className="font-normal text-muted-foreground/60">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    placeholder="e.g. 234 Queensberry St, Carlton"
                    value={draftAddress}
                    onChange={(e) => setDraftAddress(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleConfirm();
                      }
                    }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t pt-3">
                {hasValue ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="text-xs text-muted-foreground"
                  >
                    Clear location
                  </Button>
                ) : (
                  <div />
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirm}
                  disabled={!draftDisplayName.trim()}
                >
                  Confirm
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
