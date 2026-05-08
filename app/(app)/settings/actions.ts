"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export async function revokeClientAction(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sb = adminClient();
  const nowIso = new Date().toISOString();
  const { error } = await sb
    .from("oauth_tokens")
    .update({ revoked_at: nowIso })
    .eq("user_id", user.id)
    .eq("client_id", clientId)
    .is("revoked_at", null);
  if (error) throw new Error(`revokeClientAction: ${error.message}`);

  revalidatePath("/settings");
}
