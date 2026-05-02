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
import { Check, Copy, Plus, UserCheck } from "lucide-react";

const BOT_USERNAME = "EasySchBot";

export function AddStudentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // step: "form" | "invite"
  const [step, setStep] = useState<"form" | "invite">("form");
  const [studentName, setStudentName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [copied, setCopied] = useState(false);

  function inviteMessage(code: string) {
    return (
      `Будь ласка, відкрийте телеграм бот @${BOT_USERNAME} та використайте команду:\n` +
      `/start ${code}\n\n` +
      `Так ви зможете отримувати сповіщення про заняття та реквізити для оплат.`
    );
  }

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
      setTimeout(() => { setStep("form"); setCopied(false); }, 200);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteMessage(studentCode));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не вдалося скопіювати");
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
                  <Label>Ціна заняття</Label>
                  <Input name="lessonPrice" type="number" min="0" step="1" placeholder="1500" required />
                </div>
                <div className="space-y-2">
                  <Label>Ціна групового заняття <span className="text-muted-foreground font-normal">(необов&apos;язково)</span></Label>
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
                <p className="text-sm text-muted-foreground">
                  Надішліть це повідомлення клієнту, щоб він підключив Telegram бот:
                </p>

                {/* Message bubble */}
                <div className="relative">
                  <div className="rounded-xl bg-muted/60 border border-border/50 px-4 py-3 text-sm leading-relaxed whitespace-pre-line font-mono text-foreground">
                    {inviteMessage(studentCode)}
                  </div>
                  <button
                    onClick={copyInvite}
                    className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                    title="Скопіювати"
                  >
                    {copied
                      ? <Check className="h-4 w-4 text-emerald-500" />
                      : <Copy className="h-4 w-4" />}
                  </button>
                </div>

                <Button
                  onClick={copyInvite}
                  variant={copied ? "secondary" : "default"}
                  className="w-full"
                >
                  {copied
                    ? <><Check className="h-4 w-4 mr-2 text-emerald-500" /> Скопійовано</>
                    : <><Copy className="h-4 w-4 mr-2" /> Скопіювати повідомлення</>}
                </Button>

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
