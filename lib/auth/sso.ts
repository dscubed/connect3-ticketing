const SSO_BASE =
  process.env.NEXT_PUBLIC_SSO_BASE_URL || "http://connect3.app/auth/sso";

/**
 * Builds a login URL that redirects the user to connect3.app (or localhost in dev) for authentication.
 *
 * Flow:
 *  1. User clicks login on ticket.connect3.app
 *  2. Redirect to [SSO_BASE]/auth/sso (connect3.app in prod, localhost:3000 in dev)
 *  3. User authenticates (or is already logged in)
 *  4. Connects back to ticket.connect3.app/auth/callback?code=xxxx
 *  5. This app exchanges the code for its own Supabase session
 *
 * @param origin - The origin (e.g., "https://ticket.connect3.app")
 * @param redirectPath - The path on this app to redirect to after login (default: "/")
 */
export function getLoginUrl(
  origin: string,
  redirectPath: string = "/",
): string {
  const callbackUrl = `${origin}/auth/callback`;
  const finalRedirect = `${origin}${redirectPath}`;

  return `${SSO_BASE}?redirect_to=${encodeURIComponent(callbackUrl)}&next=${encodeURIComponent(finalRedirect)}`;
}
