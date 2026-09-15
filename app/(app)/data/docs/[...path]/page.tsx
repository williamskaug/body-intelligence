import { redirect } from "next/navigation";

export default async function DocRedirect({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path: segments } = await params;
  const path = segments.map((s) => decodeURIComponent(s)).join("/");
  redirect(`/memory?path=${encodeURIComponent(path)}`);
}
