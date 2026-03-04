"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import EventForm from "@/components/events/EventForm";
import { fetchEvent, type FetchedEventData } from "@/lib/api/fetchEvent";
import { useAuthStore } from "@/stores/authStore";

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<FetchedEventData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    fetchEvent(id)
      .then((result) => {
        // Verify ownership on client side
        if (user && result.creatorProfileId !== user.id) {
          toast.error("You don't have permission to edit this event.");
          router.push("/");
          return;
        }
        setData(result);
      })
      .catch((err) => {
        console.error("Failed to load event:", err);
        toast.error("Failed to load event");
        router.push("/");
      })
      .finally(() => setLoading(false));
  }, [id, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <EventForm
      mode="edit"
      eventId={id}
      initialData={data.formData}
      existingImages={data.existingImages}
      initialCarouselImages={data.carouselImages}
      initialHostsData={data.hostsData}
      initialSections={data.sections}
    />
  );
}
