import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_PATHS, loadTemplates } from "@/lib/memory/templates";

export const runtime = "nodejs";

const NEXT_COOKIE = "bi_next";

type EmailOtpType = "magiclink" | "signup" | "invite" | "recovery" | "email_change" | "email";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Resolve the post-auth destination. Priority:
  //   1. bi_next cookie set on /login (survives the round-trip through email)
  //   2. ?next= on the callback URL (in case the email template carries it)
  //   3. "/"
  const cookieJar = await cookies();
  const nextCookie = cookieJar.get(NEXT_COOKIE)?.value;
  const nextParam = searchParams.get("next");
  const next = pickSafeNext(nextCookie ?? nextParam ?? "/");

  // Supabase appends ?error=...&error_code=... when the magic link is
  // invalid, expired, or already-consumed (often by an email link scanner).
  const errorCode = searchParams.get("error_code") ?? searchParams.get("error");
  if (errorCode) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorCode)}`);
  }

  if (!code && !tokenHash) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();

  if (tokenHash && type) {
    // SSR token_hash flow — what Supabase's recommended email template uses.
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (verifyError) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(verifyError.message)}`,
      );
    }
  } else if (code) {
    // PKCE flow — kept as a fallback in case the email template uses it.
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`,
      );
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  await seedNewUser(supabase, user);

  // Consume the cookie so a later sign-in doesn't re-redirect into a stale path.
  if (nextCookie) cookieJar.delete(NEXT_COOKIE);

  return NextResponse.redirect(`${origin}${next}`);
}

function pickSafeNext(value: string): string {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type AuthUser = NonNullable<
  Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"]
>;

async function seedNewUser(supabase: SupabaseClient, user: AuthUser) {
  // Idempotent: only seeds if user_profiles row is missing.
  const { data: existing } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return;

  const displayName = user.email?.split("@")[0] ?? null;

  const { error: profileError } = await supabase.from("user_profiles").insert({
    user_id: user.id,
    display_name: displayName,
  });

  if (profileError) {
    console.error("[auth/callback] seed profile failed", profileError);
    return;
  }

  const templates = loadTemplates();
  const documents = TEMPLATE_PATHS.map((path) => ({
    user_id: user.id,
    path,
    content: templates[path],
  }));

  const { error: docsError } = await supabase.from("documents").insert(documents);

  if (docsError) {
    console.error("[auth/callback] seed documents failed", docsError);
  }
}
