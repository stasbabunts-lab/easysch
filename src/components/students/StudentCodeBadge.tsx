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
    <div
      className="flex items-center gap-1 font-mono text-[11px] font-semibold text-primary bg-primary/8 pl-2 pr-1 py-0.5 rounded tracking-wider"
      title="Личный код клиента для Telegram бота"
    >
      {code}
      <button
        onClick={handleCopy}
        className="ml-0.5 p-0.5 rounded hover:bg-primary/15 transition-colors"
        title="Скопировать код"
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-500" />
        ) : (
          <Copy className="h-3 w-3 text-primary/60 hover:text-primary" />
        )}
      </button>
    </div>
  );
}
