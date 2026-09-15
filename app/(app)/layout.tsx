import { redirect } from "next/navigation";
import { AppRail, type DawnFooter } from "@/components/app/app-rail";
import { timeAgo } from "@/lib/app/format";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dawn = await loadDawnFooter(user.id);

  return (
    <div className="flex h-dvh min-h-0 bg-neutral-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <AppRail dawn={dawn} />
      <main id="main-content" className="flex min-w-0 flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}

async function loadDawnFooter(userId: string): Promise<DawnFooter> {
  const sb = adminClient();
  const { data } = await sb
    .from("installed_recipes")
    .select("last_run_at, last_run_status")
    .eq("user_id", userId)
    .eq("recipe_id", "dawn-agent")
    .maybeSingle();
  const row = data as { last_run_at: string | null; last_run_status: string | null } | null;
  if (!row?.last_run_at) return { status: "none", lastRunLabel: null };
  const ageH = (Date.now() - new Date(row.last_run_at).getTime()) / 3_600_000;
  const status: DawnFooter["status"] =
    row.last_run_status === "failed" ? "failed" : ageH > 36 ? "stale" : "ok";
  const label = new Date(row.last_run_at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return {
    status,
    lastRunLabel: ageH < 24 ? `ran ${label}` : `ran ${timeAgo(row.last_run_at)}`,
  };
}
