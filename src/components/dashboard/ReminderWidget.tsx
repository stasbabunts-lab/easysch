"use client";

import { useState } from "react";
import { DateInput } from "@/components/ui/DateInput";
import { TimeInput } from "@/components/ui/TimeInput";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bell, Trash2, Plus } from "lucide-react";

export interface ReminderEntry {
  id: string;
  text: string;
  remindAt: string; // ISO; built as Kyiv wall-clock-as-UTC → format back in UTC
}

// remindAt is Kyiv wall-clock stored as UTC — echo it back in UTC (don't shift).
function formatRemindAt(iso: string) {
  return new Date(iso).toLocaleString("uk-UA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

// "YYYY-MM-DD" for local `today + offsetDays`. The user is in Kyiv, so the
// browser-local date matches the schedule frame.
function isoDateOffset(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ReminderWidget({
  initial,
  telegramLinked,
}: {
  initial: ReminderEntry[];
  telegramLinked: boolean;
}) {
  const [reminders, setReminders] = useState<ReminderEntry[]>(initial);
  const [date, setDate] = useState(isoDateOffset(0));
  const [time, setTime] = useState("10:00");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tomorrow = isoDateOffset(1);
  const dayAfter = isoDateOffset(2);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!text.trim()) {
      setError("Введіть текст нагадування");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time, text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Не вдалося зберегти");
        return;
      }
      const created: ReminderEntry = await res.json();
      setReminders((list) =>
        [...list, created].sort((a, b) => a.remindAt.localeCompare(b.remindAt))
      );
      setText("");
    } catch {
      setError("Не вдалося зберегти");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const prev = reminders;
    setReminders((list) => list.filter((r) => r.id !== id));
    const res = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    if (!res.ok) setReminders(prev); // revert on failure
  }

  return (
    <div className="space-y-4">
      {!telegramLinked && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Підключіть Telegram у налаштуваннях, щоб отримувати нагадування.
        </p>
      )}

      <form onSubmit={submit} className="space-y-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Про що нагадати?"
          rows={2}
          className="resize-none"
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-32 shrink-0">
            <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="w-20 shrink-0">
            <TimeInput value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <Button
            type="button"
            variant={date === tomorrow ? "secondary" : "outline"}
            size="sm"
            onClick={() => setDate(tomorrow)}
          >
            Завтра
          </Button>
          <Button
            type="button"
            variant={date === dayAfter ? "secondary" : "outline"}
            size="sm"
            onClick={() => setDate(dayAfter)}
          >
            Післязавтра
          </Button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <Button type="submit" size="sm" disabled={saving}>
          <Plus className="h-3.5 w-3.5" />
          {saving ? "Зберігаємо…" : "Додати нагадування"}
        </Button>
      </form>

      <div className="space-y-1 border-t border-border/50 pt-3">
        {reminders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">
            Запланованих нагадувань немає
          </p>
        ) : (
          reminders.map((r) => (
            <div
              key={r.id}
              className="flex items-start justify-between gap-3 py-2 px-1 border-b border-border/40 last:border-0"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <Bell className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words">{r.text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatRemindAt(r.remindAt)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(r.id)}
                aria-label="Видалити"
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
