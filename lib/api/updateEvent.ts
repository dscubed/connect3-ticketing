import type {
  EventFormData,
  CarouselImage,
} from "@/components/events/shared/types";
import type { SectionData } from "@/components/events/sections/types";

/**
 * Build multipart FormData and PUT to /api/events/[id].
 *
 * @param eventId    The existing event ID
 * @param form       The main form state
 * @param images     Carousel images (may include existing URLs and new blobs)
 * @param sections   Dynamic section cards
 */
export async function updateEvent(
  eventId: string,
  form: EventFormData,
  images: CarouselImage[],
  sections: SectionData[],
): Promise<void> {
  const fd = new FormData();

  /* ── Scalars ── */
  fd.append("name", form.name);
  fd.append("description", form.description);
  fd.append("startDate", form.startDate);
  fd.append("startTime", form.startTime);
  fd.append("endDate", form.endDate);
  fd.append("endTime", form.endTime);
  fd.append("timezone", form.timezone);
  fd.append("isOnline", String(form.isOnline));
  fd.append("category", form.category);

  /* ── JSON arrays ── */
  fd.append("tags", JSON.stringify(form.tags));
  fd.append("hostIds", JSON.stringify(form.hostIds));
  fd.append(
    "pricing",
    JSON.stringify(
      form.pricing.map((t) => ({ label: t.label, price: t.price })),
    ),
  );
  fd.append(
    "links",
    JSON.stringify(form.links.map((l) => ({ url: l.url, title: l.title }))),
  );
  fd.append("theme", JSON.stringify(form.theme));

  /* ── Location ── */
  fd.append("location.displayName", form.location.displayName);
  fd.append("location.address", form.location.address);
  if (form.location.lat != null) {
    fd.append("location.lat", String(form.location.lat));
  }
  if (form.location.lon != null) {
    fd.append("location.lon", String(form.location.lon));
  }

  /* ── Carousel images ── */
  // Existing images the user kept (server URLs)
  const keepUrls = images
    .filter(
      (img) => !img.file && img.preview && !img.preview.startsWith("blob:"),
    )
    .map((img) => img.preview);
  fd.append("keepImageUrls", JSON.stringify(keepUrls));

  // New files
  for (const img of images) {
    if (img.file) {
      fd.append("images", img.file);
    }
  }

  /* ── Sections + section files ── */
  const sectionsClone: SectionData[] = JSON.parse(JSON.stringify(sections));

  const fetchPromises: Promise<void>[] = [];
  sections.forEach((section, secIdx) => {
    if (section.type === "panelists") {
      section.items.forEach((item, itemIdx) => {
        if (item.imageUrl && item.imageUrl.startsWith("blob:")) {
          (sectionsClone[secIdx] as typeof section).items[itemIdx].imageUrl =
            "__upload__";
          fetchPromises.push(
            fetch(item.imageUrl)
              .then((r) => r.blob())
              .then((blob) => {
                fd.append(
                  `sectionFile-${secIdx}-${itemIdx}`,
                  new File([blob], `panelist-${itemIdx}.jpg`, {
                    type: blob.type,
                  }),
                );
              }),
          );
        }
      });
    }
    if (section.type === "companies") {
      section.items.forEach((item, itemIdx) => {
        if (item.logoUrl && item.logoUrl.startsWith("blob:")) {
          (sectionsClone[secIdx] as typeof section).items[itemIdx].logoUrl =
            "__upload__";
          fetchPromises.push(
            fetch(item.logoUrl)
              .then((r) => r.blob())
              .then((blob) => {
                fd.append(
                  `sectionFile-${secIdx}-${itemIdx}`,
                  new File([blob], `company-${itemIdx}.jpg`, {
                    type: blob.type,
                  }),
                );
              }),
          );
        }
      });
    }
  });
  await Promise.all(fetchPromises);

  fd.append("sections", JSON.stringify(sectionsClone));

  /* ── Call API ── */
  const res = await fetch(`/api/events/${eventId}`, {
    method: "PUT",
    body: fd,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Event update failed (${res.status})`);
  }
}
