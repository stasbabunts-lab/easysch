"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAmount, formatAmountWhole } from "@/lib/format";
import Link from "next/link";
import { RefreshCw, Users, ArrowDownLeft, Check, X, ChevronDown, MessageSquare } from "lucide-react";

interface ActiveClient {
  id: string;
  name: string;
  offset: number;
  offsetFormatted: string;
  lessonPrice: number;
  conductedCount: number;
  totalOwed: number;
  totalPaid: number;
  computedBalance: number;
  balanceAdjustmentKopecks: number;
  credit: number;
  debt: number;
}

interface TxItem {
  id: string;
  studentName: string;
  amountReceived: number;
  amountReal: number;
  confirmedAt: string;
  source: string;
  isIgnored: boolean;
}

interface PaymentsData {
  clients: ActiveClient[];
  transactions: TxItem[];
}

// ── Inline balance editor ──────────────────────────────────────────────────────

interface BalanceCellProps {
  client: ActiveClient;
  /** which side we're editing: credit (+) or debt (-) */
  side: "credit" | "debt";
  onSaved: (updated: ActiveClient) => void;
}

function BalanceCell({ client, side, onSaved }: BalanceCellProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayKopecks = side === "credit" ? client.credit : client.debt;

  function startEdit() {
    setValue(displayKopecks > 0 ? (displayKopecks / 100).toFixed(2) : "0.00");
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function cancel() {
    setEditing(false);
    setValue("");
  }

  async function save() {
    const amount = parseFloat(value.replace(",", "."));
    if (isNaN(amount) || amount < 0) {
      toast.error("Введіть коректну суму");
      return;
    }
    const desiredKopecks = Math.round(amount * 100);
    // Desired effective balance: + for credit, - for debt
    const desiredBalance = side === "credit" ? desiredKopecks : -desiredKopecks;
    // New adjustment = desiredBalance - computedBalance
    const newAdjustment = desiredBalance - client.computedBalance;

    setSaving(true);
    try {
      const res = await fetch(`/api/students/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balanceAdjustmentKopecks: newAdjustment }),
      });
      if (!res.ok) throw new Error();

      // Recompute effective balance locally
      const effectiveBalance = client.computedBalance + newAdjustment;
      const updated: ActiveClient = {
        ...client,
        balanceAdjustmentKopecks: newAdjustment,
        credit: effectiveBalance > 0 ? effectiveBalance : 0,
        debt: effectiveBalance < 0 ? -effectiveBalance : 0,
      };
      onSaved(updated);
      setEditing(false);
      setValue("");
      toast.success("Баланс оновлено");
    } catch {
      toast.error("Помилка збереження");
    } finally {
      setSaving(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          className="w-24 h-7 text-right text-sm border border-primary rounded px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          disabled={saving}
        />
        <button
          onClick={save}
          disabled={saving}
          className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={cancel}
          disabled={saving}
          className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      className="w-full text-right group"
      title="Натисніть щоб змінити"
    >
      {displayKopecks > 0 ? (
        <span
          className={`font-semibold group-hover:underline decoration-dashed underline-offset-2 ${
            side === "credit" ? "text-emerald-600" : "text-destructive"
          }`}
        >
          {side === "credit" ? "+" : ""}
          {formatAmountWhole(displayKopecks)}
        </span>
      ) : (
        <span className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">
          —
        </span>
      )}
    </button>
  );
}

// ── Inline price cell ──────────────────────────────────────────────────────────

function PriceCell({ client, onSaved }: { client: ActiveClient; onSaved: (updated: ActiveClient) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Display: lessonPrice + offset kopecks (unique sum)
  const displayKopecks = client.lessonPrice + client.offset;

  function startEdit() {
    // Edit only whole part (no offset)
    setValue(String(Math.floor(client.lessonPrice / 100)));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function cancel() { setEditing(false); }

  async function save() {
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) { cancel(); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonPrice: num }),
      });
      if (!res.ok) throw new Error();
      onSaved({ ...client, lessonPrice: num * 100 });
      toast.success("Ціну оновлено");
      setEditing(false);
    } catch {
      toast.error("Помилка збереження");
    } finally {
      setSaving(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <input
          ref={inputRef}
          type="number"
          min="1"
          step="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          className="w-20 h-7 text-right text-sm border border-primary rounded px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          disabled={saving}
        />
        <button onClick={save} disabled={saving} className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-colors">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={cancel} disabled={saving} className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button onClick={startEdit} className="w-full text-right group" title="Натисніть щоб змінити">
      <span className="font-medium tabular-nums group-hover:underline decoration-dashed underline-offset-2">
        {formatAmount(displayKopecks)}
      </span>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [data, setData] = useState<PaymentsData>({ clients: [], transactions: [] });
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  // ── Message editor state ───────────────────────────────────────────────────
  const [msgOpen, setMsgOpen] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState("");
  const [postLessonNote, setPostLessonNote] = useState("");
  const [savingMsg, setSavingMsg] = useState(false);

  useEffect(() => {
    fetch("/api/teachers")
      .then((r) => r.json())
      .then((d) => {
        if (d) {
          setPaymentDetails(d.paymentDetails ?? "");
          setPostLessonNote(d.postLessonNote ?? "");
        }
      })
      .catch(() => null);
  }, []);

  async function saveMessage(e: React.FormEvent) {
    e.preventDefault();
    setSavingMsg(true);
    try {
      const res = await fetch("/api/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentDetails, postLessonNote }),
      });
      if (!res.ok) throw new Error();
      toast.success("Повідомлення збережено");
    } catch {
      toast.error("Помилка збереження");
    } finally {
      setSavingMsg(false);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/payments");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function updateClient(updated: ActiveClient) {
    setData((prev) => ({
      ...prev,
      clients: prev.clients.map((c) => (c.id === updated.id ? updated : c)),
    }));
  }

  async function toggleIgnore(tx: TxItem) {
    const next = !tx.isIgnored;
    // Optimistic update
    setData((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.id === tx.id ? { ...t, isIgnored: next } : t
      ),
    }));
    try {
      const res = await fetch(`/api/payments/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isIgnored: next }),
      });
      if (!res.ok) throw new Error();
      // Reload clients to recalculate balances
      const fresh = await fetch("/api/payments");
      if (fresh.ok) {
        const freshData = await fresh.json();
        setData((prev) => ({ ...prev, clients: freshData.clients }));
      }
      toast.success(next ? "Транзакція виключена з розрахунків" : "Транзакція відновлена");
    } catch {
      // Revert optimistic update
      setData((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) =>
          t.id === tx.id ? { ...t, isIgnored: !next } : t
        ),
      }));
      toast.error("Помилка");
    }
  }

  async function poll() {
    setPolling(true);
    try {
      const res = await fetch("/api/payments/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      if (result.matched > 0) {
        toast.success(`Знайдено нових оплат: ${result.matched}`);
      } else {
        toast.info("Нових оплат не знайдено");
      }
      await loadData();
    } finally {
      setPolling(false);
    }
  }

  const { clients, transactions } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <h1 className="text-2xl font-bold">Оплати</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Баланс клієнтів та історія транзакцій
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => poll()} disabled={polling}>
            <RefreshCw className={`h-4 w-4 mr-2 ${polling ? "animate-spin" : ""}`} />
            Перевірити
          </Button>
        </div>
      </div>

      {/* Student message editor */}
      <div className="border border-border/50 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setMsgOpen((o) => !o)}
          className="w-full flex items-center gap-3 px-5 py-4 bg-card hover:bg-muted/40 transition-colors text-left"
        >
          <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Повідомлення клієнтам після заняття</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Надсилається в Telegram одразу після завершення заняття
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${msgOpen ? "rotate-180" : ""}`} />
        </button>

        {msgOpen && (
          <div className="border-t border-border/50 bg-card px-5 py-5">
            <form onSubmit={saveMessage} className="space-y-5">

              {/* 4 messages in order */}
              <div className="space-y-2">
                {/* Msg 1 — fixed */}
                <div className="flex gap-3 items-start">
                  <span className="text-xs text-muted-foreground font-mono mt-2.5 w-4 shrink-0">1</span>
                  <div className="flex-1 rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 text-sm text-foreground">
                    Ви завершили заняття на платформі Easy Schedule, будь ласка сплатіть{" "}
                    <span className="font-semibold text-primary">[сума]</span> на рахунок:
                  </div>
                </div>

                {/* Msg 2 — editable textarea */}
                <div className="flex gap-3 items-start">
                  <span className="text-xs text-muted-foreground font-mono mt-2.5 w-4 shrink-0">2</span>
                  <textarea
                    value={paymentDetails}
                    onChange={(e) => setPaymentDetails(e.target.value)}
                    rows={2}
                    placeholder="4444 1111 2222 3333"
                    className="flex-1 rounded-lg border border-input bg-white dark:bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                  />
                </div>

                {/* Msg 3 — fixed bold */}
                <div className="flex gap-3 items-start">
                  <span className="text-xs text-muted-foreground font-mono mt-2.5 w-4 shrink-0">3</span>
                  <div className="flex-1 rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 text-sm font-bold text-foreground">
                    Будь ласка сплачуйте точну суму
                  </div>
                </div>

                {/* Msg 4 — editable input */}
                <div className="flex gap-3 items-start">
                  <span className="text-xs text-muted-foreground font-mono mt-2.5 w-4 shrink-0">4</span>
                  <Input
                    value={postLessonNote}
                    onChange={(e) => setPostLessonNote(e.target.value)}
                    placeholder="Допис за необхідністю (необов'язково)"
                    className="flex-1 bg-white dark:bg-background"
                  />
                </div>
              </div>

              <Button type="submit" disabled={savingMsg}>
                {savingMsg ? "Зберігаємо..." : "Зберегти повідомлення"}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Active clients table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Активні клієнти</CardTitle>
            {!loading && (
              <span className="ml-auto text-xs text-muted-foreground">
                {clients.length === 1
                  ? "1 клієнт"
                  : `${clients.length} клієнтів`}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-sm text-muted-foreground px-6 pb-6">Завантажуємо...</p>
          ) : clients.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-6">
              Немає активних клієнтів — додайте клієнта до занять у розкладі.
            </p>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="sm:hidden divide-y divide-border/30">
                {clients.map((c) => (
                  <div key={c.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Link href={`/dashboard/students/${c.id}`} className="font-medium hover:text-primary hover:underline underline-offset-2 transition-colors">{c.name}</Link>
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{c.offsetFormatted}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div>
                        <p className="mb-1">Ціна ✎</p>
                        <PriceCell client={c} onSaved={updateClient} />
                      </div>
                      <div>
                        <p className="mb-1">На рахунку ✎</p>
                        <BalanceCell client={c} side="credit" onSaved={updateClient} />
                      </div>
                      <div>
                        <p className="mb-1">Борг ✎</p>
                        <BalanceCell client={c} side="debt" onSaved={updateClient} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs w-16">ID</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Клієнт</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs w-36">Ціна ✎</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs w-40">На рахунку ✎</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs w-40">Не оплачено ✎</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => (
                      <tr key={c.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold bg-muted px-2 py-0.5 rounded text-muted-foreground">{c.offsetFormatted}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/students/${c.id}`} className="font-medium hover:text-primary hover:underline underline-offset-2 transition-colors">
                            {c.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3"><PriceCell client={c} onSaved={updateClient} /></td>
                        <td className="px-4 py-3"><BalanceCell client={c} side="credit" onSaved={updateClient} /></td>
                        <td className="px-4 py-3"><BalanceCell client={c} side="debt" onSaved={updateClient} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Transaction history */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Історія транзакцій</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-sm text-muted-foreground px-6 pb-6">Завантажуємо...</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-6">
              Транзакцій поки немає.
            </p>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="sm:hidden divide-y divide-border/30">
                {transactions.map((tx) => (
                  <div key={tx.id} className={`px-4 py-3 flex items-center justify-between gap-3 ${tx.isIgnored ? "opacity-50" : ""}`}>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${tx.isIgnored ? "line-through text-muted-foreground" : ""}`}>{tx.studentName}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {new Date(tx.confirmedAt).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-semibold ${tx.isIgnored ? "text-muted-foreground" : "text-emerald-600"}`}>
                        +{formatAmount(tx.amountReal)}
                      </span>
                      <button
                        onClick={() => toggleIgnore(tx)}
                        className={`text-xs px-2 py-1 rounded-md transition-colors whitespace-nowrap border ${tx.isIgnored ? "text-emerald-600 border-emerald-200 hover:bg-emerald-50" : "text-muted-foreground border-border hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5"}`}
                      >
                        {tx.isIgnored ? "відновити" : "не оплата"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Дата і час</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Клієнт</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs w-36">Сума</th>
                      <th className="px-4 py-2.5 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className={`border-b border-border/30 last:border-0 transition-colors ${tx.isIgnored ? "bg-muted/30 opacity-60 hover:opacity-80" : "hover:bg-muted/20"}`}>
                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          {new Date(tx.confirmedAt).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${tx.isIgnored ? "line-through text-muted-foreground" : ""}`}>{tx.studentName}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${tx.isIgnored ? "text-muted-foreground" : "text-emerald-600"}`}>+{formatAmount(tx.amountReal)}</span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            onClick={() => toggleIgnore(tx)}
                            className={`text-xs px-2 py-1 rounded-md transition-colors border whitespace-nowrap ${tx.isIgnored ? "text-emerald-600 border-emerald-200 hover:bg-emerald-50" : "text-muted-foreground border-border hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5"}`}
                          >
                            {tx.isIgnored ? "відновити" : "не оплата"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
