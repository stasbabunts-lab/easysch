import Link from "next/link";
import { Layers } from "lucide-react";
import { APP_NAME } from "@/lib/labels";

// Shared chrome for static legal pages (privacy, terms).
export function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Layers className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-[15px] tracking-tight">{APP_NAME}</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            На головну
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-8">{title}</h1>
        <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:break-words">
          {children}
        </div>
      </main>
    </div>
  );
}
