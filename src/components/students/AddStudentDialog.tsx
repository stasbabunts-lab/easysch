"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, UserCheck } from "lucide-react";
import { StudentInviteBody } from "./StudentInvite";

export function AddStudentDialog({
  noun = { gen: "заняття", plural: "заняття", groupGen: "групового заняття" },
}: {
  /** Teacher's word for a meeting — genitive / plural / genitive of a group one. */
  noun?: { gen: string; plural: string; groupGen: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // step: "form" | "invite"
  const [step, setStep] = useState<"form" | "invite">("form");
  const [studentName, setStudentName] = useState("");
  const [studentCode, setStudentCode] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "");
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        lessonPrice: fd.get("lessonPrice"),
        groupLessonPrice: fd.get("groupLessonPrice") || undefined,
        notes: fd.get("notes"),
      }),
    });
    setLoading(false);
    if (res.ok) {
      const student = await res.json();
      setStudentName(name);
      setStudentCode(student.code);
      setStep("invite");
      router.refresh();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Помилка");
    }
  }

  function handleClose(val: boolean) {
    setOpen(val);
    if (!val) {
      // reset on close
      setTimeout(() => { setStep("form"); }, 200);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => { setStep("form"); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-2" /> Додати клієнта
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">

          {step === "form" && (
            <>
              <DialogHeader>
                <DialogTitle>Новий клієнт</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Ім&apos;я</Label>
                  <Input name="name" placeholder="Анна Петренко" required />
                </div>
                <div className="space-y-2">
                  <Label>Ціна {noun.gen}</Label>
                  <Input name="lessonPrice" type="number" min="0" step="1" placeholder="1500" required />
                </div>
                <div className="space-y-2">
                  <Label>Ціна {noun.groupGen} <span className="text-muted-foreground font-normal">(необов&apos;язково)</span></Label>
                  <Input name="groupLessonPrice" type="number" min="1" step="1" placeholder="800" />
                </div>
                <div className="space-y-2">
                  <Label>Нотатки (необов&apos;язково)</Label>
                  <Textarea name="notes" placeholder="Рівень, цілі..." rows={2} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Додаємо..." : "Додати"}
                </Button>
              </form>
            </>
          )}

          {step === "invite" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-emerald-500" />
                  {studentName} додано
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <StudentInviteBody code={studentCode} nounPlural={noun.plural} />
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => handleClose(false)}
                >
                  Закрити
                </Button>
              </div>
            </>
          )}

        </DialogContent>
      </Dialog>
    </>
  );
}
