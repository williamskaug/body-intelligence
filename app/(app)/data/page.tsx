import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ days?: string; view?: string; nogolf?: string; focus?: string }>;

export default async function DataRedirect({ searchParams }: { searchParams: SearchParams }) {
  const p = await searchParams;
  const q = new URLSearchParams();
  if (p.days) q.set("days", p.days);
  if (p.focus) q.set("focus", p.focus);
  else if (p.nogolf === "1") q.set("focus", "run");
  if (p.view === "calendar") q.set("view", "calendar");
  const suffix = q.toString() ? `?${q.toString()}` : "";
  if (p.view === "calendar") redirect(`/train${suffix}`);
  if (p.view === "analyze" || p.view === "trends") {
    q.delete("view");
    const s = q.toString();
    redirect(`/analyze${s ? `?${s}` : ""}`);
  }
  redirect(`/today${suffix}`);
}
