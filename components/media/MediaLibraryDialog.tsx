"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  ImagePlus,
  Loader2,
  Trash2,
  Check,
  Upload,
  Building2,
  Mic,
  Instagram,
  ImageIcon,
} from "lucide-react";
import Image from "next/image";
import { AdminClubSelector } from "@/components/dashboard/AdminClubSelector";
import { useAdminClubSelector } from "@/lib/hooks/useAdminClubSelector";
import { useAuthStore } from "@/stores/authStore";

/* ── Types ── */

export type MediaCategory = "images" | "companies" | "panelists" | "instagram";

export interface MediaItem {
  name: string;
  url: string;
  created_at: string;
}

export interface InstagramImage {
  post_id: string;
  posted_by: string;
  caption: string;
  post_timestamp: number | null;
  location: string | null;
  image_url: string;
  fetched_at: string;
}

interface MediaLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which tab to open on. Defaults to "images". */
  defaultTab?: MediaCategory;
  /** Whether to allow multi-select. */
  multiSelect?: boolean;
  /** Called when user confirms selection. */
  onSelect: (urls: string[]) => void;
  /**
   * When provided, Instagram images are fetched for this club directly
   * (org dashboard context). When omitted, a club selector is shown on
   * the Instagram tab so the user can choose which club to pull from.
   */
  clubId?: string;
}

/* ── Tab metadata ── */

const TAB_META: {
  value: MediaCategory;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
}[] = [
  { value: "images", label: "Images", icon: <ImageIcon className="h-4 w-4" /> },
  {
    value: "companies",
    label: "Companies",
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    value: "panelists",
    label: "Panelists",
    icon: <Mic className="h-4 w-4" />,
  },
  {
    value: "instagram",
    label: "Instagram",
    icon: <Instagram className="h-4 w-4" />,
  },
];

const BUCKET = "media";
const MEDIA_PAGE_SIZE = 40;

/* ── Component ── */

