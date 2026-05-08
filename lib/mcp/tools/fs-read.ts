import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { documents } from "@/lib/db/schema";

export const fsReadInputSchema = {
  path: z
    .string()
    .min(1)
    .max(255)
    .describe("Document path, e.g. 'PROFILE.md' or 'CURRENT.md'"),
};

export async function fsRead(
  userId: string,
  input: { path: string },
): Promise<string> {
  const rows = await db
    .select({ content: documents.content })
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.path, input.path)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error(`Document not found: ${input.path}`);
  }
  return row.content;
}
