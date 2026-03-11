import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkEventEditAccess } from "@/lib/api/fetchEventServer";
import EditEventClient from "./EditEventClient";
import Unauthorized from "./Unauthorized";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  /* ── Server-side auth check ── */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await checkEventEditAccess(id, user?.id ?? null);

  if (!result.allowed) {
    if (result.reason === "not_found") {
      notFound();
    }
    return <Unauthorized reason={result.reason} eventId={id} />;
  }

  /* ── Authorized — render the form ── */
  return <EditEventClient eventId={id} />;
}
