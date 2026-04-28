"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Pencil, StickyNote } from "lucide-react";
import { formatAmount } from "@/lib/payment-offset";

interface Props {
  studentId: string;
  lessonPrice: number;   // kopecks
  notes: string | null;
}

// ── Inline price ───────────────────────────────────────────────────────────────

function PriceField({ studentId, lessonPrice }: { studentId: string; lessonPrice: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(lessonPrice / 100));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setValue(String(lessonPrice / 100));
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
  }

  function cancel() {
    setEditing(false);
    setValue(String(lessonPrice / 100));
  }

  async function save() {
    const num = parseFloat(value.replace(",", "."));
    if (!num || num <= 0) { cancel(); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonPrice: num }),
      });
      if (!res.ok) throw new Error();
      toast.success("Ціну оновлено");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Помилка збереження");
    } finally {
      setSaving(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          min="1"
          step="50"
          disabled={saving}
          className="w-24 h-7 px-2 text-sm font-semibold border border-primary rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <span className="text-sm text-muted-foreground">/ заняття</span>
        <button onClick={save} disabled={saving} className="text-emerald-600 hover:text-emerald-700 transition-colors" title="Зберегти">
          <Check className="h-4 w-4" />
        </button>
        <button onClick={cancel} className="text-muted-foreground hover:text-foreground transition-colors" title="Скасувати">
          <X className="h-4 w-4" />
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={startEdit}
      className="group/price inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 -mx-2 hover:bg-muted/60 transition-colors"
      title="Натисніть щоб змінити ціну"
    >
      <span className="text-sm font-semibold text-foreground underline decoration-dashed decoration-muted-foreground/40 underline-offset-2">
        {formatAmount(lessonPrice)}
      </span>
      <span className="text-sm text-muted-foreground">/ заняття</span>
      <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover/price:text-muted-foreground transition-colors" />
    </button>
  );
}

// ── Inline notes ───────────────────────────────────────────────────────────────

function NotesField({ studentId, notes }: { studentId: string; notes: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function startEdit() {
    setValue(notes ?? "");
    setEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
      const len = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(len, len);
    }, 0);
  }

  function cancel() {
    setEditing(false);
    setValue(notes ?? "");
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value.trim() || null }),
      });
      if (!res.ok) throw new Error();
      toast.success("Нотатки збережено");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Помилка збереження");
    } finally {
      setSaving(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    // Ctrl+Enter or Cmd+Enter to save; Escape to cancel
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <StickyNote className="h-3.5 w-3.5" />
        Нотатки
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            disabled={saving}
            rows={4}
            placeholder="Додайте нотатки про клієнта..."
            className="w-full rounded-lg border border-primary bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {saving ? "Зберігаємо..." : "Зберегти"}
            </button>
            <button
              onClick={cancel}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5"
            >
              Скасувати
            </button>
            <span className="ml-auto text-[10px] text-muted-foreground/50">Ctrl+Enter щоб зберегти</span>
          </div>
        </div>
      ) : (
        <button
          onClick={startEdit}
          className="group/notes w-full text-left rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 hover:border-border/70 transition-colors px-3 py-2.5 min-h-[72px]"
          title="Натисніть щоб редагувати нотатки"
        >
          {notes ? (
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{notes}</p>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground/0 group-hover/notes:text-muted-foreground shrink-0 mt-0.5 transition-colors" />
            </div>
          ) : (
            <div className="flex items-center gap-2 h-full">
              <p className="text-sm text-muted-foreground/50 italic">Нотаток немає — натисніть щоб додати</p>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground/0 group-hover/notes:text-muted-foreground/50 transition-colors" />
            </div>
          )}
        </button>
      )}
    </div>
  );
}

// ── Exported compound component ────────────────────────────────────────────────

export function StudentEditableFields({ studentId, lessonPrice, notes }: Props) {
  return { PriceField: () => <PriceField studentId={studentId} lessonPrice={lessonPrice} />,
           NotesField: () => <NotesField studentId={studentId} notes={notes} /> };
}

// Export individually for easier use in the page
export { PriceField, NotesField };
