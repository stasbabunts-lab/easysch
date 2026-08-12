"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Archive, RotateCcw, Trash2 } from "lucide-react";
import { formatOffset } from "@/lib/format";

interface ArchivedStudent {
  id: string;
  name: string;
  paymentOffset: number;
  lessonCount: number;
}

export function StudentArchive({
  students,
  nounPlural = "заняття",
  nounGenPl = "занять",
}: {
  students: ArchivedStudent[];
  /** Teacher's word for meetings: nominative plural / genitive plural. */
  nounPlural?: string;
  nounGenPl?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (students.length === 0) return null;

  async function restore(s: ArchivedStudent) {
    setBusy(s.id);
    try {
      const res = await fetch(`/api/students/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: false }),
      });
      if (!res.ok) throw new Error();
      toast.success(`«${s.name}» повернуто з архіву`);
      router.refresh();
    } catch {
      toast.error("Помилка");
    } finally {
      setBusy(null);
    }
  }

  async function remove(s: ArchivedStudent) {
    if (!confirm(
      `Видалити «${s.name}» НАЗАВЖДИ?\n\nБудуть безповоротно стерті всі дані клієнта: проведені ${nounPlural}, оплати, запити та баланс. Відновити буде неможливо.`
    )) return;
    setBusy(s.id);
    try {
      const res = await fetch(`/api/students/${s.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(`«${s.name}» видалено назавжди`);
      router.refresh();
    } catch {
      toast.error("Помилка видалення");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/40 transition-colors text-left"
      >
        <Archive className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium flex-1">Архів</span>
        <span className="text-xs text-muted-foreground">{students.length}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border/50 divide-y divide-border/30">
          {students.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-muted-foreground">{formatOffset(s.paymentOffset)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.lessonCount} {nounGenPl}</p>
              </div>
              <button
                onClick={() => restore(s)}
                disabled={busy === s.id}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Повернути
              </button>
              <button
                onClick={() => remove(s)}
                disabled={busy === s.id}
                title="Остаточне видалення — усі дані будуть стерті безповоротно"
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Видалити
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
