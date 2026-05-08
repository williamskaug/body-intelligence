import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const isoTimestamp = z
  .string()
  .min(10)
  .describe("ISO 8601 timestamp; offset preferred (e.g. 2026-05-08T08:30:00+02:00)");

export const wellnessScale = z.number().int().min(1).max(5);

export const documentPath = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((p) => !p.startsWith("/"), "no leading slash")
  .refine((p) => !p.includes(".."), "no parent traversal")
  .refine((p) => /^[A-Za-z0-9_/.\-]+\.md$/.test(p), "must end in .md and use [A-Za-z0-9_/.-]");

export function jsonResult(payload: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as { [key: string]: unknown },
  };
}

export function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}
