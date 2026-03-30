"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import EventForm from "@/components/events/EventForm";
import { fetchEvent, type FetchedEventData } from "@/lib/api/fetchEvent";

/**
 * Client component that loads the event form.
 * Auth has already been verified server-side before this renders.
 */
export default function EditEventClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [data, setData] = useState<FetchedEventData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;

    fetchEvent(eventId)
      .then((result) => {
        setData(result);
        // Record this event as recently viewed (fire-and-forget)
        fetch(`/api/events/${eventId}/view`, { method: "POST" }).catch(
          () => {},
        );
      })
      .catch((err) => {
        console.error("Failed to load event:", err);
        toast.error("Failed to load event");
        router.push("/");
      })
      .finally(() => setLoading(false));
  }, [eventId, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  return <EventForm mode="edit" eventId={eventId} data={data} />;
}
