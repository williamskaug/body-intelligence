"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const NEXT_COOKIE = "bi_next";
const NEXT_COOKIE_MAX_AGE = 60 * 30; // 30 minutes — covers email-click latency.

export async function signInWithMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = String(formData.get("next") ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/login?error=invalid_email");
  }

  // Stash where to redirect after sign-in. The magic link itself only carries
  // token_hash; the cookie rides along on the same browser that requested it.
  const cookieJar = await cookies();
  if (next && isSafeNextPath(next)) {
    cookieJar.set(NEXT_COOKIE, next, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: NEXT_COOKIE_MAX_AGE,
    });
  } else {
    cookieJar.delete(NEXT_COOKIE);
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/login?sent=${encodeURIComponent(email)}`);
}

// Same-origin paths only. No `//` (protocol-relative), no full URLs.
function isSafeNextPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}
