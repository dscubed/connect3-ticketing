import type {
  EventFormData,
  CarouselImage,
} from "@/components/events/shared/types";
import type { SectionData } from "@/components/events/sections/types";

/**
 * Build multipart FormData and POST to /api/events.
 *
 * @param form       The main form state
 * @param images     Carousel images (may include blob-only items)
 * @param sections   Dynamic section cards
 * @returns          The created event ID
 */
export async function createEvent(
  form: EventFormData,
  images: CarouselImage[],
  sections: SectionData[],
): Promise<string> {
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

  /* ── JSON-encoded arrays ── */
  fd.append("tags", JSON.stringify(form.tags));
  fd.append("hostIds", JSON.stringify(form.hostIds));

  /* Pricing — strip the client-side `id` field */
  fd.append(
    "pricing",
    JSON.stringify(
      form.pricing.map((t) => ({ label: t.label, price: t.price })),
    ),
  );

  /* Links — strip the client-side `id` field */
  fd.append(
    "links",
    JSON.stringify(form.links.map((l) => ({ url: l.url, title: l.title }))),
  );

  /* Theme */
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

  /* ── Carousel image files ── */
  for (const img of images) {
    if (img.file) {
      fd.append("images", img.file);
    }
  }

  /* ── Sections + section files ── */

  // Clone section data so we can strip blob URLs before sending JSON
  const sectionsClone: SectionData[] = JSON.parse(JSON.stringify(sections));

  sections.forEach((section, secIdx) => {
    if (section.type === "panelists") {
      section.items.forEach((item, itemIdx) => {
        if (item.imageUrl && item.imageUrl.startsWith("blob:")) {
          // We need to extract the original File. The component stored a blob URL,
          // so we fetch it and append. But we actually have the File in the original
          // form state — unfortunately it's only stored as a blob URL.
          // We'll resolve this by converting the blob URL to a File below.
          // For now, mark in the clone that this needs uploading.
          (sectionsClone[secIdx] as typeof section).items[itemIdx].imageUrl =
            "__upload__";
        }
      });
    }
    if (section.type === "companies") {
      section.items.forEach((item, itemIdx) => {
        if (item.logoUrl && item.logoUrl.startsWith("blob:")) {
          (sectionsClone[secIdx] as typeof section).items[itemIdx].logoUrl =
            "__upload__";
        }
      });
    }
  });

  // Fetch blob URLs → File objects and append as sectionFile-{secIdx}-{itemIdx}
  const fetchPromises: Promise<void>[] = [];
  sections.forEach((section, secIdx) => {
    if (section.type === "panelists") {
      section.items.forEach((item, itemIdx) => {
        if (item.imageUrl && item.imageUrl.startsWith("blob:")) {
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
  const res = await fetch("/api/events", {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Event creation failed (${res.status})`);
  }

  const { id } = await res.json();
  return id as string;
}
