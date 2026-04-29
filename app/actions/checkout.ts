'use server';

import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AttendeeData } from '@/lib/hooks/useAttendeeData';
import { TicketingField, TicketingFieldDraft } from '@/lib/types/ticketing';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Server action to create a Stripe checkout session 
 * @param priceId 
 * @returns 
 */
export async function createCheckoutSession(
  eventId: string,
  priceId: string,
  attendeeData: AttendeeData,
  additionalFields?: TicketingFieldDraft[],
  quantity?: number
) {
  console.log("ATTENDEE ", Object.keys(attendeeData))
  console.log("FIELDS ", additionalFields);
  // Perhaps change price id to support creating checkout session for multiple items
  // Unless we want to enforce buy one ticket at a time and not have a cart system

  // Attempt to get authenticated user
  // If the user is not authenticated treat them as a guest
  // and skip all any stuff with membership points or logging transactions
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    console.log("Not authenticated");
  }

  // Get customer id, creating one if it doesn't exist
  // let customerId;
  // const customerData = await getStripeCustomerData(user.id);
  // if (customerData) {
  //   customerId = customerData.customerId;
  // } else {
  //   // Create new stripe customer
  //   const customer = await stripe.customers.create({
  //     email: user.email ?? undefined,
  //     metadata: {
  //       userId: user.id
  //     }
  //   });
  //   customerId = customer.id;
  //   await syncOrCreateStripeData(user.id, { customerId: customerId });
  // }

  // Create checkout session
  console.log(process.env.NEXT_PUBLIC_SITE_URL);
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: quantity,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`, // Change
    metadata: {
      event_id: eventId
    },
  });

  // Redirect to Stripe's checkout page
  redirect(checkoutSession.url!);
}