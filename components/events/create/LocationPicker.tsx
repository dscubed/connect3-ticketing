"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
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
  ChevronDown,
  Link,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LocationData, EditInputProps } from "../shared/types";

/* Dynamically import Leaflet map (no SSR) */
const LocationMap = dynamic(
  () => import("./LocationMap").then((mod) => mod.LocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-45 items-center justify-center rounded-lg bg-muted">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

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

/* ── Google Maps URL parser ── */

interface GoogleMapsParseResult {
  displayName: string;
  lat: number;
  lon: number;
  address: string;
}

/**
 * Parse a Google Maps URL to extract the place name and coordinates.
 * Prefers exact pin coords from !3d/!4d over the viewport @lat,lon.
 */
function parseGoogleMapsUrl(
  url: string,
): Omit<GoogleMapsParseResult, "address"> | null {
  try {
    // Must contain google.com/maps or google.*/maps
    if (!/google\.[a-z.]+\/maps/i.test(url)) return null;

    // Extract place name from /place/PLACE_NAME/
    const placeMatch = url.match(/\/place\/([^/@]+)/);
    const rawName = placeMatch?.[1] ?? "";
    const displayName = decodeURIComponent(rawName.replace(/\+/g, " ")).trim();

    let lat: number | null = null;
    let lon: number | null = null;

    // Prefer exact pin coordinates — use the LAST !3d/!4d pair
    // (Google URLs can contain multiple places; the selected one is last)
    const allLat = [...url.matchAll(/!3d(-?\d+\.\d+)/g)];
    const allLon = [...url.matchAll(/!4d(-?\d+\.\d+)/g)];
    if (allLat.length > 0 && allLon.length > 0) {
      lat = parseFloat(allLat[allLat.length - 1][1]);
      lon = parseFloat(allLon[allLon.length - 1][1]);
    }

    // Fallback to viewport @LAT,LON if exact coords not available
    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
      const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (!coordMatch) return null;
      lat = parseFloat(coordMatch[1]);
      lon = parseFloat(coordMatch[2]);
    }

    if (isNaN(lat) || isNaN(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

    return { displayName: displayName || "Pinned Location", lat, lon };
  } catch {
    return null;
  }
}

/**
 * Reverse-geocode coordinates via Nominatim to get a human-readable address.
 */
async function reverseGeocode(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: "json",
      addressdetails: "1",
      zoom: "18",
    });
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params}`,
      {
        headers: {
          "User-Agent": "Connect3Ticketing/1.0",
          Accept: "application/json",
        },
        signal,
      },
    );
    if (!res.ok) return "";
    const data = await res.json();
    // Build a concise address from parts
    const addr = data.address;
    if (!addr) return data.display_name || "";
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
    if (addr.state) parts.push(addr.state);
    if (addr.country) parts.push(addr.country);
    return parts.length > 0 ? parts.join(", ") : data.display_name || "";
  } catch {
    return "";
  }
}

/* ── Dialog pages ── */
type DialogPage = "search" | "confirm" | "google-maps";

type LocationPickerProps = EditInputProps<LocationData> & {
  /** When provided, the picker becomes a controlled modal (no trigger rendered). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** Location picker with dialog-based Nominatim search + manual input. */
export function LocationPicker({ value, onChange, open: controlledOpen, onOpenChange: controlledOnOpenChange }: LocationPickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (v: boolean) => {
      if (isControlled) {
        controlledOnOpenChange?.(v);
      } else {
        setInternalOpen(v);
      }
    },
    [isControlled, controlledOnOpenChange],
  );
  const [page, setPage] = useState<DialogPage>("search");
  const [searchQuery, setSearchQuery] = useState("");

  /* ── Geolocation for sorting ── */
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [locationAsked, setLocationAsked] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  const { results, loading } = useNominatimSearch(searchQuery, userCoords);

  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [draftAddress, setDraftAddress] = useState("");
  const [draftLat, setDraftLat] = useState<number | undefined>(undefined);
  const [draftLon, setDraftLon] = useState<number | undefined>(undefined);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);

  const hasValue = !!value.displayName;

  const handleOpen = useCallback(() => {
    setSearchQuery("");
    if (hasValue) {
      // Prefill drafts with current location and go straight to confirm page
      setDraftDisplayName(value.displayName);
      setDraftAddress(value.address || "");
      setDraftLat(value.lat);
      setDraftLon(value.lon);
      setPage("confirm");
    } else {
      setPage("search");
    }
    setOpen(true);
  }, [hasValue, value.displayName, value.address, value.lat, value.lon, setOpen]);

  const handleSelectResult = useCallback((result: NominatimResult) => {
    const placeName = getPlaceName(result);
    const address = formatStreetAddress(result);
    setDraftDisplayName(placeName || address);
    setDraftAddress(placeName ? address : "");
    setDraftLat(parseFloat(result.lat));
    setDraftLon(parseFloat(result.lon));
    setPage("confirm");
    setTimeout(() => displayNameRef.current?.focus(), 50);
  }, []);

  const handleInputManually = useCallback(() => {
    const query = searchQuery.trim();
    // Only overwrite drafts if the user actually typed something new
    if (query) {
      setDraftDisplayName(query);
      setDraftAddress("");
      // Manual input — no geocoded coordinates
      setDraftLat(undefined);
      setDraftLon(undefined);
    }
    // If query is empty and drafts already have content, just navigate back
    // to confirm without resetting anything
    setPage("confirm");
    setTimeout(() => displayNameRef.current?.focus(), 50);
  }, [searchQuery]);

  /* ── Google Maps paste ── */
  const [googleUrl, setGoogleUrl] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleParsed, setGoogleParsed] =
    useState<GoogleMapsParseResult | null>(null);
  const googleAbortRef = useRef<AbortController | null>(null);

  const handleGoogleMapsPage = useCallback(() => {
    setGoogleUrl("");
    setGoogleError("");
    setGoogleParsed(null);
    setGoogleLoading(false);
    setPage("google-maps");
  }, []);

  const handleGoogleUrlChange = useCallback(async (url: string) => {
    setGoogleUrl(url);
    googleAbortRef.current?.abort();

    if (!url.trim()) {
      setGoogleError("");
      setGoogleParsed(null);
      setGoogleLoading(false);
      return;
    }

    const parsed = parseGoogleMapsUrl(url.trim());
    if (!parsed) {
      setGoogleError(
        "Couldn't parse this URL. Make sure it's a Google Maps place link.",
      );
      setGoogleParsed(null);
      setGoogleLoading(false);
      return;
    }

    // Show immediately with loading state for address
    setGoogleError("");
    setGoogleLoading(true);
    setGoogleParsed({ ...parsed, address: "" });

    // Reverse-geocode to get the address
    const controller = new AbortController();
    googleAbortRef.current = controller;
    const address = await reverseGeocode(
      parsed.lat,
      parsed.lon,
      controller.signal,
    );
    if (!controller.signal.aborted) {
      setGoogleParsed({ ...parsed, address });
      setGoogleLoading(false);
    }
  }, []);

  const handleGoogleConfirm = useCallback(() => {
    if (!googleParsed) return;
    setDraftDisplayName(googleParsed.displayName);
    setDraftAddress(googleParsed.address || "");
    setDraftLat(googleParsed.lat);
    setDraftLon(googleParsed.lon);
    setPage("confirm");
    setTimeout(() => displayNameRef.current?.focus(), 50);
  }, [googleParsed]);

  const handleConfirm = useCallback(() => {
    const name = draftDisplayName.trim();
    if (!name) return;
    onChange({
      displayName: name,
      address: draftAddress.trim(),
      lat: draftLat,
      lon: draftLon,
    });
    setOpen(false);
  }, [draftDisplayName, draftAddress, draftLat, draftLon, onChange, setOpen]);

  const handleClear = useCallback(() => {
    onChange({ displayName: "", address: "" });
    setOpen(false);
  }, [onChange, setOpen]);

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

  return (
    <>
      {/* ── Trigger (only when uncontrolled) ── */}
      {!isControlled && (
        <div className="flex min-w-0 items-center gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

          {hasValue ? (
            <button
              type="button"
              onClick={handleOpen}
              className="flex min-w-0 flex-col gap-0.5 overflow-hidden text-left transition-colors hover:text-foreground"
            >
              <span className="w-full truncate text-sm font-medium text-foreground sm:text-base">
                {value.displayName}
              </span>
              {value.address && (
                <span className="w-full truncate text-xs text-muted-foreground sm:text-sm">
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
      )}

      {/* ── Modal ── */}
      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        className="sm:max-w-md"
      >
        {page === "search" ? (
          /* ═══ PAGE 1: SEARCH ═══ */
          <>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg font-semibold leading-none tracking-tight">
                Event Location
              </h2>
              <p className="text-sm text-muted-foreground">
                Search for an address or enter a custom location.
              </p>
            </div>

            {/* Location opt-in banner */}
            {!locationAsked && (
              <div className="flex items-start gap-2.5 rounded-md border border-border/60 bg-muted/40 px-3 py-2.5">
                <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
                  Your location helps show the nearest results first. It&apos;s
                  optional and won&apos;t be stored.
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
                                placeName ? "text-xs text-muted-foreground" : ""
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

            {/* Footer — pinned to bottom on mobile sheet */}
            <div className="mt-auto flex items-center justify-between border-t pt-3">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Input manually
                    <ChevronDown className="ml-0.5 h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleInputManually}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Custom
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleGoogleMapsPage}>
                    <Link className="mr-2 h-4 w-4" />
                    Google Maps URL
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        ) : page === "google-maps" ? (
          /* ═══ PAGE 3: GOOGLE MAPS URL ═══ */
          <>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h2 className="text-lg font-semibold leading-none tracking-tight">
                  Google Maps
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Paste a Google Maps link to auto-fill the location.
              </p>
            </div>

            {/* How-to banner */}
            <div className="flex items-start gap-2.5 rounded-md bg-muted/60 px-3 py-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Open{" "}
                <a
                  href="https://maps.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium underline hover:text-foreground"
                >
                  Google Maps
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                → find your venue → <strong>Share</strong> →{" "}
                <strong>Copy link</strong> and paste it below.
              </p>
            </div>

            {/* URL input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Google Maps URL
              </Label>
              <Input
                placeholder="https://www.google.com/maps/place/..."
                value={googleUrl}
                onChange={(e) => handleGoogleUrlChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (googleParsed && !googleLoading) handleGoogleConfirm();
                  }
                }}
                autoFocus
              />
              {googleError && (
                <p className="text-xs text-destructive">{googleError}</p>
              )}
            </div>

            {/* Parsed preview */}
            {googleParsed && (
              <div className="space-y-3 rounded-md border border-green-500/30 bg-green-500/5 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Location found
                </div>
                <LocationMap
                  lat={googleParsed.lat}
                  lon={googleParsed.lon}
                  height={150}
                />
                <div className="text-sm">
                  <p className="font-medium">{googleParsed.displayName}</p>
                  {googleLoading ? (
                    <p className="text-xs text-muted-foreground animate-pulse">
                      Looking up address…
                    </p>
                  ) : googleParsed.address ? (
                    <p className="text-xs text-muted-foreground">
                      {googleParsed.address}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {googleParsed.lat.toFixed(6)}, {googleParsed.lon.toFixed(6)}
                  </p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-auto flex items-center justify-end border-t pt-3">
              <Button
                type="button"
                size="sm"
                onClick={handleGoogleConfirm}
                disabled={!googleParsed || googleLoading}
              >
                Use this location
              </Button>
            </div>
          </>
        ) : (
          /* ═══ PAGE 2: CONFIRM ═══ */
          <>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h2 className="text-lg font-semibold leading-none tracking-tight">
                  Confirm Location
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Edit the display name and address as you&apos;d like them to
                appear.
              </p>
            </div>

            <div className="space-y-4">
              {/* Map preview — only when we have coordinates from search */}
              {draftLat != null && draftLon != null && (
                <LocationMap lat={draftLat} lon={draftLon} height={180} />
              )}

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

              {/* Address — read-only when from search (has coords), editable when manual */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Address{" "}
                  {draftLat == null ? (
                    <span className="font-normal text-muted-foreground/60">
                      (optional)
                    </span>
                  ) : (
                    <span className="font-normal text-muted-foreground/60">
                      (from search)
                    </span>
                  )}
                </Label>
                <Input
                  placeholder="e.g. 234 Queensberry St, Carlton"
                  value={draftAddress}
                  onChange={(e) => {
                    if (draftLat == null) setDraftAddress(e.target.value);
                  }}
                  readOnly={draftLat != null}
                  className={
                    draftLat != null
                      ? "bg-muted text-muted-foreground cursor-default"
                      : ""
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleConfirm();
                    }
                  }}
                />
              </div>
            </div>

            {/* Footer — pinned to bottom on mobile sheet */}
            <div className="mt-auto flex items-center justify-between border-t pt-3">
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
      </ResponsiveModal>
    </>
  );
}
