import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppRail } from "@/components/app/app-rail";
import { loadDawnFooter, requireUser } from "@/lib/app/snapshot";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-dvh min-h-0 bg-neutral-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <Suspense fallback={<AppRail dawn={{ status: "none", lastRunLabel: null }} />}>
        <DawnRail userId={user.id} />
      </Suspense>
      <main id="main-content" className="@container flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}

async function DawnRail({ userId }: { userId: string }) {
  const dawn = await loadDawnFooter(userId);
  return <AppRail dawn={dawn} />;
}
