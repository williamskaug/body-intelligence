import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_PATHS, loadTemplates } from "@/lib/memory/templates";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Supabase appends ?error=...&error_code=... when the magic link is
  // invalid, expired, or already-consumed (often by an email link scanner).
  const errorCode = searchParams.get("error_code");
  if (errorCode) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorCode)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  await seedNewUser(supabase, user);

  return NextResponse.redirect(`${origin}${next}`);
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
