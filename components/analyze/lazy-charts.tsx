"use client";

import dynamic from "next/dynamic";

function ChartSkeleton({ className = "h-40" }: { className?: string }) {
  return <div className={`w-full animate-pulse bg-neutral-100 ${className}`} />;
}

export const HistogramChart = dynamic(
  () => import("@/components/data/charts/histogram-chart").then((m) => ({ default: m.HistogramChart })),
  { ssr: true, loading: () => <ChartSkeleton /> },
);

export const PerformanceManagementChart = dynamic(
  () =>
    import("@/components/data/charts/performance-management-chart").then((m) => ({
      default: m.PerformanceManagementChart,
    })),
  { ssr: true, loading: () => <ChartSkeleton className="h-48" /> },
);

export const RatioBandChart = dynamic(
  () => import("@/components/data/charts/ratio-band-chart").then((m) => ({ default: m.RatioBandChart })),
  { ssr: true, loading: () => <ChartSkeleton /> },
);

export const ScatterRegression = dynamic(
  () => import("@/components/data/charts/scatter-regression").then((m) => ({ default: m.ScatterRegression })),
  { ssr: true, loading: () => <ChartSkeleton /> },
);

export const BaselineBandChart = dynamic(
  () => import("@/components/data/charts/baseline-band-chart").then((m) => ({ default: m.BaselineBandChart })),
  { ssr: true, loading: () => <ChartSkeleton /> },
);

export const MultiSeriesLine = dynamic(
  () => import("@/components/data/charts/multi-series-line").then((m) => ({ default: m.MultiSeriesLine })),
  { ssr: true, loading: () => <ChartSkeleton /> },
);
