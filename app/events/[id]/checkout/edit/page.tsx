import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkEventEditAccess } from "@/lib/api/fetchEventServer";
import CheckoutForm from "@/components/events/checkout/checkout-form";
import Unauthorized from "../../edit/Unauthorized";

export default async function CheckoutEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  /* ── Server-side auth check (same as event edit) ── */
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

  /* ── Authorized — render checkout editor ── */
  return <CheckoutForm eventId={id} mode="edit" />;
}
