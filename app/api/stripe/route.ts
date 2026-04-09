import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/serverInstance";
import { syncOrCreateStripeData } from "@/lib/supabase/stripeKV";

// Infamous Stripe webhooks

// Allowed events for only one time payments
// Add more to support things like subscriptions
const allowedEvents: Stripe.Event.Type[] = [
  "checkout.session.completed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed"
]

export async function POST(request: Request) {
  try {
    const body = await request.text();

    const signature = (await headers()).get("Stripe-Signature");
    if (!signature) {
      return new Response("Missing Stripe signature", { status: 401 });
    }

    if (typeof signature !== "string") {
      return new Response("Stripe signature is not a string somehow", { status: 500 });
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    // Stripe emits a lot of webhook events in a nondeterministic order,
    // We handle only the events we care about and ignore the rest
    // If we want to add support for subscriptions
    // Add subscription events to the allowedEvents array

    if (!allowedEvents.includes(event.type)) {
      // Status 200 = Not quite an error just an ignore
      return new Response("Event type not allowed", { status: 200 });
    }

    const { customer: customerId } = event.data.object as {
      customer: string;
    }

    if (typeof customerId !== "string") {
      throw new Error("[STRIPE] customer Id is not a string somehow");
    }

    // Update stripe data
    await syncOrCreateStripeData(customerId, { customerId: customerId});
  } catch (err) {
    return new Response(`Webhook error: ${err instanceof Error ? err.message : "Unknown error"}`, { status: 400 });
  }
}
