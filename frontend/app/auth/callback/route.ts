import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  // Supabase may include error info directly in the callback URL
  const errorParam = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");
  if (errorParam) {
    const errUrl = new URL(`${origin}/auth/auth-code-error`);
    errUrl.searchParams.set("error", errorParam);
    if (errorDesc) errUrl.searchParams.set("detail", errorDesc);
    return NextResponse.redirect(errUrl.toString());
  }

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Server Component context — middleware handles refresh.
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";
      if (isLocal) {
        return NextResponse.redirect(`${origin}${safeNext}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${safeNext}`);
      } else {
        return NextResponse.redirect(`${origin}${safeNext}`);
      }
    }

    // Code exchange failed — pass the reason to the error page
    const errUrl = new URL(`${origin}/auth/auth-code-error`);
    errUrl.searchParams.set("error", "code_exchange_failed");
    errUrl.searchParams.set("detail", error.message);
    return NextResponse.redirect(errUrl.toString());
  }

  // No code at all
  const errUrl = new URL(`${origin}/auth/auth-code-error`);
  errUrl.searchParams.set("error", "no_code");
  errUrl.searchParams.set("detail", "No authorization code received from Google");
  return NextResponse.redirect(errUrl.toString());
}
