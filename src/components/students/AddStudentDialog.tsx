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
import { Plus } from "lucide-react";

export function AddStudentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        lessonPrice: fd.get("lessonPrice"),
        notes: fd.get("notes"),
      }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Клієнта додано");
      setOpen(false);
      router.refresh();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Помилка");
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" /> Додати клієнта
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
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
              <Input name="lessonPrice" type="number" min="1" step="1" placeholder="1500" required />
            </div>
            <div className="space-y-2">
              <Label>Нотатки (необов&apos;язково)</Label>
              <Textarea name="notes" placeholder="Рівень, цілі..." rows={2} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Додаємо..." : "Додати"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
