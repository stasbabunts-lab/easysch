"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Copy, Check, ExternalLink, Bell, MessageCircle,
  Building2, ShieldCheck, Plus, Trash2, Eye, EyeOff,
  Info, ToggleLeft, ToggleRight, Phone, CalendarDays, BookOpen,
} from "lucide-react";
import {
  LESSON_NOUNS,
  DEFAULT_LESSON_NOUN_KEY,
  resolveLessonNoun,
  cap,
} from "@/lib/lesson-noun";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { APP_NAME } from "@/lib/labels";
import { BANK_OPTIONS, ALL_BANK_OPTIONS } from "@/lib/bank";
import { GuideButton } from "@/components/layout/GuideButton";

interface TeacherSettings {
  teacherReminderMinutes: string;
  studentReminderMinutes: string;
  telegramChatId: string | null;
  telegramUsername: string;
  phone: string;
  name: string;
  displayName: string;
  alias: string;
  weekStartsMonday: boolean;
  showStudentPhone: boolean;
  lessonNoun: string;
}

interface BankAccount {
  id: string;
  bankType: string;
  label: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<TeacherSettings>({
    teacherReminderMinutes: "60",
    studentReminderMinutes: "60",
    telegramChatId: null,
    telegramUsername: "",
    phone: "",
    name: "",
    displayName: "",
    alias: "",
    weekStartsMonday: false,
    showStudentPhone: false,
    lessonNoun: DEFAULT_LESSON_NOUN_KEY,
  });
  const [savingAlias, setSavingAlias] = useState(false);
  const [savingContacts, setSavingContacts] = useState(false);
  const [savingReminders, setSavingReminders] = useState(false);
  const [savingDisplay, setSavingDisplay] = useState(false);
  const [savingWeekStart, setSavingWeekStart] = useState(false);

