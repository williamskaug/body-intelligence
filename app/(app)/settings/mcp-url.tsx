"use client";

import { useState } from "react";

export function McpUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <code className="min-w-0 flex-1 truncate border border-neutral-300 bg-neutral-50 px-2 py-1 font-mono text-[12px]">
        {url}
      </code>
      <button
        type="button"
        onClick={copy}
        className="border border-neutral-300 px-2 py-1 text-[10px] font-medium uppercase tracking-wide hover:bg-neutral-50"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
