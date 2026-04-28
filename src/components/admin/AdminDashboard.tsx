"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck, Users, LogOut, Plus, Minus, Calendar,
  MessageCircle, BookOpen,
} from "lucide-react";
import { toast } from "sonner";

interface Teacher {
  id: string;
  name: string;
  email: string;
  code: string;
  createdAt: Date | string;
  subscriptionExpiresAt: Date | string | null;
  telegramChatId: string | null;
  _count: { students: number; lessons: number };
}

function subStatus(expiresAt: Date | string | null): { label: string; variant: "secondary" | "destructive" | "outline"; daysLeft: number | null } {
  if (!expiresAt) return { label: "Немає підписки", variant: "destructive", daysLeft: null };
  const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (diff <= 0) return { label: "Закінчилась", variant: "destructive", daysLeft: 0 };
  if (diff <= 7) return { label: `${diff} дн`, variant: "outline", daysLeft: diff };
  return { label: `${diff} дн`, variant: "secondary", daysLeft: diff };
}

export function AdminDashboard({ teachers: initial }: { teachers: Teacher[] }) {
  const router = useRouter();
  const [teachers, setTeachers] = useState(initial);
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  async function handleLogout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.push("/admin/login");
  }

  async function addDays(teacherId: string, days: number) {
    setLoading(teacherId);
    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addDays: days }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setTeachers((prev) =>
        prev.map((t) => t.id === teacherId ? { ...t, subscriptionExpiresAt: updated.subscriptionExpiresAt } : t)
      );
      toast.success(`+${days} днів додано`);
    } catch {
      toast.error("Помилка");
    } finally {
      setLoading(null);
    }
  }

  async function setCustomDays(teacherId: string) {
    const val = parseInt(adding[teacherId] ?? "");
    if (!val || val <= 0) return;
    await addDays(teacherId, val);
    setAdding((prev) => ({ ...prev, [teacherId]: "" }));
  }

  async function revoke(teacherId: string) {
    if (!confirm("Відкликати підписку?")) return;
    setLoading(teacherId);
    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setTeachers((prev) =>
        prev.map((t) => t.id === teacherId ? { ...t, subscriptionExpiresAt: updated.subscriptionExpiresAt } : t)
      );
      toast.success("Підписку відкликано");
    } catch {
      toast.error("Помилка");
    } finally {
      setLoading(null);
    }
  }

  const activeCount = teachers.filter((t) => {
    if (!t.subscriptionExpiresAt) return false;
    return new Date(t.subscriptionExpiresAt) > new Date();
  }).length;

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <div className="bg-background border-b border-border/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-bold text-lg">EasySch Admin</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" /> Вийти
        </Button>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Всього спеціалістів</p>
              <p className="text-2xl font-bold mt-1">{teachers.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Активних підписок</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600">{activeCount}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Закінчених</p>
              <p className="text-2xl font-bold mt-1 text-destructive">{teachers.length - activeCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Teachers list */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Спеціалісти
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teachers.map((t) => {
              const { label, variant, daysLeft } = subStatus(t.subscriptionExpiresAt);
              const isLoading = loading === t.id;
              const expiry = t.subscriptionExpiresAt
                ? new Date(t.subscriptionExpiresAt).toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "numeric" })
                : "—";

              return (
                <div key={t.id} className="rounded-lg border border-border/40 p-4 space-y-3">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{t.name}</p>
                        {t.telegramChatId && <MessageCircle className="h-3.5 w-3.5 text-blue-500" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{t.email}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono text-primary">{t.code}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{t._count.students}</span>
                        <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{t._count.lessons}</span>
                        <span>з {new Date(t.createdAt).toLocaleDateString("uk-UA", { day: "numeric", month: "short" })}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <Badge variant={variant} className={daysLeft !== null && daysLeft > 7 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}>
                        {label}
                      </Badge>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        <Calendar className="h-3 w-3" /> {expiry}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground mr-1">Додати:</span>
                    {[7, 30, 90, 365].map((d) => (
                      <Button
                        key={d}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={isLoading}
                        onClick={() => addDays(t.id, d)}
                      >
                        +{d}д
                      </Button>
                    ))}
                    <div className="flex items-center gap-1 ml-1">
                      <Input
                        type="number"
                        min="1"
                        placeholder="N"
                        className="h-7 w-16 text-xs"
                        value={adding[t.id] ?? ""}
                        onChange={(e) => setAdding((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && setCustomDays(t.id)}
                      />
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={isLoading} onClick={() => setCustomDays(t.id)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
                      disabled={isLoading}
                      onClick={() => revoke(t.id)}
                    >
                      <Minus className="h-3 w-3 mr-1" /> Відкликати
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
