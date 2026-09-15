import { revalidatePath } from "next/cache";

const PATHS = [
  "/today",
  "/train",
  "/analyze",
  "/body",
  "/health",
  "/memory",
  "/agents",
  "/settings",
  "/data",
] as const;

export function revalidateApp() {
  for (const p of PATHS) revalidatePath(p);
}
