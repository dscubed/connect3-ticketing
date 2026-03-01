import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");
  const next = searchParams.get("next");
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (!error) {
      const redirectTo = next ?? "/";
      const forwardUrl = redirectTo.startsWith("http")
        ? redirectTo
        : `${origin}${redirectTo}`;
      return NextResponse.redirect(forwardUrl);
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const redirectTo = next ?? "/";
      const forwardUrl = redirectTo.startsWith("http")
        ? redirectTo
        : `${origin}${redirectTo}`;
      return NextResponse.redirect(forwardUrl);
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
