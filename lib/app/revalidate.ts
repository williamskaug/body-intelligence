import { refresh, revalidatePath, revalidateTag } from "next/cache";
import { userDataTag } from "./snapshot-cache";

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

export function revalidateApp(userId?: string) {
  for (const p of PATHS) revalidatePath(p);
  if (userId) revalidateTag(userDataTag(userId), "max");
  refresh();
}
