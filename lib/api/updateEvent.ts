import type {
  EventFormData,
  CarouselImage,
} from "@/components/events/shared/types";
import type { SectionData } from "@/components/events/sections/types";

/**
 * PUT JSON to /api/events/[id] to update an event.
 * All images are already uploaded as URLs — no FormData needed.
 *
 * @param eventId    The existing event ID
 * @param form       The main form state
 * @param images     Carousel images (URL-only)
 * @param sections   Dynamic section cards
 */
export async function updateEvent(
  eventId: string,
  form: EventFormData,
  images: CarouselImage[],
  sections: SectionData[],
  status?: "draft" | "published",
): Promise<void> {
  const body = {
    ...(status !== undefined && { status }),
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

  const res = await fetch(`/api/events/${eventId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Event update failed (${res.status})`);
  }
}
