import { redirect } from "next/navigation";

export default async function MetricRedirect({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  redirect(`/analyze/metric/${encodeURIComponent(key)}`);
}
