import { BodyView } from "@/components/body/body-view";
import { loadAppSnapshot, requireUser } from "@/lib/app/snapshot";
import { parseWindow } from "@/lib/app/window";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ days?: string; focus?: string; nogolf?: string }>;

export default async function BodyPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!user) return null;
  const window = parseWindow(await searchParams);
  const snapshot = await loadAppSnapshot(user.id, user.email, window);

  return (
    <div className="h-full min-h-0 overflow-auto">
      <BodyView snapshot={snapshot} />
    </div>
  );
}
