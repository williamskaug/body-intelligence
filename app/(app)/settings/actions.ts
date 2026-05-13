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

const UNITS = new Set(["metric", "imperial"]);

export async function updateProfileAction(
  _prev: { ok?: boolean; error?: string } | undefined,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const timezoneRaw = String(formData.get("timezone") ?? "").trim();
  const unitsRaw = String(formData.get("units_system") ?? "").trim();
  const localeRaw = String(formData.get("locale") ?? "").trim();

  if (displayName.length > 80) {
    return { error: "Display name is too long (max 80 characters)." };
  }
  if (timezoneRaw && !isValidIanaTimezone(timezoneRaw)) {
    return { error: "Timezone must be a valid IANA name (e.g. Europe/Oslo)." };
  }
  if (unitsRaw && !UNITS.has(unitsRaw)) {
    return { error: "Units must be 'metric' or 'imperial'." };
  }
  if (localeRaw && !/^[a-zA-Z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(localeRaw)) {
    return { error: "Locale must look like 'en' or 'en-US'." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sb = adminClient();
  // user_profiles enforces NOT NULL with defaults on timezone/units_system/locale,
  // so only include those in the patch if the user provided a value. display_name
  // is nullable and can be cleared.
  const patch: Record<string, string | null> = {
    display_name: displayName || null,
  };
  if (timezoneRaw) patch.timezone = timezoneRaw;
  if (unitsRaw) patch.units_system = unitsRaw;
  if (localeRaw) patch.locale = localeRaw;

  const { error } = await sb
    .from("user_profiles")
    .update(patch)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}

function isValidIanaTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
