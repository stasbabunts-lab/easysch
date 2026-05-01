"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, CreditCard, CalendarPlus, AlertCircle } from "lucide-react";
import { formatAmount } from "@/lib/format";

interface Student {
  id: string;
  name: string;
  lessonPrice: number;
  paymentOffset: number;
  notes?: string | null;
}

export function StudentActions({ student, hasPaymentDetails }: { student: Student; hasPaymentDetails: boolean }) {
  const router = useRouter();
  const [payDialog, setPayDialog] = useState(false);
  const [lessonDialog, setLessonDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  async function createPaymentRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/payments/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: student.id,
        amountBase: fd.get("amount"),
        description: fd.get("description"),
      }),
    });
    setLoading(false);
    if (res.ok) {
      const req = await res.json();
      const uniqueAmount = formatAmount(req.amountTotal);
      toast.success(`Запит створено. Скажіть клієнту переказати рівно ${uniqueAmount}`);
      setPayDialog(false);
      router.refresh();
    } else {
      toast.error("Помилка створення запиту");
    }
  }

  async function createLesson(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const date = fd.get("date") as string;
    const time = fd.get("time") as string;
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
    const res = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: student.id,
        scheduledAt,
        durationMin: fd.get("duration"),
        notes: fd.get("notes"),
      }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Заняття заплановано");
      setLessonDialog(false);
      router.refresh();
    } else {
      toast.error("Помилка");
    }
  }

  async function editStudent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/students/${student.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        lessonPrice: fd.get("lessonPrice"),
        notes: fd.get("notes"),
      }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Дані оновлено");
      setEditDialog(false);
      router.refresh();
    } else {
      toast.error("Помилка");
    }
  }

  async function deleteStudent() {
    if (!confirm(`Видалити клієнта "${student.name}"? Усі дані будуть видалені.`)) return;
    const res = await fetch(`/api/students/${student.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Клієнта видалено");
      router.push("/dashboard/students");
    } else {
      toast.error("Помилка видалення");
    }
  }

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="flex gap-2 shrink-0">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          if (!hasPaymentDetails) {
            toast.error("Спочатку заповніть реквізити для оплати на сторінці «Оплати»");
            return;
          }
          setPayDialog(true);
        }}
        title={!hasPaymentDetails ? "Спочатку заповніть реквізити для оплати" : undefined}
      >
        {!hasPaymentDetails && <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />}
        {hasPaymentDetails && <CreditCard className="h-4 w-4 mr-2" />}
        Запросити оплату
      </Button>
      <Button size="sm" onClick={() => setLessonDialog(true)}>
        <CalendarPlus className="h-4 w-4 mr-2" /> Заняття
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="sm" variant="ghost" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditDialog(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Редагувати
          </DropdownMenuItem>
          <DropdownMenuItem onClick={deleteStudent} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" /> Видалити
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Payment request dialog */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Запит оплати</DialogTitle></DialogHeader>
          <form onSubmit={createPaymentRequest} className="space-y-4">
            <div className="space-y-2">
              <Label>Сума</Label>
              <Input name="amount" type="number" defaultValue={student.lessonPrice / 100} min="1" step="1" required />
              <p className="text-xs text-muted-foreground">
                Клієнту призначається унікальна сума (+{student.paymentOffset} коп) для автоматичного розпізнавання.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Коментар</Label>
              <Input name="description" placeholder="За квітень..." />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Створюємо..." : "Створити запит"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lesson dialog */}
      <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Запланувати заняття</DialogTitle></DialogHeader>
          <form onSubmit={createLesson} className="space-y-4">
            <div className="space-y-2">
              <Label>Дата</Label>
              <Input name="date" type="date" defaultValue={todayStr} required />
            </div>
            <div className="space-y-2">
              <Label>Час</Label>
              <Input name="time" type="time" defaultValue="10:00" required />
            </div>
            <div className="space-y-2">
              <Label>Тривалість (хв)</Label>
              <Input name="duration" type="number" defaultValue="60" min="15" step="5" required />
            </div>
            <div className="space-y-2">
              <Label>Нотатки</Label>
              <Textarea name="notes" rows={2} placeholder="Тема заняття..." />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Створюємо..." : "Запланувати"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Редагувати клієнта</DialogTitle></DialogHeader>
          <form onSubmit={editStudent} className="space-y-4">
            <div className="space-y-2">
              <Label>Ім&apos;я</Label>
              <Input name="name" defaultValue={student.name} required />
            </div>
            <div className="space-y-2">
              <Label>Ціна заняття</Label>
              <Input name="lessonPrice" type="number" defaultValue={student.lessonPrice / 100} required />
            </div>
            <div className="space-y-2">
              <Label>Нотатки</Label>
              <Textarea name="notes" defaultValue={student.notes ?? ""} rows={2} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>Зберегти</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
