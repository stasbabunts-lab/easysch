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
  Info, ToggleLeft, ToggleRight, CreditCard, Phone,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { APP_NAME } from "@/lib/labels";
import { BANK_OPTIONS } from "@/lib/bank";

interface TeacherSettings {
  teacherReminderMinutes: string;
  studentReminderMinutes: string;
  telegramChatId: string | null;
  telegramUsername: string;
  phone: string;
  paymentDetails: string;
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
    paymentDetails: "",
  });
  const [savingContacts, setSavingContacts] = useState(false);
  const [savingReminders, setSavingReminders] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  // Bank accounts
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addBank, setAddBank] = useState<string>(BANK_OPTIONS[0].value);
  const [addLabel, setAddLabel] = useState("");
  const [addCreds, setAddCreds] = useState<Record<string, string>>({});
  const [showFields, setShowFields] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);

  const code = session?.user?.teacherCode ?? "...";
  const [publicUrl, setPublicUrl] = useState(`/${code}`);
  useEffect(() => { setPublicUrl(`${window.location.origin}/${code}`); }, [code]);

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
          paymentDetails: data.paymentDetails ?? "",
        });
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

  async function savePaymentDetails(e: React.FormEvent) {
    e.preventDefault();
    setSavingPayment(true);
    try {
      const res = await fetch("/api/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentDetails: settings.paymentDetails }),
      });
      if (!res.ok) throw new Error();
      toast.success("Реквізити збережено");
    } catch {
      toast.error("Помилка збереження");
    } finally {
      setSavingPayment(false);
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
    BANK_OPTIONS.find((b) => b.value === type)?.label ?? type;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Налаштування</h1>
        <p className="text-muted-foreground text-sm mt-1">{APP_NAME}</p>
      </div>

      {/* Teacher code */}
      <Card className="border-border/50">
        <CardHeader className="pb-3"><CardTitle className="text-base">Ваш код</CardTitle></CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 font-mono text-3xl font-bold tracking-widest text-primary bg-primary/10 rounded-xl px-6 py-4 text-center">
              {code}
            </div>
            <Button size="icon" variant="secondary" onClick={copyCode}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Публічна сторінка розкладу:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2 text-muted-foreground truncate">{publicUrl}</code>
              <Button size="icon" variant="ghost" onClick={copyUrl}><Copy className="h-4 w-4" /></Button>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="ghost"><ExternalLink className="h-4 w-4" /></Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <div className="rounded-lg bg-muted/50 px-4 py-3">
              <p className="text-sm text-muted-foreground">Telegram не прив&apos;язано.</p>
            </div>
          )}
          <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Команда для бота:</p>

            <code className="text-sm font-mono text-primary">/start {code}</code>
          </div>
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

      {/* Payment details */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Реквізити для оплати
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePaymentDetails} className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Ці дані клієнт побачить у Telegram після команди <code className="bg-muted px-1 rounded">/pay</code> і в автоматичному повідомленні після завершення заняття.
            </p>
            <textarea
              value={settings.paymentDetails}
              onChange={(e) => setSettings((s) => ({ ...s, paymentDetails: e.target.value }))}
              rows={4}
              placeholder={"Monobank: 4441 1111 2222 3333\nPrivatBank: +38 050 000 00 00\nІм'я: Іванов Іван"}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
            />
            <Button type="submit" disabled={savingPayment}>
              {savingPayment ? "Зберігаємо..." : "Зберегти реквізити"}
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
              <Label>Нагадування для вас (хвилин до заняття)</Label>
              <Input value={settings.teacherReminderMinutes} placeholder="60, 1440"
                onChange={(e) => setSettings((s) => ({ ...s, teacherReminderMinutes: e.target.value }))} />
              <p className="text-xs text-muted-foreground">
                Через кому. Приклад: <code className="bg-muted px-1 rounded">60, 1440</code> — за 1 годину і за 1 день.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Нагадування для клієнтів (хвилин до заняття)</Label>
              <Input value={settings.studentReminderMinutes} placeholder="60"
                onChange={(e) => setSettings((s) => ({ ...s, studentReminderMinutes: e.target.value }))} />
            </div>
            <Button type="submit" disabled={savingReminders}>
              {savingReminders ? "Зберігаємо..." : "Зберегти нагадування"}
            </Button>
          </form>
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
              <strong>Тільки читання.</strong> API банку використовується виключно для отримання
              списку вхідних платежів. Жодних операцій з рахунком — переказів, зняття коштів,
              зміни даних — через це API неможливо.
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