  // Bank accounts
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addBank, setAddBank] = useState<string>(BANK_OPTIONS[0].value);
  const [addLabel, setAddLabel] = useState("");
  const [addCreds, setAddCreds] = useState<Record<string, string>>({});
  const [showFields, setShowFields] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);

  // The alias input is edited live, so the public link must follow the *saved*
  // value — copying or opening a slug that was only typed leads to a 404.
  const [savedAlias, setSavedAlias] = useState("");
  const code = session?.user?.teacherCode ?? "...";
  const publicUrl = `https://easy-sch.com/${savedAlias || code}`;
  const aliasDirty = settings.alias !== savedAlias;

  useEffect(() => {
    fetch("/api/teachers")
      .then((r) => r.json())
      .then((data) => {
        if (data) setSettings({
          teacherReminderMinutes: data.teacherReminderMinutes ?? "60",
          studentReminderMinutes: data.studentReminderMinutes ?? "60",
          telegramChatId: data.telegramChatId ?? null,
          telegramUsername: data.telegramUsername ?? "",
          phone: data.phone ?? "",
          name: data.name ?? "",
          displayName: data.displayName ?? "",
          alias: data.alias ?? "",
          weekStartsMonday: data.weekStartsMonday ?? false,
          showStudentPhone: data.showStudentPhone ?? false,
          lessonNoun: data.lessonNoun ?? DEFAULT_LESSON_NOUN_KEY,
        });
        setSavedAlias(data?.alias ?? "");
      })
      .catch(() => null);

    loadAccounts();
  }, []);

  async function loadAccounts() {
    const res = await fetch("/api/bank-accounts");
    if (res.ok) setAccounts(await res.json());
  }

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  function copyUrl() {
    navigator.clipboard.writeText(publicUrl);
    toast.success("Посилання скопійовано");
  }

  async function saveAlias(e: React.FormEvent) {
    e.preventDefault();
    setSavingAlias(true);
    try {
      const res = await fetch("/api/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: settings.alias }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Помилка збереження");
        return;
      }
      const updated = await res.json();
      setSettings((s) => ({ ...s, alias: updated.alias ?? "" }));
      setSavedAlias(updated.alias ?? "");
      toast.success(updated.alias ? "Аліас збережено" : "Аліас видалено");
    } catch {
      toast.error("Помилка збереження");
    } finally {
      setSavingAlias(false);
    }
  }

  async function saveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    if (!settings.name.trim()) { toast.error("Ім'я не може бути порожнім"); return; }
    setSavingDisplay(true);
    try {
      const res = await fetch("/api/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: settings.name.trim(), displayName: settings.displayName }),
      });
      if (!res.ok) throw new Error();
      toast.success("Збережено");
    } catch {
      toast.error("Помилка збереження");
    } finally {
      setSavingDisplay(false);
    }
  }

  async function saveContacts(e: React.FormEvent) {
    e.preventDefault();
    setSavingContacts(true);
    try {
      const res = await fetch("/api/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramUsername: settings.telegramUsername, phone: settings.phone }),
      });
      if (!res.ok) throw new Error();
      toast.success("Контакти збережено");
    } catch {
      toast.error("Помилка збереження");
    } finally {
      setSavingContacts(false);
    }
  }

  async function saveReminderSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingReminders(true);
    try {
      const res = await fetch("/api/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherReminderMinutes: settings.teacherReminderMinutes,
          studentReminderMinutes: settings.studentReminderMinutes,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Налаштування сповіщень збережено");
    } catch {
      toast.error("Помилка збереження");
    } finally {
      setSavingReminders(false);
    }
  }

  async function toggleWeekStart() {
    const next = !settings.weekStartsMonday;
    setSettings((s) => ({ ...s, weekStartsMonday: next })); // optimistic
    setSavingWeekStart(true);
    try {
      const res = await fetch("/api/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStartsMonday: next }),
      });
      if (!res.ok) throw new Error();
      toast.success("Збережено");
    } catch {
      setSettings((s) => ({ ...s, weekStartsMonday: !next })); // revert
      toast.error("Помилка збереження");
    } finally {
      setSavingWeekStart(false);
    }
  }

  async function saveLessonNoun(key: string) {
    const previous = settings.lessonNoun;
    setSettings((s) => ({ ...s, lessonNoun: key })); // optimistic
    try {
      const res = await fetch("/api/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonNoun: key }),
      });
      if (!res.ok) throw new Error();
      toast.success("Збережено");
    } catch {
      setSettings((s) => ({ ...s, lessonNoun: previous })); // revert
      toast.error("Помилка збереження");
    }
  }

  async function toggleShowStudentPhone() {
    const next = !settings.showStudentPhone;
    setSettings((s) => ({ ...s, showStudentPhone: next })); // optimistic
    try {
      const res = await fetch("/api/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showStudentPhone: next }),
      });
      if (!res.ok) throw new Error();
      toast.success("Збережено");
    } catch {
      setSettings((s) => ({ ...s, showStudentPhone: !next })); // revert
      toast.error("Помилка збереження");
    }
  }

  // ── Add account ─────────────────────────────────────────────────────
  function openAdd() {
    setAddBank(BANK_OPTIONS[0].value);
    setAddLabel("");
    setAddCreds({});
    setShowFields({});
    setAddOpen(true);
  }

  const selectedOption = BANK_OPTIONS.find((b) => b.value === addBank)!;

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addLabel.trim()) { toast.error("Вкажіть назву"); return; }
    setAdding(true);
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankType: addBank, label: addLabel, creds: addCreds }),
      });
      if (!res.ok) throw new Error();
      await loadAccounts();
      setAddOpen(false);
      toast.success("Рахунок додано");
    } catch {
      toast.error("Помилка збереження");
    } finally {
      setAdding(false);
    }
  }

  async function toggleAccount(acc: BankAccount) {
    const res = await fetch(`/api/bank-accounts/${acc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !acc.isActive }),
    });
    if (res.ok) {
      setAccounts((prev) => prev.map((a) => a.id === acc.id ? { ...a, isActive: !a.isActive } : a));
    }
  }

  async function deleteAccount(id: string) {
    if (!confirm("Видалити цей рахунок?")) return;
    const res = await fetch(`/api/bank-accounts/${id}`, { method: "DELETE" });
    if (res.ok) setAccounts((prev) => prev.filter((a) => a.id !== id));
    else toast.error("Помилка видалення");
  }

  const bankLabel = (type: string) =>
    ALL_BANK_OPTIONS.find((b) => b.value === type)?.label ?? type;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Налаштування</h1>
        <GuideButton />
      </div>

      {/* Telegram */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-blue-500" />
            Telegram сповіщення для вас
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.telegramChatId ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700">Telegram прив&apos;язано.</p>
            </div>
          ) : (
            <>
              <a
                href={`https://t.me/EasySchBot?start=${code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Підключити Telegram
              </a>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Відкриється бот{" "}
                <a
                  href="https://t.me/EasySchBot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  @EasySchBot
                </a>{" "}
                — натисніть «Start». Якщо команда не підставилась автоматично, надішліть її боту вручну:
              </p>
              <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
                <code className="text-sm font-mono text-primary">/start {code}</code>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Bank accounts */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <CardTitle className="text-base">Банківські рахунки</CardTitle>
            <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Додати
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Security note */}
          <div className="flex gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-800 leading-relaxed">
              <strong>Тільки читання.</strong> Застосунок використовує API банку виключно для
              отримання списку вхідних платежів — він не переказує й не знімає кошти та не змінює
              дані рахунку. Створюючи доступ, обирайте режим «лише виписка / читання».
            </p>
          </div>

          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Рахунки не додані. Натисніть «Додати» щоб підключити банк.
              <br />
              <span className="text-xs">Без підключення платежі вводяться вручну.</span>
            </p>
          ) : (
            <div className="space-y-2">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                    acc.isActive ? "border-border/50 bg-card" : "border-border/30 bg-muted/20 opacity-60"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{acc.label}</p>
                    <p className="text-xs text-muted-foreground">{bankLabel(acc.bankType)}</p>
                  </div>
                  <button
                    onClick={() => toggleAccount(acc)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title={acc.isActive ? "Вимкнути" : "Увімкнути"}
                  >
                    {acc.isActive
                      ? <ToggleRight className="h-5 w-5 text-emerald-600" />
                      : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => deleteAccount(acc.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Видалити"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule view */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Вигляд розкладу
          </CardTitle>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={toggleWeekStart}
            disabled={savingWeekStart}
            className="w-full flex items-center gap-3 rounded-lg border border-border/50 px-4 py-3 text-left hover:bg-muted/50 transition-colors disabled:opacity-60"
          >
            <div className="flex-1">
              <p className="text-sm font-medium">Починати тиждень з понеділка</p>
              <p className="text-xs text-muted-foreground">
                Розклад показує повний тиждень (Пн–Нд); минулі дні відображаються блякло.
              </p>
            </div>
            {settings.weekStartsMonday
              ? <ToggleRight className="h-6 w-6 text-emerald-600 shrink-0" />
              : <ToggleLeft className="h-6 w-6 text-muted-foreground shrink-0" />}
          </button>
        </CardContent>
      </Card>

      {/* What to call the meetings */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Як називати ваші зустрічі
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={
              resolveLessonNoun(settings.lessonNoun).key === "custom"
                ? settings.lessonNoun
                : resolveLessonNoun(settings.lessonNoun).key
            }
            onChange={(e) => saveLessonNoun(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {resolveLessonNoun(settings.lessonNoun).key === "custom" && (
              <option value={settings.lessonNoun}>{settings.lessonNoun} (власне слово)</option>
            )}
            {LESSON_NOUNS.map((n) => (
              <option key={n.key} value={n.key}>{cap(n.nom)}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Слово підставляється в усі повідомлення клієнтам, у команди бота і в кабінет — у потрібному відмінку.
          </p>
          {(() => {
            const n = resolveLessonNoun(settings.lessonNoun);
            return (
              <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 text-xs leading-6 text-muted-foreground space-y-0.5">
                <p>⏰ Нагадування про <b className="text-foreground">{n.acc}</b></p>
                <p>Ви завершили <b className="text-foreground">{n.acc}</b>, будь ласка, сплатіть 800,01 на рахунок…</p>
                <p>📅 Найближчі <b className="text-foreground">{n.plural}</b> · Проведено <b className="text-foreground">{n.genPl}</b></p>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Client card */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Картка клієнта
          </CardTitle>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={toggleShowStudentPhone}
            className="w-full flex items-center gap-3 rounded-lg border border-border/50 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1">
              <p className="text-sm font-medium">Поле телефону</p>
              <p className="text-xs text-muted-foreground">
                Показувати телефон у картці клієнта.
              </p>
            </div>
            {settings.showStudentPhone
              ? <ToggleRight className="h-6 w-6 text-emerald-600 shrink-0" />
              : <ToggleLeft className="h-6 w-6 text-muted-foreground shrink-0" />}
          </button>
        </CardContent>
      </Card>

      {/* Teacher code */}
      <Card className="border-border/50">
        <CardHeader className="pb-3"><CardTitle className="text-base">Код і публічне посилання</CardTitle></CardHeader>

        <CardContent className="space-y-3">
          {/* Code — for linking your own Telegram (/start CODE) */}
          <div className="flex items-center gap-2">
            <code className="font-mono text-lg font-bold tracking-widest text-primary bg-primary/10 rounded-lg px-3 py-1.5">
              {code}
            </code>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={copyCode} title="Скопіювати код">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
            <span className="text-xs text-muted-foreground">для підключення вашого Telegram</span>
          </div>

          {/* Public link — the alias field IS the link, so no separate URL row */}
          <form onSubmit={saveAlias} className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <div className="flex flex-1 min-w-0 rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-primary/30">
                <span className="flex items-center px-2.5 text-xs text-muted-foreground bg-muted border-r border-input whitespace-nowrap select-none">
                  easy-sch.com/
                </span>
                <input
                  value={settings.alias}
                  onChange={(e) => setSettings((s) => ({ ...s, alias: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                  placeholder={code.toLowerCase()}
                  title="Публічна сторінка розкладу. Тільки a–z, 0–9, дефіс, мін. 3 символи. Порожнє — буде код."
                  className="flex-1 px-2.5 py-1.5 text-sm font-mono bg-background outline-none min-w-0"
                />
              </div>
              {aliasDirty ? (
                <Button type="submit" size="sm" disabled={savingAlias}>
                  {savingAlias ? "..." : "Зберегти"}
                </Button>
              ) : (
                <>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={copyUrl} title="Скопіювати посилання">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer" title="Відкрити сторінку">
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {aliasDirty
                ? "a–z, 0–9, дефіс, мін. 3 символи. Порожнє — буде код."
                : "Публічна сторінка розкладу — надсилайте це посилання клієнтам."}
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Display name */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ім&apos;я та назва</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveDisplayName} className="space-y-4">
            <div className="space-y-2">
              <Label>Ваше ім&apos;я</Label>
              <p className="text-xs text-muted-foreground">
                Використовується в повідомленнях Telegram-бота клієнтам.
              </p>
              <Input
                value={settings.name}
                onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value }))}
                placeholder="Ім'я або прізвище"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Назва для клієнтів <span className="text-muted-foreground font-normal">(необов&apos;язково)</span></Label>
              <p className="text-xs text-muted-foreground">
                Якщо заповнено — замінює ім&apos;я на публічній сторінці розкладу та в боті.
              </p>
              <Input
                value={settings.displayName}
                onChange={(e) => setSettings((s) => ({ ...s, displayName: e.target.value }))}
                placeholder="Наприклад: Школа англійської Smile"
              />
            </div>
            <Button type="submit" disabled={savingDisplay}>
              {savingDisplay ? "Зберігаємо..." : "Зберегти"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Contacts */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Контакти для клієнтів
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveContacts} className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Кнопки «Написати» і «Подзвонити» з&apos;являться на вашій публічній сторінці, лише якщо заповнені.
            </p>
            <div className="space-y-2">
              <Label>Ваш Telegram</Label>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
                <Input
                  value={settings.telegramUsername}
                  onChange={(e) => setSettings((s) => ({ ...s, telegramUsername: e.target.value.replace(/^@/, "") }))}
                  placeholder="username"
                  className="pl-7"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Телефон <span className="text-muted-foreground font-normal">(за бажанням)</span></Label>
              <Input
                value={settings.phone}
                onChange={(e) => setSettings((s) => ({ ...s, phone: e.target.value }))}
                placeholder="+380 99 000 00 00"
                type="tel"
              />
            </div>
            <Button type="submit" disabled={savingContacts}>
              {savingContacts ? "Зберігаємо..." : "Зберегти контакти"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Reminders */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Налаштування нагадувань
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveReminderSettings} className="space-y-4">
            <div className="space-y-2">
              <Label>Нагадування для вас (хвилин до {resolveLessonNoun(settings.lessonNoun).gen})</Label>
              <Input value={settings.teacherReminderMinutes} placeholder="60, 1440"
                onChange={(e) => setSettings((s) => ({ ...s, teacherReminderMinutes: e.target.value }))} />
              <p className="text-xs text-muted-foreground">
                Через кому. Приклад: <code className="bg-muted px-1 rounded">60, 1440</code> — за 1 годину і за 1 день.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Нагадування для клієнтів (хвилин до {resolveLessonNoun(settings.lessonNoun).gen})</Label>
              <Input value={settings.studentReminderMinutes} placeholder="60"
                onChange={(e) => setSettings((s) => ({ ...s, studentReminderMinutes: e.target.value }))} />
            </div>
            <Button type="submit" disabled={savingReminders}>
              {savingReminders ? "Зберігаємо..." : "Зберегти нагадування"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Add bank account dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Додати банківський рахунок</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitAdd} className="space-y-4 pt-1">
            {/* Bank selector */}
            <div className="space-y-2">
              <Label>Банк</Label>
              <div className="grid gap-2">
                {BANK_OPTIONS.map((bank) => (
                  <label
                    key={bank.value}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 cursor-pointer transition-colors ${
                      addBank === bank.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"
                    }`}
                  >
                    <input type="radio" name="bank" value={bank.value}
                      checked={addBank === bank.value}
                      onChange={() => { setAddBank(bank.value); setAddCreds({}); setShowFields({}); }}
                      className="shrink-0"
                    />
                    <span className="text-sm font-medium">{bank.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Label */}
            <div className="space-y-2">
              <Label>Назва (для вашого зручності)</Label>
              <Input
                value={addLabel}
                onChange={(e) => setAddLabel(e.target.value)}
                placeholder={`${selectedOption.label} — основна картка`}
                required
              />
            </div>

            {/* Credential fields */}
            {selectedOption.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <div className="relative">
                  <Input
                    type={field.type === "password" && !showFields[field.key] ? "password" : "text"}
                    value={addCreds[field.key] ?? ""}
                    onChange={(e) => setAddCreds((c) => ({ ...c, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className={field.type === "password" ? "pr-10 font-mono text-sm" : ""}
                    required
                  />
                  {field.type === "password" && (
                    <button
                      type="button"
                      onClick={() => setShowFields((s) => ({ ...s, [field.key]: !s[field.key] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showFields[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>

                {/* How-to hint for first field only */}
                {field.howToGet && (
                  <div className="flex gap-2 rounded-lg bg-muted/50 border border-border/30 px-3 py-2.5">
                    <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <ol className="list-decimal list-inside space-y-0.5">
                        {field.howToGet.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                      <a
                        href={field.howToGet.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline inline-flex items-center gap-1 mt-1"
                      >
                        {field.howToGet.url.replace("https://", "")}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={adding} className="flex-1">
                {adding ? "Зберігаємо..." : "Зберегти"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Скасувати
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