export function MediaLibraryDialog({
  open,
  onOpenChange,
  defaultTab = "images",
  multiSelect = false,
  onSelect,
  clubId,
}: MediaLibraryDialogProps) {
  const [activeTab, setActiveTab] = useState<MediaCategory>(defaultTab);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreItems, setHasMoreItems] = useState(false);
  const offsetRef = useRef(0);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [instagramImages, setInstagramImages] = useState<InstagramImage[]>([]);
  const [instagramLoading, setInstagramLoading] = useState(false);
  const [instagramFetched, setInstagramFetched] = useState(false);

  /* Auth — determine whether this user is an organisation (they ARE the club) */
  const { user, isOrganisation } = useAuthStore();
  const isOrg = isOrganisation();

  /*
   * Club selector — only used when:
   *   - no clubId prop is provided (not org-dashboard context), AND
   *   - the user is NOT an organisation account
   */
  const {
    clubs: adminClubs,
    loading: clubsLoading,
    selectedClubId: selectedInstagramClubId,
    setSelectedClubId: setSelectedInstagramClubId,
  } = useAdminClubSelector();

  /*
   * Resolve the effective club ID for Instagram fetching:
   *   1. explicit clubId prop (org dashboard)
   *   2. org account → own user ID
   *   3. user account → selected club from AdminClubSelector
   */
  const effectiveClubId = clubId ?? (isOrg ? (user?.id ?? null) : selectedInstagramClubId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const totalCountRef = useRef(0);

  // Create supabase browser client once
  const supabase = createClient();

  /* Sync activeTab when defaultTab changes */
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  /* Reset when open state changes */
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      offsetRef.current = 0;
      setInstagramFetched(false);
      setInstagramImages([]);
      fetchItems(activeTab, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      offsetRef.current = 0;
      fetchItems(activeTab, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  /* Auto-fetch Instagram images when effective club ID is ready */
  useEffect(() => {
    if (activeTab !== "instagram" || !open) return;
    if (!effectiveClubId) return;
    fetchInstagramImages(effectiveClubId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, open, effectiveClubId]);

  /* ── IntersectionObserver for scroll-based loading ── */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreItems && !loadingMore && !loading) {
          fetchItems(activeTab, false);
        }
      },
      { root: container, rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMoreItems, loadingMore, loading, activeTab]);

  /* ── List files directly via Supabase client (paginated) ── */
  const fetchItems = useCallback(
    async (category: MediaCategory, replace: boolean = false) => {
      if (category === "instagram") {
        // Instagram is handled separately via the tab effect / club selector
        return;
      }
      if (replace) {
        setLoading(true);
        offsetRef.current = 0;
      } else {
        setLoadingMore(true);
      }
      console.log(
        "[MediaLib] fetchItems:",
        category,
        "offset:",
        offsetRef.current,
      );
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          console.error("[MediaLib] Not authenticated");
          setItems([]);
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        const folder = `${user.id}/${category}`;
        console.log("[MediaLib] listing folder:", folder);

        const { data: files, error } = await supabase.storage
          .from(BUCKET)
          .list(folder, {
            sortBy: { column: "created_at", order: "desc" },
            limit: MEDIA_PAGE_SIZE,
            offset: offsetRef.current,
          });

        if (error) {
          console.error("[MediaLib] list error:", error);
          if (replace) setItems([]);
        } else {
          const mapped: MediaItem[] = (files ?? [])
            .filter((f) => f.name !== ".emptyFolderPlaceholder")
            .map((f) => ({
              name: f.name,
              url: supabase.storage
                .from(BUCKET)
                .getPublicUrl(`${folder}/${f.name}`).data.publicUrl,
              created_at: f.created_at,
            }));
          console.log("[MediaLib] listed", mapped.length, "files");

          if (replace) {
            setItems(mapped);
            totalCountRef.current = mapped.length;
          } else {
            setItems((prev) => [...prev, ...mapped]);
            totalCountRef.current += mapped.length;
          }
          offsetRef.current += mapped.length;
          setHasMoreItems(mapped.length >= MEDIA_PAGE_SIZE);
        }
      } catch (err) {
        console.error("[MediaLib] fetchItems exception:", err);
        if (replace) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // supabase client is stable (created once per render cycle via createClient)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ── Fetch Instagram images via API (admin key, no RLS) ── */
  const fetchInstagramImages = useCallback(async (forClubId?: string | null) => {
    setInstagramLoading(true);
    setInstagramFetched(false);
    try {
      const targetClub = forClubId ?? clubId ?? null;
      const url = targetClub
        ? `/api/media/instagram?club_id=${encodeURIComponent(targetClub)}`
        : "/api/media/instagram";
      const res = await fetch(url);
      if (!res.ok) {
        console.error("[MediaLib] Instagram fetch failed:", res.status);
        setInstagramImages([]);
      } else {
        const { data } = await res.json();
        setInstagramImages(data ?? []);
        setInstagramFetched(true);
      }
    } catch (err) {
      console.error("[MediaLib] Instagram fetch exception:", err);
      setInstagramImages([]);
    } finally {
      setInstagramLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  /* ── Upload directly via Supabase client (no API proxy) ── */
  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      console.log("[MediaLib] handleUpload triggered");
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) {
        console.log("[MediaLib] no files selected");
        return;
      }
      // Snapshot files into a plain array BEFORE clearing input.
      // FileList is a live reference — clearing the input empties it.
      const files = Array.from(fileList);
      e.target.value = "";
      console.log(
        "[MediaLib] captured",
        files.length,
        "file(s):",
        files.map((f) => f.name),
      );

      setUploading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          console.error("[MediaLib] Not authenticated — cannot upload");
          setUploading(false);
          return;
        }

        for (const file of files) {
          const ext = file.name.split(".").pop() ?? "jpg";
          const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const path = `${user.id}/${activeTab}/${fileName}`;
          console.log(
            "[MediaLib] uploading:",
            path,
            "size:",
            file.size,
            "type:",
            file.type,
          );

          const { data, error } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, { contentType: file.type, upsert: false });

          if (error) {
            console.error("[MediaLib] upload error:", error);
          } else {
            console.log("[MediaLib] upload success:", data);
          }
        }

        // Refresh the list (full re-fetch to show newly uploaded files at top)
        offsetRef.current = 0;
        await fetchItems(activeTab, true);
      } catch (err) {
        console.error("[MediaLib] upload exception:", err);
      } finally {
        setUploading(false);
      }
    },
    [activeTab, fetchItems, supabase],
  );

  /* ── Delete directly via Supabase client ── */
  const handleDelete = useCallback(
    async (item: MediaItem) => {
      setDeleting(item.name);
      console.log("[MediaLib] deleting:", item.name);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          console.error("[MediaLib] Not authenticated — cannot delete");
          setDeleting(null);
          return;
        }

        const path = `${user.id}/${activeTab}/${item.name}`;
        console.log("[MediaLib] remove path:", path);

        const { error } = await supabase.storage.from(BUCKET).remove([path]);

        if (error) {
          console.error("[MediaLib] delete error:", error);
        } else {
          console.log("[MediaLib] delete success");
          setItems((prev) => prev.filter((i) => i.name !== item.name));
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(item.url);
            return next;
          });
        }
      } catch (err) {
        console.error("[MediaLib] delete exception:", err);
      } finally {
        setDeleting(null);
      }
    },
    [activeTab, supabase],
  );

  const toggleSelect = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        if (!multiSelect) next.clear();
        next.add(url);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    onSelect(Array.from(selected));
    onOpenChange(false);
  };

  /* ── Upload button click handler ── */
  const triggerFileInput = () => {
    console.log(
      "[MediaLib] Upload button clicked, ref exists:",
      !!fileInputRef.current,
    );
    fileInputRef.current?.click();
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Media Library"
      description="Upload and manage your media assets"
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        {/* Single hidden file input — lives outside tabs so the ref is always stable */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as MediaCategory)}
        >
          <TabsList className="w-full">
            {TAB_META.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                disabled={tab.disabled}
                className={cn("flex-1 gap-1.5", tab.disabled && "opacity-40")}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Instagram tab */}
          <TabsContent value="instagram">
            {/* Club selector — only shown for 'user' accounts without a clubId prop */}
            {!clubId && !isOrg && (
              <div className="pb-3">
                {clubsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading clubs…
                  </div>
                ) : adminClubs.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground shrink-0">Club:</span>
                    <AdminClubSelector
                      clubs={adminClubs}
                      selectedClubId={selectedInstagramClubId}
                      onSelect={(val) => {
                        setSelectedInstagramClubId(val);
                        setInstagramImages([]);
                        fetchInstagramImages(val);
                      }}
                    />
                  </div>
                ) : null}
              </div>
            )}

            {instagramLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !instagramFetched ? (
              /* No fetch triggered yet — only reachable for user accounts with no admin clubs */
              !effectiveClubId && !clubsLoading ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <Instagram className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    You are not an admin of any clubs.
                  </p>
                </div>
              ) : (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )
            ) : instagramImages.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Instagram className="h-10 w-10 text-muted-foreground/40" />
                <div>
                  <p className="font-medium text-muted-foreground">
                    No Instagram images found
                  </p>
                  <p className="text-sm text-muted-foreground/60">
                    Images from your club&apos;s Instagram posts will appear
                    here.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 pb-3">
                  <p className="text-sm text-muted-foreground">
                    {instagramImages.length} image
                    {instagramImages.length !== 1 ? "s" : ""} from Instagram
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 max-h-[50vh] overflow-y-auto pr-1">
                  {instagramImages.map((img, idx) => {
                    const isSelected = selected.has(img.image_url);
                    return (
                      <div
                        key={`${img.post_id}-${idx}`}
                        className={cn(
                          "group relative aspect-square overflow-hidden rounded-lg border-2 cursor-pointer transition-all",
                          isSelected
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-transparent hover:border-muted-foreground/30",
                        )}
                        onClick={() => toggleSelect(img.image_url)}
                        title={img.caption || undefined}
                      >
                        <Image
                          src={img.image_url}
                          alt={img.caption || "Instagram image"}
                          fill
                          className="object-cover"
                          sizes="150px"
                        />

                        {/* Selected indicator */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                            <div className="rounded-full bg-primary p-1">
                              <Check className="h-4 w-4 text-primary-foreground" />
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          {/* Active content tabs */}
          {(["images", "companies", "panelists"] as MediaCategory[]).map(
            (cat) => (
              <TabsContent key={cat} value={cat}>
                {/* Upload bar */}
                <div className="flex items-center justify-between gap-2 pb-3">
                  <p className="text-sm text-muted-foreground">
                    {items.length} file{items.length !== 1 ? "s" : ""}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={uploading}
                    onClick={triggerFileInput}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Upload
                  </Button>
                </div>

                {/* Grid */}
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <ImagePlus className="h-10 w-10 text-muted-foreground/40" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        No {cat} uploaded yet
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        Upload files to build your media library
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    ref={scrollContainerRef}
                    className="grid grid-cols-3 gap-2 sm:grid-cols-4 max-h-[50vh] overflow-y-auto pr-1"
                  >
                    {items.map((item) => {
                      const isSelected = selected.has(item.url);
                      const isDeleting = deleting === item.name;
                      return (
                        <div
                          key={item.name}
                          className={cn(
                            "group relative aspect-square overflow-hidden rounded-lg border-2 cursor-pointer transition-all",
                            isSelected
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-transparent hover:border-muted-foreground/30",
                          )}
                          onClick={() => toggleSelect(item.url)}
                        >
                          <Image
                            src={item.url}
                            alt={item.name}
                            fill
                            className="object-cover"
                            sizes="150px"
                          />

                          {/* Selected indicator */}
                          {isSelected && (
                            <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                              <div className="rounded-full bg-primary p-1">
                                <Check className="h-4 w-4 text-primary-foreground" />
                              </div>
                            </div>
                          )}

                          {/* Delete button */}
                          <button
                            type="button"
                            className="absolute top-1 right-1 rounded-md bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item);
                            }}
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5 text-white" />
                            )}
                          </button>
                        </div>
                      );
                    })}

                    {/* Infinite scroll sentinel */}
                    <div
                      ref={sentinelRef}
                      className="col-span-full flex justify-center py-2"
                    >
                      {loadingMore && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
            ),
          )}
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0}
            onClick={handleConfirm}
          >
            {selected.size > 0
              ? `Select ${selected.size} file${selected.size > 1 ? "s" : ""}`
              : "Select"}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
