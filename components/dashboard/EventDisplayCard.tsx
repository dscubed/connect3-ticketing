"use client";

import { EventCardDetails } from "../shared/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { CalendarDays, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { formatDateTBA } from "../shared/utils";
import { AvatarStack } from "../shared/AvatarStack";
import { Separator } from "../ui/separator";

export function EventDisplayCard({
  event,
  content,
}: {
  event: EventCardDetails;
  content?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Card
      key={event.id}
      className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md gap-3"
      onClick={() => router.push(`/events/${event.id}/edit`)}
    >
      {event.thumbnail && (
        <div className="aspect-square w-full overflow-hidden">
          <Image
            src={event.thumbnail}
            alt={event.name ?? "Event"}
            width={400}
            height={225}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm leading-tight line-clamp-1">
            {event.name || "Untitled Event"}
          </CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            {event.status === "draft" && (
              <Badge variant="outline" className="text-[11px]">
                Draft
              </Badge>
            )}
            {event.category && (
              <Badge variant="secondary" className="text-[11px]">
                {event.category}
              </Badge>
            )}
          </div>
        </div>
        <CardDescription className="flex flex-col gap-2 text-[11px] min-w-0">
          <span className="flex items-center gap-1 min-w-0">
            <AvatarStack
              profiles={[event.host, ...(event.collaborators || [])]}
              size="sm"
            />
            <span className="truncate">{event.host.first_name}</span>
            {event.collaborators && event.collaborators.length > 0
              ? ` +${event.collaborators.length}`
              : ""}
          </span>

          <span className="flex items-center gap-1 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <CalendarDays className="h-3 w-3 shrink-0" />
              <span>{formatDateTBA(event.start)}</span>
            </div>
            <Separator orientation="vertical" className="h-4! shrink-0 mx-2" />
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{event.location_name || "TBA"}</span>
            </div>
          </span>
        </CardDescription>
      </CardHeader>
      {content && <CardContent className="pt-0"> {content} </CardContent>}
    </Card>
  );
}
