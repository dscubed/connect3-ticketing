"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventImageUpload } from "@/components/events/EventImageUpload";
import {
  EventDatePicker,
  type DateTimeData,
} from "@/components/events/EventDatePicker";
import {
  EventHostsPicker,
  type ClubProfile,
} from "@/components/events/EventHostsPicker";
import { EventCategoryPicker } from "@/components/events/EventCategoryPicker";
import { EventTagsPicker } from "@/components/events/EventTagsPicker";
import { useAuthStore } from "@/stores/authStore";
import { ArrowLeft, MapPin, Users, Loader2 } from "lucide-react";

export interface EventFormData {
  name: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timezone: string;
  location: string;
  isOnline: boolean;
  category: string;
  tags: string[];
  hostIds: string[];
  thumbnailFile: File | null;
}

interface EventFormProps {
  /** Pre-filled data for edit mode */
  initialData?: Partial<EventFormData>;
  /** Existing thumbnail URL (edit mode) */
  existingThumbnail?: string | null;
  /** Form mode */
  mode?: "create" | "edit";
  /** Called on form submit */
  onSubmit?: (data: EventFormData) => Promise<void>;
}

export default function EventForm({
  initialData,
  existingThumbnail,
  mode = "create",
}: EventFormProps) {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<EventFormData>({
    name: initialData?.name ?? "",
    description: initialData?.description ?? "",
    startDate: initialData?.startDate ?? "",
    startTime: initialData?.startTime ?? "",
    endDate: initialData?.endDate ?? "",
    endTime: initialData?.endTime ?? "",
    timezone:
      initialData?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    location: initialData?.location ?? "",
    isOnline: initialData?.isOnline ?? false,
    category: initialData?.category ?? "",
    tags: initialData?.tags ?? [],
    hostIds: initialData?.hostIds ?? [],
    thumbnailFile: null,
  });

  // Cache the full profile objects for additional hosts
  const [hostsData, setHostsData] = useState<ClubProfile[]>([]);

  // Build creator profile for the hosts picker (always included)
  const creatorProfile: ClubProfile = {
    id: profile?.id ?? "",
    first_name: profile?.first_name ?? "You",
    avatar_url: profile?.avatar_url ?? null,
  };

  const updateField = <K extends keyof EventFormData>(
    key: K,
    value: EventFormData[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: implement actual save logic (API call)
      console.log("Saving event:", form);
      await new Promise((r) => setTimeout(r, 1000)); // placeholder
      router.push("/");
    } catch (err) {
      console.error("Failed to save event:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-14 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !form.name}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Create Event" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* ── Hero Section ── */}
        <div className="space-y-6">
          {/* Thumbnail (1:1, 2/3 width, centred) */}
          <div className="flex justify-center">
            <EventImageUpload
              currentImage={existingThumbnail}
              onImageChange={(file) => updateField("thumbnailFile", file)}
            />
          </div>

          {/* Event Name */}
          <Input
            placeholder="Event name"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="h-auto border-0 bg-transparent px-0 text-5xl! font-bold tracking-tight placeholder:text-muted-foreground/40 focus-visible:ring-0"
          />

          {/* Category pill + Tags pills */}
          <div className="flex flex-wrap items-center gap-2">
            <EventCategoryPicker
              value={form.category}
              onChange={(cat) => updateField("category", cat)}
            />
            <EventTagsPicker
              value={form.tags}
              onChange={(tags) => updateField("tags", tags)}
            />
          </div>

          {/* ── Meta rows ── */}
          <div className="space-y-3">
            {/* Date */}
            <EventDatePicker
              value={{
                startDate: form.startDate,
                startTime: form.startTime,
                endDate: form.endDate,
                endTime: form.endTime,
                timezone: form.timezone,
              }}
              onChange={(d: DateTimeData) =>
                setForm((prev) => ({
                  ...prev,
                  startDate: d.startDate,
                  startTime: d.startTime,
                  endDate: d.endDate,
                  endTime: d.endTime,
                  timezone: d.timezone,
                }))
              }
            />

            {/* Location */}
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" />
              <Input
                placeholder="Add location"
                value={form.location}
                onChange={(e) => updateField("location", e.target.value)}
                className="h-auto border-0 bg-transparent p-0 text-base placeholder:text-muted-foreground focus-visible:ring-0"
              />
            </div>

            {/* Hosts */}
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
              <EventHostsPicker
                creatorProfile={creatorProfile}
                selectedHosts={form.hostIds}
                selectedHostsData={hostsData}
                onChange={(ids, data) => {
                  updateField("hostIds", ids);
                  setHostsData(data);
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Content Cards ── */}
        <div className="mt-10 space-y-6">
          {/* Event Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Event Description</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Tell people what your event is about..."
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={6}
                className="resize-none"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
