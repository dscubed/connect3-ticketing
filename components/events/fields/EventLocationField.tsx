"use client";

import { useEventEditor } from "../shared/EventEditorContext";
import { LocationDisplay } from "../preview/LocationDisplay";

export function EventLocationField() {
  const { form } = useEventEditor();
  const realVenues = form.venues.filter((v) => v.type !== "tba");
  const extraVenues = realVenues.length > 1 ? realVenues.length - 1 : undefined;
  return <LocationDisplay value={form.location} extraVenues={extraVenues} />;
}
