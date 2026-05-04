"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, User, Users, RefreshCw, Calendar, ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, Eye } from "lucide-react";

function computeEndTime(startTime: string, durationMin: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + durationMin;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Callback ref that attaches a non-passive wheel listener — handles StrictMode double-invoke */
function useWheelRef(handler: (e: WheelEvent) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const fnRef = useRef<((e: WheelEvent) => void) | null>(null);
  const elRef = useRef<HTMLInputElement | null>(null);
  return useCallback((el: HTMLInputElement | null) => {
    if (elRef.current && fnRef.current) {
      elRef.current.removeEventListener("wheel", fnRef.current);
      fnRef.current = null;
      elRef.current = null;
    }
    if (!el) return;
    const fn = (e: WheelEvent) => { e.preventDefault(); handlerRef.current(e); };
    el.addEventListener("wheel", fn, { passive: false });
    fnRef.current = fn;
    elRef.current = el;
  }, []);
}

interface StudentInfo { id: string; name: string; createdAt: string | Date }

interface SlotData {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  isRecurring: boolean;
  recurringGroupId: string | null;
  studentId: string | null;
  student: StudentInfo | null;
  isGroup: boolean;
  showAsFree: boolean;
  groupStudents: { studentId: string; student: StudentInfo }[];
}

interface EditState {
  slot: SlotData;
  date: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  durationStr: string;
  studentId: string;
  groupStudentIds: string[];
  showAsFree: boolean;
  applyTo: "one" | "future";
  saving: boolean;
}

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

interface Props {
  students: StudentInfo[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
void WEEK_MS;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });
}

function groupByDate(slots: SlotData[]) {
  const map = new Map<string, SlotData[]>();
  for (const s of slots) {
    const arr = map.get(s.date) ?? [];
    arr.push(s);
    map.set(s.date, arr);
  }
  return map;
}

