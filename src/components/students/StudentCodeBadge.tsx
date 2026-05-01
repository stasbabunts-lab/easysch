"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function StudentCodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 font-mono text-xs font-semibold text-primary bg-primary/8 pl-2.5 pr-2 py-1 rounded tracking-wider hover:bg-primary/15 transition-colors cursor-pointer"
      title="Скопіювати код"
    >
      {code}
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-primary/60 shrink-0" />
      )}
    </button>
  );
}
