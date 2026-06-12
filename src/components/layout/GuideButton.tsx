"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rocket } from "lucide-react";

export function GuideButton() {
  const pathname = usePathname();

  // Don't show on the guide page itself
  if (pathname === "/dashboard/guide") return null;

  return (
    <Link
      href="/dashboard/guide"
      className="fixed z-40 right-4 bottom-[72px] md:top-4 md:bottom-auto inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-md"
    >
      <Rocket className="h-3.5 w-3.5 text-primary" />
      Як розпочати
    </Link>
  );
}
