import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/serverInstance";
import { ReceiptTemplate, LineItem } from "@/components/templates/receipt";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

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

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    console.log("EVENT TYPE", event.type);

    if (!allowedEvents.includes(event.type)) {
      return new Response("Event type not allowed", { status: 200 });
    }

    // Handle events
    if (event.type === "checkout.session.completed") {
      // The main event. Runs after a user creates a purchase through Stripe

      const _session = event.data.object as Stripe.Checkout.Session;
      const customerId = _session.customer as string | null;

      // Expand the current session to get more attributes
      const completeSession = await stripe.checkout.sessions.retrieve(_session.id, {
        expand: ['line_items', 'line_items.data.price.product'],
      });

      const customerName = completeSession.customer_details?.name?.split(' ')[0];
      const lineItems: LineItem[]  = completeSession.line_items!.data.map(item => {
        const hasPrice = !!item.price;
        const product = item.price!.product as Stripe.Product;
        return {
          name: hasPrice ? product!.name : "Product",
        thumbnail: hasPrice ? product!.images?.[0] ?? null : null,
        quantity: item.quantity!,
        price: hasPrice ? item.price!.unit_amount! : 0,
        currency: hasPrice ? item.price!.currency : "IDK",
        } 
      });

      const email = completeSession.customer_details?.email;

      // TODO Migrate Resend stuff to a separate function as paying for free events will bypass Stripe entirely
      // And probably session expansion stuff too
      console.log(`Payment completed for email ${email ?? "no email"}`);

      const { data, error } = await resend.emails.send({
        from: "Connect3 <ticketing@mail.connect3.app>",
        to: [email!],
        subject: "You're Checked In",
        // react: ReceiptTemplate({ firstName: "Tanat" })
        react: ReceiptTemplate({
          firstName: customerName ?? "Buyer",
          orderNumber: completeSession.id,
          lineItems: lineItems
        })
      });

      if (error) {
        return Response.json({ error }, { status: 500 });
      }

      if (!customerId) {
        // Guest checkout — no Stripe customer was created
        return new Response("No customer ID on session", { status: 200 });
      }

      return Response.json({ data })
    }

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const customerId = intent.customer as string | null;
      console.log("Payment succeeded");
    }

    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      console.log("Payment failed");
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    return new Response(
      `Webhook error: ${err instanceof Error ? err.message : "Unknown error"}`,
      { status: 400 }
    );
  }
}