import type {
  EventFormData,
  CarouselImage,
} from "@/components/events/shared/types";
import type { SectionData } from "@/components/events/sections/types";

/**
 * POST JSON to /api/events to create a new event.
 * All images are already uploaded as URLs — no FormData needed.
 *
 * @param eventId    The pre-generated event ID
 * @param form       The main form state
 * @param images     Carousel images (URL-only)
 * @param sections   Dynamic section cards
 * @returns          The created event ID
 */
export async function createEvent(
  eventId: string,
  form: EventFormData,
  images: CarouselImage[],
  sections: SectionData[],
  status: "draft" | "published" = "draft",
): Promise<string> {
  const body = {
    id: eventId,
    status,
    name: form.name,
    description: form.description,
    startDate: form.startDate,
    startTime: form.startTime,
    endDate: form.endDate,
    endTime: form.endTime,
    timezone: form.timezone,
    isOnline: form.isOnline,
    category: form.category,
    tags: form.tags,
    hostIds: form.hostIds,
    pricing: form.pricing.map((t) => ({
      memberVerification: t.memberVerification,
      name: t.name,
      price: t.price,
      quantity: t.quantity ?? null,
      offerStartDate: t.offerStartDate,
      offerStartTime: t.offerStartTime,
      offerEndDate: t.offerEndDate,
      offerEndTime: t.offerEndTime,
    })),
    eventCapacity: form.eventCapacity ?? null,
    links: form.links.map((l) => ({ url: l.url, title: l.title })),
    theme: form.theme,
    location: form.location,
    imageUrls: images
      .filter((img) => img.url && !img.uploading)
      .map((img) => img.url),
    sections: sections.map((s) => ({ type: s.type, data: s })),
  };

  const res = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Event creation failed (${res.status})`);
  }

  const { id } = await res.json();
  return id as string;
}
