"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

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
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
      <code className="flex-1 truncate font-mono text-xs">{url}</code>
      <Button size="sm" variant="outline" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
