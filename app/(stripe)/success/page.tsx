import { redirect } from "next/navigation";
import Stripe from "stripe";

// TODO add better UI

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id: string }> }) {
  const { session_id } = await searchParams;  // <-- await it first
  if (!session_id) {
    redirect("/"); // Maybe change to where the user previously was
  }

  const session = await stripe.checkout.sessions.retrieve(session_id);
  if (session.payment_status !== "paid") {
    redirect("/"); // Maybe change to where the user previously was
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <p>CONGRATS You buy something</p>
      <p>Order ID: {session.id}</p>
    </div>
  )
}
