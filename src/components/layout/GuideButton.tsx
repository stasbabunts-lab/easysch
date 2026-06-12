import Link from "next/link";
import { Rocket } from "lucide-react";

export function GuideButton() {
  return (
    <Link
      href="/dashboard/guide"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm shrink-0"
    >
      <Rocket className="h-3.5 w-3.5 text-primary" />
      Як розпочати
    </Link>
  );
}
