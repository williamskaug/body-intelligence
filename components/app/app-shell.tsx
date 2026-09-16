"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AppHeader, type HeaderAction } from "@/components/app/app-header";
import { StatusStrip, consecutiveGreenDays } from "@/components/app/status-strip";
import { AddWorkoutDialog } from "@/components/train/add-workout-dialog";
import { LogEventDialog } from "@/components/health/log-event-dialog";
import { sectionFromPath } from "@/lib/app/nav";
import type { StatusChrome } from "@/lib/app/snapshot";

export function AppShell({
  chrome,
}: {
  chrome: StatusChrome;
}) {
  const pathname = usePathname() ?? "";
  const section = sectionFromPath(pathname);
  const showStatus =
    section === "today" || section === "train" || section === "analyze" || section === "body";
  const action = headerAction(pathname, chrome.insightPath);
  const extra =
    section === "train" ? (
      <AddWorkoutDialog todayDate={chrome.todayDate} />
    ) : section === "health" ? (
      <LogEventDialog todayDate={chrome.todayDate} compact />
    ) : null;

  return (
    <>
      <Suspense fallback={<div className="h-11 shrink-0 border-b border-neutral-200 bg-white" />}>
        <AppHeader todayDate={chrome.todayDate} action={action} extra={extra} />
      </Suspense>
      {showStatus ? (
        <StatusStrip
          derived={chrome.derived}
          todayDate={chrome.todayDate}
          hrvMs={chrome.hrvMs}
          rhrBpm={chrome.rhrBpm}
          consecutiveGreen={consecutiveGreenDays(chrome.gateHistory)}
          todayWorkout={chrome.todayWorkout}
          briefingPath={chrome.briefingPath}
          gateHistory={chrome.gateHistory}
        />
      ) : null}
    </>
  );
}

function headerAction(pathname: string, insightPath: string | null): HeaderAction | null {
  if (pathname.startsWith("/analyze/metric")) {
    return { label: "Back to Analyze", href: "/analyze?tab=stats" };
  }
  if (pathname.startsWith("/today") || pathname === "/") {
    return { label: "Log check-in", href: "/body#check-in" };
  }
  if (pathname.startsWith("/analyze")) {
    return insightPath
      ? {
          label: "Read this week's insight",
          href: `/memory?path=${encodeURIComponent(insightPath)}`,
        }
      : null;
  }
  if (pathname.startsWith("/body")) {
    return { label: "Save check-in", form: "check-in-form", type: "submit" };
  }
  if (pathname.startsWith("/memory")) {
    return { label: "Save file", form: "memory-save", type: "submit" };
  }
  if (pathname.startsWith("/agents")) {
    return { label: "+ Install recipe", href: "/agents#recipe-library" };
  }
  if (pathname.startsWith("/settings")) {
    return { label: "Save profile", form: "profile-form", type: "submit" };
  }
  return null;
}
