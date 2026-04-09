/**
 * Functions for interacting with the stripe_user_cache table / KV store in Supabase, which maps
 * User Ids to Stripe Customer Ids.
 * https://github.com/t3dotgg/stripe-recommendations
 */

import { createClient } from "./server";
import z from "zod";

const StripeCacheDataSchema = z.object({
  customerId: z.string()
});

export type StripeCacheData = z.infer<typeof StripeCacheDataSchema>;

/**
 * Given a user ID, fetch the associated Stripe data which at a minimum will include
 * their Customer ID, returns null if no data is found or is there's an error.
 * @param userId 
 * @returns 
 */
export async function getStripeCustomerData(userId: string): Promise<StripeCacheData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stripe_user_cache')
    .select('customer_data')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching Stripe customer ID:', error);
    return null;
  }

  const unwrapped = StripeCacheDataSchema.safeParse(data?.customer_data);
  if (!unwrapped.success) {
    console.error('Invalid data format for Stripe customer cache:', unwrapped.error);
    return null;
  }

  return unwrapped.data;
}

export async function syncOrCreateStripeData(userId: string, data: StripeCacheData): Promise<void> {
  // If we want to support subscriptions we'll need to keep track of the user's subscription status
  // Fetch the customer's active subscriptions and store them alongside StripeCacheData

  
  // Write StripeCacheData
  const supabase = await createClient();
  const { error } = await supabase
    .from('stripe_user_cache')
    .upsert({
      user_id: userId,
      customer_data: data
    });

  if (error) {
    throw new Error(`Failed to set Stripe customer data: ${error.message}`);
  }
}