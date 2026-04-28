"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Check, X } from "lucide-react";
import { formatAmount } from "@/lib/payment-offset";

interface InlinePriceEditProps {
  studentId: string;
  lessonPrice: number; // в копейках
}

export function InlinePriceEdit({ studentId, lessonPrice }: InlinePriceEditProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(lessonPrice / 100));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function save() {
    const num = Number(value);
    if (!num || num <= 0) { setEditing(false); setValue(String(lessonPrice / 100)); return; }
    setSaving(true);
    const res = await fetch(`/api/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonPrice: num }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Ціну оновлено");
      setEditing(false);
      router.refresh();
    } else {
      toast.error("Помилка збереження");
    }
  }

  function cancel() {
    setEditing(false);
    setValue(String(lessonPrice / 100));
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <input
          ref={inputRef}
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="w-20 h-6 px-1.5 text-xs border border-primary rounded bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          min="1"
          step="50"
          disabled={saving}
        />
        <span className="text-xs text-muted-foreground/0 select-none w-0" />
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); save(); }} disabled={saving} className="text-emerald-600 hover:text-emerald-700 transition-colors">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); cancel(); }} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 group/price">
      <span className="text-xs text-muted-foreground">{formatAmount(lessonPrice)} / заняття</span>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(true); }}
        className="opacity-0 group-hover/price:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
        title="Змінити ціну"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </span>
  );
}
