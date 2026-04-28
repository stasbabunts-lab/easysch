"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save } from "lucide-react";

const DAYS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DAYS_ORDERED = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun for display

interface Slot {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface WeeklyGridProps {
  initialSlots: Slot[];
}

export function WeeklyGrid({ initialSlots }: WeeklyGridProps) {
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [saving, setSaving] = useState(false);
  const [newSlot, setNewSlot] = useState({ dayOfWeek: 1, startTime: "10:00", endTime: "11:00" });

  function addSlot() {
    if (newSlot.startTime >= newSlot.endTime) {
      toast.error("Час закінчення повинен бути пізніше початку");
      return;
    }
    setSlots((prev) => [...prev, { ...newSlot }]);
    setNewSlot((s) => ({ ...s }));
  }

  function removeSlot(index: number) {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slots),
      });
      if (!res.ok) throw new Error();
      toast.success("Розклад збережено");
    } catch {
      toast.error("Помилка збереження");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Add slot form */}
      <div className="flex flex-wrap gap-3 items-end p-4 rounded-xl border border-border/50 bg-card">
        <div className="space-y-1">
          <Label className="text-xs">День тижня</Label>
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
            value={newSlot.dayOfWeek}
            onChange={(e) => setNewSlot((s) => ({ ...s, dayOfWeek: Number(e.target.value) }))}
          >
            {DAYS_ORDERED.map((d) => (
              <option key={d} value={d}>{DAYS[d]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Початок</Label>
          <Input
            type="time"
            className="w-28"
            value={newSlot.startTime}
            onChange={(e) => setNewSlot((s) => ({ ...s, startTime: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Кінець</Label>
          <Input
            type="time"
            className="w-28"
            value={newSlot.endTime}
            onChange={(e) => setNewSlot((s) => ({ ...s, endTime: e.target.value }))}
          />
        </div>
        <Button onClick={addSlot} size="sm" variant="secondary">
          <Plus className="h-4 w-4 mr-1" /> Додати
        </Button>
      </div>

      {/* Slots by day */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {DAYS_ORDERED.map((dow) => {
          const daySlots = slots
            .map((s, i) => ({ ...s, index: i }))
            .filter((s) => s.dayOfWeek === dow);
          return (
            <div key={dow} className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{DAYS[dow]}</h3>
              {daySlots.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">Немає слотів</p>
              ) : (
                daySlots.map((s) => (
                  <div key={s.index} className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                    <span className="text-sm font-mono">
                      {s.startTime} – {s.endTime}
                    </span>
                    <button
                      onClick={() => removeSlot(s.index)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      <Button onClick={save} disabled={saving}>
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Зберігаємо..." : "Зберегти розклад"}
      </Button>
    </div>
  );
}
