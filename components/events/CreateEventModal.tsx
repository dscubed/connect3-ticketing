"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FaInstagram } from "react-icons/fa";
import {
  PenLine,
  ArrowLeft,
  Loader2,
  ImageIcon,
  MapPin,
  Calendar,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import Image from "next/image";

/* ── Types ── */

interface InstagramPost {
  id: string;
  posted_by: string;
  caption: string;
  timestamp: number | null;
  location: string | null;
  images: string[];
  collaborators: string[];
  fetched_at: string;
}

interface SlugProfile {
  id: string;
  first_name: string;
  avatar_url: string | null;
  slug: string;
}

/* ── Helpers ── */

function formatDate(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ── Post row sub-component ── */

function PostRow({
  post,
  isSelected,
  onSelect,
  slugToProfile,
  alreadyImported,
  isOwner,
  onDelete,
}: {
  post: InstagramPost;
  isSelected: boolean;
  onSelect: (post: InstagramPost) => void;
  slugToProfile: Record<string, SlugProfile>;
  alreadyImported: boolean;
  isOwner: boolean;
  onDelete: (postId: string) => void;
}) {
  // Resolve collaborator profiles (exclude the poster themselves)
  const collabProfiles = useMemo(() => {
    const profiles: SlugProfile[] = [];
    for (const slug of post.collaborators ?? []) {
      if (slug === post.posted_by) continue;
      const p = slugToProfile[slug];
      if (p) profiles.push(p);
    }
    return profiles;
  }, [post.collaborators, post.posted_by, slugToProfile]);

  const postedByProfile = slugToProfile[post.posted_by];

  return (
    <button
      type="button"
      onClick={() => !alreadyImported && onSelect(post)}
      disabled={alreadyImported}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border-2 p-3 text-left transition-all",
        alreadyImported
          ? "border-transparent opacity-50 cursor-not-allowed"
          : isSelected
            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
            : "border-transparent hover:bg-muted/50",
      )}
    >
      {/* Thumbnail(s) */}
      <div className="flex shrink-0 gap-1">
        <div className="relative h-20 w-20 overflow-hidden rounded-md">
          {post.images[0] ? (
            <Image
              src={post.images[0]}
              alt=""
              fill
              className="object-cover"
              sizes="80px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
        {post.images.length > 1 && (
          <div className="relative h-20 w-14 overflow-hidden rounded-md">
            <Image
              src={post.images[1]}
              alt=""
              fill
              className="object-cover"
              sizes="56px"
            />
            {post.images.length > 2 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <span className="text-sm font-semibold text-white">
                  +{post.images.length - 1}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Posted by */}
        {postedByProfile && (
          <div className="flex items-center gap-1.5 mb-1">
            <Avatar className="h-4 w-4">
              {postedByProfile.avatar_url && (
                <AvatarImage
                  src={postedByProfile.avatar_url}
                  alt={postedByProfile.first_name}
                />
              )}
              <AvatarFallback className="text-[8px]">
                {postedByProfile.first_name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              @{post.posted_by}
            </span>
          </div>
        )}

        {/* Caption */}
        <p className="text-sm leading-snug line-clamp-2">
          {post.caption || "No caption"}
        </p>

        {/* Already imported badge */}
        {alreadyImported && (
          <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Already imported
          </span>
        )}

        {/* Meta row */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {post.timestamp && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(post.timestamp)}
            </span>
          )}
          {post.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="max-w-35 truncate">{post.location}</span>
            </span>
          )}
        </div>

        {/* Collaborator avatars */}
        {collabProfiles.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">with</span>
            <div className="flex -space-x-1.5">
              {collabProfiles.slice(0, 3).map((p, i) => (
                <Avatar
                  key={p.id}
                  className="h-5 w-5 border border-background"
                  style={{ zIndex: 10 - i }}
                >
                  {p.avatar_url && (
                    <AvatarImage src={p.avatar_url} alt={p.first_name} />
                  )}
                  <AvatarFallback className="text-[8px]">
                    {p.first_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {collabProfiles.length > 3 && (
                <div className="z-0 flex h-5 w-5 items-center justify-center rounded-full border border-background bg-muted text-[8px] font-semibold">
                  +{collabProfiles.length - 3}
                </div>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {collabProfiles.map((p) => p.first_name).join(", ")}
            </span>
          </div>
        )}
      </div>

      {/* Selection indicator / delete button */}
      <div className="flex shrink-0 flex-col items-center gap-1 self-center">
        {isSelected && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
        {alreadyImported && isOwner && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(post.id);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete imported event"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </button>
  );
}

/* ── Post list ── */

function PostList({
  posts,
  loading,
  selectedId,
  onSelect,
  slugToProfile,
  importedIds,
  currentUserId,
  onDelete,
}: {
  posts: InstagramPost[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (post: InstagramPost) => void;
  slugToProfile: Record<string, SlugProfile>;
  importedIds: Set<string>;
  currentUserId: string | null;
  onDelete: (postId: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mb-2" />
        <p className="text-sm">Loading posts…</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <ImageIcon className="h-8 w-8 mb-2" />
        <p className="text-sm font-medium">No Instagram posts found</p>
        <p className="text-xs mt-1">
          Make sure your club&apos;s Instagram has been linked
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {posts.map((post) => (
        <PostRow
          key={post.id}
          post={post}
          isSelected={selectedId === post.id}
          onSelect={onSelect}
          slugToProfile={slugToProfile}
          alreadyImported={importedIds.has(post.id)}
          isOwner={
            currentUserId != null &&
            slugToProfile[post.posted_by]?.id === currentUserId
          }
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

/* ── Main component ── */

interface CreateEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEventModal({
  open,
  onOpenChange,
}: CreateEventModalProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [view, setView] = useState<"pick-method" | "instagram">("pick-method");
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [slugToProfile, setSlugToProfile] = useState<
    Record<string, SlugProfile>
  >({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  /* Delete confirmation state */
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    postId: string;
  }>({ open: false, postId: "" });
  const [deleting, setDeleting] = useState(false);

  /* Collaborator alert state */
  const [collabAlert, setCollabAlert] = useState<{
    open: boolean;
    profiles: SlugProfile[];
    eventId: string;
  }>({ open: false, profiles: [], eventId: "" });

  /* Reset state when dialog closes */
  useEffect(() => {
    if (!open) {
      setView("pick-method");
      setPosts([]);
      setSlugToProfile({});
      setSelectedPost(null);
      setImporting(false);
      setImportedIds(new Set());
    }
  }, [open]);

  /* Fetch posts when entering instagram view */
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media/instagram/posts");
      const json = await res.json();
      if (res.ok) {
        const fetchedPosts: InstagramPost[] = json.data ?? [];
        setPosts(fetchedPosts);
        setSlugToProfile(json.slugToProfile ?? {});

        // Check which posts are already imported (event exists with that ID)
        if (fetchedPosts.length > 0) {
          try {
            const ids = fetchedPosts.map((p) => p.id);
            const checkRes = await fetch(
              `/api/events/check-ids?${ids.map((id) => `ids=${encodeURIComponent(id)}`).join("&")}`,
            );
            if (checkRes.ok) {
              const checkJson = await checkRes.json();
              setImportedIds(new Set(checkJson.existingIds ?? []));
            }
          } catch {
            // Non-critical — just won't show "already imported" badges
          }
        }
      } else {
        console.error("Failed to fetch Instagram posts:", json.error);
      }
    } catch (err) {
      console.error("Failed to fetch Instagram posts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInstagramClick = () => {
    setView("instagram");
    fetchPosts();
  };

  /* Import the selected post */
  const handleImport = async () => {
    if (!selectedPost || importing) return;
    setImporting(true);

    try {
      const res = await fetch("/api/media/instagram/posts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: selectedPost.id }),
      });

      const json = await res.json();

      // Handle already-imported (409 conflict)
      if (res.status === 409 && json.eventId) {
        toast.info("This post has already been imported.");
        onOpenChange(false);
        router.push(`/events/${json.eventId}/edit`);
        return;
      }

      if (!res.ok) throw new Error(json.error ?? "Import failed");

      const { eventId, collaboratorProfiles } = json;

      onOpenChange(false);

      // If collaborators were detected, show alert then navigate
      if (collaboratorProfiles && collaboratorProfiles.length > 0) {
        setCollabAlert({
          open: true,
          profiles: collaboratorProfiles,
          eventId,
        });
      } else {
        router.push(`/events/${eventId}/edit`);
      }
    } catch (err) {
      console.error("Import failed:", err);
    } finally {
      setImporting(false);
    }
  };

  /* Delete an already-imported event */
  const handleDeleteConfirm = async () => {
    const { postId } = deleteConfirm;
    if (!postId || deleting) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/events/${postId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error ?? "Failed to delete event");
        return;
      }

      toast.success("Imported event deleted");
      setImportedIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete event");
    } finally {
      setDeleting(false);
      setDeleteConfirm({ open: false, postId: "" });
    }
  };

  const handleCollabAlertClose = () => {
    const eid = collabAlert.eventId;
    setCollabAlert({ open: false, profiles: [], eventId: "" });
    router.push(`/events/${eid}/edit`);
  };

  /* Resolve collaborator profiles for the selected post */
  const selectedCollabs = useMemo(() => {
    if (!selectedPost) return [];
    const profiles: SlugProfile[] = [];
    for (const slug of selectedPost.collaborators ?? []) {
      if (slug === selectedPost.posted_by) continue;
      const p = slugToProfile[slug];
      if (p) profiles.push(p);
    }
    return profiles;
  }, [selectedPost, slugToProfile]);

  return (
    <>
      {/* ── Method picker (always a centered Dialog) ── */}
      {view === "pick-method" && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Create Event</DialogTitle>
              <DialogDescription>
                How would you like to create your event?
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 pt-2">
              <Button
                variant="outline"
                className="h-auto justify-start gap-4 px-4 py-4"
                onClick={() => {
                  onOpenChange(false);
                  router.push("/events/create");
                }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PenLine className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Create from scratch</p>
                  <p className="text-xs text-muted-foreground">
                    Build your event page from the ground up
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto justify-start gap-4 px-4 py-4"
                onClick={handleInstagramClick}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-purple-500 to-pink-500 text-white">
                  <FaInstagram className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Import from Instagram</p>
                  <p className="text-xs text-muted-foreground">
                    Create from an existing Instagram post
                  </p>
                </div>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Instagram post picker (ResponsiveModal — sheet on mobile) ── */}
      {view === "instagram" && (
        <ResponsiveModal
          open={open}
          onOpenChange={onOpenChange}
          className="max-w-2xl"
        >
          {/* Custom header with back button */}
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                setView("pick-method");
                setSelectedPost(null);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold leading-none">
                Select a Post
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Choose an Instagram post to import as an event
              </p>
            </div>
          </div>

          <div className="max-h-[55vh] overflow-y-auto -mx-2 px-2">
            <PostList
              posts={posts}
              loading={loading}
              selectedId={selectedPost?.id ?? null}
              onSelect={setSelectedPost}
              slugToProfile={slugToProfile}
              importedIds={importedIds}
              currentUserId={user?.id ?? null}
              onDelete={(postId) => setDeleteConfirm({ open: true, postId })}
            />
          </div>

          {/* Footer bar when a post is selected */}
          {selectedPost && (
            <div className="border-t pt-3 mt-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium line-clamp-1">
                  {selectedPost.images.length} image
                  {selectedPost.images.length !== 1 ? "s" : ""}
                  {selectedPost.location && ` · ${selectedPost.location}`}
                  {selectedCollabs.length > 0 &&
                    ` · ${selectedCollabs.length} collaborator${selectedCollabs.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <Button
                onClick={handleImport}
                disabled={importing}
                className="shrink-0"
              >
                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import Post
              </Button>
            </div>
          )}
        </ResponsiveModal>
      )}

      {/* ── Collaborator detection alert ── */}
      <AlertDialog
        open={collabAlert.open}
        onOpenChange={(o) => {
          if (!o) handleCollabAlertClose();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Collaborators Detected</AlertDialogTitle>
            <AlertDialogDescription>
              We detected the following collaborators on this Instagram post and
              have added them as collaborators for your event:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-2 py-2">
            {collabAlert.profiles.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  {p.avatar_url && (
                    <AvatarImage src={p.avatar_url} alt={p.first_name} />
                  )}
                  <AvatarFallback className="text-xs">
                    {p.first_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{p.first_name}</p>
                  <p className="text-xs text-muted-foreground">@{p.slug}</p>
                </div>
              </div>
            ))}
          </div>

          <AlertDialogFooter>
            <AlertDialogAction onClick={handleCollabAlertClose}>
              Continue to Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete confirmation alert ── */}
      <AlertDialog
        open={deleteConfirm.open}
        onOpenChange={(o) => {
          if (!o) setDeleteConfirm({ open: false, postId: "" });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Imported Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this imported event? This will
              permanently remove the event and all its data. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setDeleteConfirm({ open: false, postId: "" })}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Cancel
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
