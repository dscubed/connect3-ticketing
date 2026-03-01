"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import {
  CalendarDays,
  Plus,
  Ticket,
  Loader2,
  MapPin,
  Globe,
} from "lucide-react";

interface Event {
  id: string;
  name: string | null;
  description: string | null;
  start: string | null;
  end: string | null;
  thumbnail: string | null;
  is_online: boolean;
  capacity: number | null;
  category: string | null;
  published_at: string;
}

export function OrgDashboard() {
  const { user } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchEvents() {
      try {
        const res = await fetch(`/api/events?creator_id=${user!.id}`);
        if (res.ok) {
          const { data } = await res.json();
          setEvents(data ?? []);
        }
      } catch (err) {
        console.error("Failed to fetch events:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [user]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "TBA";
    return new Date(dateStr).toLocaleDateString("en-AU", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Events</h1>
          <p className="text-muted-foreground">
            Manage your events and set up ticketing forms.
          </p>
        </div>
        <Button disabled className="gap-2">
          <Plus className="h-4 w-4" />
          Create Event
        </Button>
      </div>

      {/* Events grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-medium">No events yet</p>
              <p className="text-sm text-muted-foreground">
                Your events from Connect3 will appear here. Create ticketing
                forms for them to start selling.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <Card key={event.id} className="overflow-hidden">
              {event.thumbnail && (
                <div className="aspect-video w-full overflow-hidden">
                  <Image
                    src={event.thumbnail}
                    alt={event.name ?? "Event"}
                    width={400}
                    height={225}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">
                    {event.name ?? "Untitled Event"}
                  </CardTitle>
                  {event.category && (
                    <Badge variant="secondary" className="shrink-0 text-[11px]">
                      {event.category}
                    </Badge>
                  )}
                </div>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <CalendarDays className="h-3 w-3" />
                  {formatDate(event.start)}
                  {event.is_online ? (
                    <span className="ml-2 flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Online
                    </span>
                  ) : (
                    <span className="ml-2 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> In-person
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  disabled
                >
                  <Ticket className="h-4 w-4" />
                  Set up Ticketing
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