export function ScheduleManager({ students }: Props) {
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [loading, setLoading] = useState(true);
  // Offset in weeks from today (0 = current 2-week window)
  const [weekOffset, setWeekOffset] = useState(0);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newSlot, setNewSlot] = useState(() => {
    const startTime = "10:00";
    const durationMin = 60;
    return {
      date: isoDate(new Date()),
      startTime,
      endTime: computeEndTime(startTime, durationMin),
      durationMin,
      durationStr: "60",
      isRecurring: false,
      isGroup: false,
      studentId: "",
      groupStudentIds: [] as string[],
      showAsFree: false,
    };
  });
  const [adding, setAdding] = useState(false);

  // Wheel refs for add dialog
  const dateRef = useWheelRef((e) => {
    setNewSlot((s) => {
      const d = new Date(s.date + "T12:00:00");
      d.setDate(d.getDate() + (e.deltaY < 0 ? 1 : -1));
      return { ...s, date: isoDate(d) };
    });
  });

  const startTimeRef = useWheelRef((e) => {
    setNewSlot((s) => {
      const [h, m] = s.startTime.split(":").map(Number);
      const newH = (h + (e.deltaY < 0 ? 1 : -1) + 24) % 24;
      const newStart = `${String(newH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      return { ...s, startTime: newStart, endTime: computeEndTime(newStart, s.durationMin) };
    });
  });

  const durationRef = useWheelRef((e) => {
    setNewSlot((s) => {
      const newDur = Math.max(10, s.durationMin + (e.deltaY < 0 ? 10 : -10));
      return { ...s, durationMin: newDur, durationStr: String(newDur), endTime: computeEndTime(s.startTime, newDur) };
    });
  });

  // Unified edit dialog state
  const [editState, setEditState] = useState<EditState | null>(null);

  // Wheel refs for edit dialog
  const editDateRef = useWheelRef((e) => {
    setEditState((s) => {
      if (!s) return s;
      const d = new Date(s.date + "T12:00:00");
      d.setDate(d.getDate() + (e.deltaY < 0 ? 1 : -1));
      return { ...s, date: isoDate(d) };
    });
  });

  const editStartTimeRef = useWheelRef((e) => {
    setEditState((s) => {
      if (!s) return s;
      const [h, m] = s.startTime.split(":").map(Number);
      const newH = (h + (e.deltaY < 0 ? 1 : -1) + 24) % 24;
      const newStart = `${String(newH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      return { ...s, startTime: newStart, endTime: computeEndTime(newStart, s.durationMin) };
    });
  });

  const editDurationRef = useWheelRef((e) => {
    setEditState((s) => {
      if (!s) return s;
      const newDur = Math.max(10, s.durationMin + (e.deltaY < 0 ? 10 : -10));
      return { ...s, durationMin: newDur, durationStr: String(newDur), endTime: computeEndTime(s.startTime, newDur) };
    });
  });

  // Delete confirm dialog
  const [deleteSlot, setDeleteSlot] = useState<SlotData | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Recurring toggle confirm
  const [toggleSlot, setToggleSlot] = useState<SlotData | null>(null);
  const [toggling, setToggling] = useState(false);

  // Past days collapse (only on current window)
  const [pastCollapsed, setPastCollapsed] = useState(true);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule");
      if (res.ok) setSlots(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  // Compute visible date range (1 week window)
  const windowStart = addDays(new Date(), weekOffset * 7);
  const windowEnd = addDays(windowStart, 6);
  const windowStartStr = isoDate(windowStart);
  const windowEndStr = isoDate(windowEnd);

  const visibleSlots = slots.filter(
    (s) => s.date >= windowStartStr && s.date <= windowEndStr
  );
  const grouped = groupByDate(visibleSlots);

  // All dates in the 7-day window
  const allDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    allDates.push(isoDate(addDays(windowStart, i)));
  }

  // ── Add slot ─────────────────────────────────────────────────────────
  async function handleAdd() {
    setAdding(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newSlot.date,
          startTime: newSlot.startTime,
          endTime: newSlot.endTime,
          durationMin: newSlot.durationMin,
          isRecurring: newSlot.isRecurring,
          isGroup: newSlot.isGroup,
          studentId: newSlot.isGroup ? null : (newSlot.studentId || null),
          studentIds: newSlot.isGroup ? newSlot.groupStudentIds : undefined,
          showAsFree: newSlot.isGroup ? newSlot.showAsFree : false,
        }),
      });
      if (!res.ok) throw new Error();
      const created: SlotData[] = await res.json();
      setSlots((prev) => [...prev, ...created]);
      setAddOpen(false);
      toast.success(newSlot.isRecurring ? `Створено ${created.length} занять (3 міс.)` : "Заняття додано");
    } catch {
      toast.error("Помилка додавання");
    } finally {
      setAdding(false);
    }
  }

  // ── Toggle recurring ─────────────────────────────────────────────────
  async function confirmToggle() {
    if (!toggleSlot) return;
    setToggling(true);
    const willBeRecurring = !toggleSlot.isRecurring;
    try {
      const res = await fetch(`/api/schedule/${toggleSlot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRecurring: willBeRecurring }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (willBeRecurring) {
        // Series created: add all new slots, remove the original
        setSlots((prev) => [
          ...prev.filter((s) => s.id !== toggleSlot.id),
          ...data.slots,
        ]);
        toast.success(`Створено ${data.slots.length} щотижневих занять`);
      } else {
        setSlots((prev) =>
          prev.map((s) => (s.id === toggleSlot.id ? { ...s, isRecurring: false, recurringGroupId: null } : s))
        );
        toast.success("Заняття тепер разове");
      }
      setToggleSlot(null);
    } catch {
      toast.error("Помилка зміни");
    } finally {
      setToggling(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────
  async function confirmDelete(mode: "one" | "future") {
    if (!deleteSlot) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/schedule/${deleteSlot.id}?mode=${mode}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (mode === "future" && data.groupId) {
        setSlots((prev) =>
          prev.filter(
            (s) =>
              !(s.recurringGroupId === data.groupId && s.date >= deleteSlot.date)
          )
        );
        toast.success("Це і всі майбутні заняття видалено");
      } else {
        setSlots((prev) => prev.filter((s) => s.id !== data.id));
        toast.success("Заняття видалено");
      }
      setDeleteSlot(null);
    } catch {
      toast.error("Помилка видалення");
    } finally {
      setDeleting(false);
    }
  }

  // ── Unified edit ─────────────────────────────────────────────────────
  function openEdit(slot: SlotData) {
    setEditState({
      slot,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMin: slot.durationMin,
      durationStr: String(slot.durationMin),
      studentId: slot.studentId ?? "",
      groupStudentIds: slot.groupStudents.map((gs) => gs.studentId),
      showAsFree: slot.showAsFree,
      applyTo: slot.isRecurring ? "future" : "one",
      saving: false,
    });
  }

  async function confirmEdit() {
    if (!editState) return;
    setEditState((s) => s && { ...s, saving: true });
    try {
      const body: Record<string, unknown> = {
        applyTo: editState.applyTo,
        // date is only meaningful for single-slot edits — changing the date of an
        // entire recurring series to one fixed value would collapse all slots to the same day
        ...(editState.applyTo === "one" ? { date: editState.date } : {}),
        startTime: editState.startTime,
        endTime: editState.endTime,
        durationMin: editState.durationMin,
        showAsFree: editState.showAsFree,
      };
      if (!editState.slot.isGroup) {
        body.studentId = editState.studentId || null;
      } else {
        // groupStudentIds apply only to single slot (API ignores for "future")
        body.groupStudentIds = editState.groupStudentIds;
      }
      const res = await fetch(`/api/schedule/${editState.slot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSlots((prev) => {
        let next = [...prev];
        for (const updated of data.slots) {
          next = next.map((s) => (s.id === updated.id ? updated : s));
        }
        return next;
      });
      toast.success("Збережено");
      setEditState(null);
    } catch {
      toast.error("Помилка збереження");
      setEditState((s) => s && { ...s, saving: false });
    }
  }

  // ── Sort students by last activity (slot date or createdAt) desc ─────
  const sortedStudents = [...students].sort((a, b) => {
    const lastSlot = (s: StudentInfo) =>
      slots
        .filter((sl) => sl.studentId === s.id || sl.groupStudents?.some((gs) => gs.studentId === s.id))
        .map((sl) => sl.date)
        .sort()
        .at(-1) ?? null;
    const keyA = lastSlot(a) ?? new Date(a.createdAt).toISOString().slice(0, 10);
    const keyB = lastSlot(b) ?? new Date(b.createdAt).toISOString().slice(0, 10);
    return keyB.localeCompare(keyA);
  });

  // ── Conflict detection ────────────────────────────────────────────────
  const conflictSlots = useMemo(() => {
    if (!newSlot.date || !newSlot.startTime || !newSlot.endTime) return [];
    const newStart = timeToMin(newSlot.startTime);
    const newEnd = timeToMin(newSlot.endTime);
    return slots.filter(
      (s) =>
        s.date === newSlot.date &&
        timeToMin(s.startTime) < newEnd &&
        timeToMin(s.endTime) > newStart
    );
  }, [slots, newSlot.date, newSlot.startTime, newSlot.endTime]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => setWeekOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium flex-1 text-center sm:min-w-[200px]">
            {new Date(windowStartStr + "T12:00:00").toLocaleDateString("uk-UA", { day: "numeric", month: "long" })}
            {" – "}
            {new Date(windowEndStr + "T12:00:00").toLocaleDateString("uk-UA", { day: "numeric", month: "long" })}
          </span>
          <Button size="icon" variant="outline" onClick={() => setWeekOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-xs">
              Сьогодні
            </Button>
          )}
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1" /> Додати заняття
        </Button>
      </div>

      {/* Days */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Завантаження...</div>
      ) : (
        <div className="space-y-2">
          {(() => {
            const todayStr = isoDate(new Date());
            const isCurrentWindow = weekOffset === 0;
            const pastDates = isCurrentWindow ? allDates.filter((d) => d < todayStr) : [];
            const activeDates = isCurrentWindow ? allDates.filter((d) => d >= todayStr) : allDates;

            const renderDayCard = (date: string) => {
              const daySlots = (grouped.get(date) ?? []).sort((a, b) =>
                a.startTime.localeCompare(b.startTime)
              );
              const isToday = date === todayStr;
              return (
                <div key={date} className="rounded-xl border border-border/40 bg-card">
                  <div className="px-4 py-2.5 border-b border-border/30 flex items-center gap-2">
                    <span className="text-sm font-semibold capitalize text-muted-foreground">
                      {formatDayLabel(date)}
                    </span>
                    {isToday && (
                      <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                        сьогодні
                      </span>
                    )}
                  </div>
                  <div className="p-2 space-y-1.5">
                    {daySlots.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50 px-2 py-1">Немає занять</p>
                    ) : (
                      daySlots.map((slot) => (
                        <SlotRow
                          key={slot.id}
                          slot={slot}
                          onClick={() => openEdit(slot)}
                          onDelete={() => setDeleteSlot(slot)}
                          onToggleRecurring={() => setToggleSlot(slot)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            };

            return (
              <>
                {/* Collapsed past days — only on current window */}
                {pastDates.length > 0 && (
                  <div className="rounded-xl border border-border/30 bg-muted/20 overflow-hidden">
                    <button
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
                      onClick={() => setPastCollapsed((c) => !c)}
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200 ${
                          pastCollapsed ? "-rotate-90" : ""
                        }`}
                      />
                      <span className="text-xs font-medium text-muted-foreground/70">
                        Минулі дні цього тижня
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground/50">
                        {pastDates.length} {pastDates.length === 1 ? "день" : "днів"}
                      </span>
                    </button>
                    {!pastCollapsed && (
                      <div className="px-2 pb-2 space-y-1.5 border-t border-border/20">
                        {pastDates.map(renderDayCard)}
                      </div>
                    )}
                  </div>
                )}

                {/* Current and future days */}
                {activeDates.map(renderDayCard)}
              </>
            );
          })()}
        </div>
      )}

      {/* ── Add Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Додати заняття</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Дата{" "}
                <span className="text-muted-foreground font-normal">
                  ({new Date(newSlot.date + "T12:00:00").toLocaleDateString("uk-UA", { weekday: "long" })})
                </span>
              </Label>
              <Input
                ref={dateRef}
                type="date"
                value={newSlot.date}
                onChange={(e) => setNewSlot((s) => ({ ...s, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <div className="flex gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">Початок</Label>
                  <Input
                    ref={startTimeRef}
                    type="time"
                    value={newSlot.startTime}
                    onChange={(e) => setNewSlot((s) => {
                      const newStart = e.target.value;
                      return { ...s, startTime: newStart, endTime: computeEndTime(newStart, s.durationMin) };
                    })}
                  />
                </div>
                <div className="w-24 space-y-1.5">
                  <Label className="text-xs">Хв.</Label>
                  <Input
                    ref={durationRef}
                    type="text"
                    inputMode="numeric"
                    value={newSlot.durationStr}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setNewSlot((s) => {
                        const parsed = parseInt(raw, 10);
                        if (!isNaN(parsed) && parsed >= 10) {
                          return { ...s, durationStr: raw, durationMin: parsed, endTime: computeEndTime(s.startTime, parsed) };
                        }
                        return { ...s, durationStr: raw };
                      });
                    }}
                    onBlur={() => setNewSlot((s) => {
                      const parsed = parseInt(s.durationStr, 10);
                      const clamped = isNaN(parsed) || parsed < 10 ? 60 : parsed;
                      return { ...s, durationMin: clamped, durationStr: String(clamped), endTime: computeEndTime(s.startTime, clamped) };
                    })}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Кінець</Label>
                  <div className="h-9 flex items-center px-3 rounded-md border border-border/40 bg-muted/30 text-sm font-mono text-muted-foreground">
                    {newSlot.endTime}
                  </div>
                </div>
              </div>
              {conflictSlots.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 pt-0.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Перетинається з{" "}
                    {conflictSlots.map((s) => {
                      const name = s.isGroup
                        ? `групою (${s.groupStudents.map((g) => g.student.name).join(", ")})`
                        : (s.student?.name ?? "вільним слотом");
                      return `${name} (${s.startTime}–${s.endTime})`;
                    }).join(", ")}
                  </span>
                </div>
              )}
            </div>
            {/* Group / single toggle */}
            <div className="flex rounded-lg border border-border/50 overflow-hidden">
              <button
                type="button"
                onClick={() => setNewSlot((s) => ({ ...s, isGroup: false }))}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
                  !newSlot.isGroup ? "bg-primary text-primary-foreground" : "hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <User className="h-3.5 w-3.5" /> Індивідуальне
              </button>
              <button
                type="button"
                onClick={() => setNewSlot((s) => ({ ...s, isGroup: true, studentId: "" }))}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors border-l border-border/50 ${
                  newSlot.isGroup ? "bg-primary text-primary-foreground" : "hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <Users className="h-3.5 w-3.5" /> Групове
              </button>
            </div>
            {newSlot.isGroup ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Клієнти групи (необов&apos;язково)</Label>
                  <MultiStudentPicker
                    value={newSlot.groupStudentIds}
                    onChange={(ids) => setNewSlot((s) => ({ ...s, groupStudentIds: ids }))}
                    students={sortedStudents}
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-border/50 px-4 py-3 hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={newSlot.showAsFree}
                    onChange={(e) => setNewSlot((s) => ({ ...s, showAsFree: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <div>
                    <p className="text-sm font-medium">Вільно для запису</p>
                    <p className="text-xs text-muted-foreground">Відображати в публічному розкладі</p>
                  </div>
                  <Eye className={`h-4 w-4 ml-auto ${newSlot.showAsFree ? "text-primary" : "text-muted-foreground/40"}`} />
                </label>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Клієнт (необов&apos;язково)</Label>
                <StudentPicker
                  value={newSlot.studentId}
                  onChange={(id) => setNewSlot((s) => ({ ...s, studentId: id }))}
                  students={sortedStudents}
                />
              </div>
            )}
            {/* Weekly toggle */}
            <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-border/50 px-4 py-3 hover:bg-muted/50 transition-colors">
              <input type="checkbox" checked={newSlot.isRecurring}
                onChange={(e) => setNewSlot((s) => ({ ...s, isRecurring: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300" />
              <div>
                <p className="text-sm font-medium">Щотижнево</p>
                <p className="text-xs text-muted-foreground">Створити на 3 місяці вперед</p>
              </div>
              <RefreshCw className={`h-4 w-4 ml-auto ${newSlot.isRecurring ? "text-emerald-500" : "text-muted-foreground/40"}`} />
            </label>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleAdd} disabled={adding} className="flex-1">
                {adding ? "Створюємо..." : newSlot.isRecurring ? "Створити серію" : "Створити"}
              </Button>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Скасувати</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Toggle Recurring Confirm ── */}
      <Dialog open={!!toggleSlot} onOpenChange={(o) => !o && setToggleSlot(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {toggleSlot?.isRecurring ? "Зробити разовим?" : "Зробити щотижневим?"}
            </DialogTitle>
          </DialogHeader>
          {toggleSlot && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
                <p className="font-medium">{formatDayLabel(toggleSlot.date)}</p>
                <p className="text-muted-foreground">{toggleSlot.startTime} – {toggleSlot.endTime}</p>
              </div>
              {toggleSlot.isRecurring ? (
                <p className="text-sm text-muted-foreground">
                  Заняття буде відв&apos;язано від серії і стане разовим.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Буде створено <strong>13 щотижневих занять</strong> (≈3 місяці) починаючи з цієї дати.
                </p>
              )}
              <div className="flex gap-2">
                <Button onClick={confirmToggle} disabled={toggling} className="flex-1">
                  {toggling ? "..." : "Підтвердити"}
                </Button>
                <Button variant="outline" onClick={() => setToggleSlot(null)}>Скасувати</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={!!deleteSlot} onOpenChange={(o) => !o && setDeleteSlot(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Видалити заняття</DialogTitle></DialogHeader>
          {deleteSlot && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
                <p className="font-medium">{formatDayLabel(deleteSlot.date)}</p>
                <p className="text-muted-foreground">{deleteSlot.startTime} – {deleteSlot.endTime}</p>
                {deleteSlot.student && (
                  <p className="text-muted-foreground">Клієнт: {deleteSlot.student.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={deleting}
                  onClick={() => confirmDelete("one")}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Тільки це заняття
                </Button>
                {deleteSlot.isRecurring && (
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    disabled={deleting}
                    onClick={() => confirmDelete("future")}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Це і всі майбутні
                  </Button>
                )}
              </div>
              <Button variant="ghost" onClick={() => setDeleteSlot(null)} className="w-full">
                Скасувати
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Unified Edit Dialog ── */}
      <Dialog open={!!editState} onOpenChange={(o) => !o && setEditState(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Редагувати заняття</DialogTitle></DialogHeader>
          {editState && (
            <div className="space-y-4 pt-2">
              {/* Date — disabled for bulk "future" edits to prevent collapsing the whole series to one date */}
              <div className="space-y-1.5">
                <Label className={`text-xs ${editState.applyTo === "future" ? "text-muted-foreground/50" : ""}`}>
                  Дата{" "}
                  {editState.applyTo === "one" ? (
                    <span className="text-muted-foreground font-normal">
                      ({new Date(editState.date + "T12:00:00").toLocaleDateString("uk-UA", { weekday: "long" })})
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50 font-normal">— не змінюється для серії</span>
                  )}
                </Label>
                <Input
                  ref={editDateRef}
                  type="date"
                  value={editState.date}
                  disabled={editState.applyTo === "future"}
                  onChange={(e) => setEditState((s) => s && { ...s, date: e.target.value })}
                  className={editState.applyTo === "future" ? "opacity-40 cursor-not-allowed" : ""}
                />
              </div>
              {/* Time */}
              <div className="flex gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">Початок</Label>
                  <Input
                    ref={editStartTimeRef}
                    type="time"
                    value={editState.startTime}
                    onChange={(e) => setEditState((s) => {
                      if (!s) return s;
                      const newStart = e.target.value;
                      return { ...s, startTime: newStart, endTime: computeEndTime(newStart, s.durationMin) };
                    })}
                  />
                </div>
                <div className="w-24 space-y-1.5">
                  <Label className="text-xs">Хв.</Label>
                  <Input
                    ref={editDurationRef}
                    type="text"
                    inputMode="numeric"
                    value={editState.durationStr}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setEditState((s) => {
                        if (!s) return s;
                        const parsed = parseInt(raw, 10);
                        if (!isNaN(parsed) && parsed >= 10) {
                          return { ...s, durationStr: raw, durationMin: parsed, endTime: computeEndTime(s.startTime, parsed) };
                        }
                        return { ...s, durationStr: raw };
                      });
                    }}
                    onBlur={() => setEditState((s) => {
                      if (!s) return s;
                      const parsed = parseInt(s.durationStr, 10);
                      const clamped = isNaN(parsed) || parsed < 10 ? 60 : parsed;
                      return { ...s, durationMin: clamped, durationStr: String(clamped), endTime: computeEndTime(s.startTime, clamped) };
                    })}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Кінець</Label>
                  <div className="h-9 flex items-center px-3 rounded-md border border-border/40 bg-muted/30 text-sm font-mono text-muted-foreground">
                    {editState.endTime}
                  </div>
                </div>
              </div>
              {/* Students */}
              {editState.slot.isGroup ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Учасники</Label>
                  <MultiStudentPicker
                    value={editState.groupStudentIds}
                    onChange={(ids) => setEditState((s) => s && { ...s, groupStudentIds: ids })}
                    students={sortedStudents}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">Клієнт</Label>
                  <StudentPicker
                    value={editState.studentId}
                    onChange={(id) => setEditState((s) => s && { ...s, studentId: id })}
                    students={sortedStudents}
                  />
                </div>
              )}
              {/* showAsFree — group only */}
              {editState.slot.isGroup && (
                <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-border/50 px-4 py-3 hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={editState.showAsFree}
                    onChange={(e) => setEditState((s) => s && { ...s, showAsFree: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <div>
                    <p className="text-sm font-medium">Вільно для запису</p>
                    <p className="text-xs text-muted-foreground">Відображати в публічному розкладі</p>
                  </div>
                  <Eye className={`h-4 w-4 ml-auto ${editState.showAsFree ? "text-primary" : "text-muted-foreground/40"}`} />
                </label>
              )}
              {/* applyTo — recurring only */}
              {editState.slot.isRecurring && (
                <div className="space-y-2">
                  <Label className="text-xs">Застосувати до</Label>
                  <div className="flex gap-2">
                    {(["one", "future"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setEditState((s) => s && { ...s, applyTo: v })}
                        className={`flex-1 text-sm py-2 rounded-lg border transition-colors ${
                          editState.applyTo === v
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border/50 text-muted-foreground hover:border-border"
                        }`}
                      >
                        {v === "one" ? "Тільки це" : "Це і майбутні"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button onClick={confirmEdit} disabled={editState.saving} className="flex-1">
                  {editState.saving ? "Зберігаємо..." : "Зберегти"}
                </Button>
                <Button variant="outline" onClick={() => setEditState(null)}>Скасувати</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Student picker with search ────────────────────────────────────────────────

function StudentPicker({ value, onChange, students }: {
  value: string;
  onChange: (id: string) => void;
  students: StudentInfo[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const selected = students.find((s) => s.id === value);
  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const filtered = search
    ? sorted.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : sorted;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm text-left flex items-center justify-between gap-2 hover:bg-muted/30 transition-colors"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected ? selected.name : "— Вільно для запису —"}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden">
          <button
            type="button"
            className={`w-full px-3 py-2 text-sm text-left transition-colors hover:bg-muted/50 ${!value ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}
            onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
          >
            — Вільно для запису —
          </button>
          <div className="border-t border-border/40 px-3 py-1.5">
            <input
              autoFocus
              type="text"
              placeholder="Пошук..."
              className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/50 py-0.5"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="border-t border-border/40 max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Не знайдено</p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`w-full px-3 py-2 text-sm text-left transition-colors hover:bg-muted/50 ${value === s.id ? "bg-primary/10 text-primary font-medium" : ""}`}
                  onClick={() => { onChange(s.id); setOpen(false); setSearch(""); }}
                >
                  {s.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Multi-student picker (for group slots) ────────────────────────────────────

function MultiStudentPicker({ value, onChange, students }: {
  value: string[];
  onChange: (ids: string[]) => void;
  students: StudentInfo[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const filtered = search ? sorted.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())) : sorted;

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  const selectedNames = students.filter((s) => value.includes(s.id)).map((s) => s.name);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full min-h-9 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-left flex items-center justify-between gap-2 hover:bg-muted/30 transition-colors"
      >
        <span className={selectedNames.length > 0 ? "text-foreground" : "text-muted-foreground"}>
          {selectedNames.length > 0 ? selectedNames.join(", ") : "Оберіть клієнтів..."}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden">
          <div className="border-b border-border/40 px-3 py-1.5">
            <input
              autoFocus
              type="text"
              placeholder="Пошук..."
              className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/50 py-0.5"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Не знайдено</p>
            ) : (
              filtered.map((s) => {
                const checked = value.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2.5 transition-colors hover:bg-muted/50 ${checked ? "bg-primary/5" : ""}`}
                    onClick={() => toggle(s.id)}
                  >
                    <span className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                      {checked && <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </span>
                    {s.name}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Slot row component ────────────────────────────────────────────────────────

interface SlotRowProps {
  slot: SlotData;
  onClick: () => void;
  onDelete: () => void;
  onToggleRecurring: () => void;
}

function SlotRow({ slot, onClick, onDelete, onToggleRecurring }: SlotRowProps) {
  const isRecurring = slot.isRecurring;
  const isGroup = slot.isGroup;
  const hasStudent = isGroup ? slot.groupStudents.length > 0 : !!slot.student;

  // group = purple, individual with student = green/blue, free = grey
  const colors = isGroup
    ? { card: "border-purple-200 bg-purple-50/80", bar: "bg-purple-400", badge: "bg-purple-100 text-purple-700 hover:bg-purple-200", text: "text-purple-700", icon: "text-purple-600" }
    : hasStudent
      ? isRecurring
        ? { card: "border-emerald-200 bg-emerald-50/80", bar: "bg-emerald-400", badge: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200", text: "text-emerald-700", icon: "text-emerald-600" }
        : { card: "border-blue-200 bg-blue-50/80", bar: "bg-blue-400", badge: "bg-blue-100 text-blue-700 hover:bg-blue-200", text: "text-blue-700", icon: "text-blue-600" }
      : { card: "border-border/40 bg-muted/30", bar: "bg-muted-foreground/25", badge: "bg-muted text-muted-foreground hover:bg-muted/80", text: "text-muted-foreground", icon: "text-muted-foreground/60" };

  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors cursor-pointer hover:brightness-95 ${colors.card}`}
      onClick={onClick}
    >
      {/* Color indicator */}
      <div className={`w-1 h-8 rounded-full shrink-0 ${colors.bar}`} />

      {/* Time */}
      <div className="shrink-0 text-center min-w-[90px]">
        <p className="text-sm font-mono font-semibold">
          {slot.startTime} – {slot.endTime}
        </p>
        <p className="text-[10px] text-muted-foreground">{slot.durationMin} хв</p>
      </div>

      {/* Student(s) */}
      <div className="flex-1 min-w-0">
        {isGroup ? (
          slot.groupStudents.length > 0 ? (
            <div className="flex items-start gap-1.5">
              <Users className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${colors.icon}`} />
              <span className={`text-sm font-medium leading-snug ${colors.text}`}>
                {slot.groupStudents.map((gs) => gs.student.name).join(", ")}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/50">Група (без клієнтів)</span>
          )
        ) : slot.student ? (
          <div className="flex items-center gap-1.5">
            <User className={`h-3.5 w-3.5 shrink-0 ${colors.icon}`} />
            <span className={`text-sm font-medium truncate ${colors.text}`}>
              {slot.student.name}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/50">Вільно</span>
        )}
      </div>

      {/* Weekly toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleRecurring(); }}
        title={isRecurring ? "Щотижнево — натисніть щоб змінити" : "Разове — натисніть щоб зробити щотижневим"}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 ${colors.badge}`}
      >
        <RefreshCw className="h-3 w-3" />
        {isRecurring ? "Щотижнево" : "Разове"}
      </button>

      {/* Delete */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-white/60 transition-colors shrink-0"
        title="Видалити"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
