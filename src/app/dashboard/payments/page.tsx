"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/payment-offset";
import { RefreshCw, Zap, Users, ArrowDownLeft, Check, X, Ban, Undo2 } from "lucide-react";

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
          {formatAmount(displayKopecks)}
        </span>
      ) : (
        <span className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">
          —
        </span>
      )}
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [data, setData] = useState<PaymentsData>({ clients: [], transactions: [] });
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [mockAmount, setMockAmount] = useState("");

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

  async function poll(injectAmount?: number) {
    setPolling(true);
    const body: Record<string, unknown> = {};
    if (injectAmount) body.mockAmount = injectAmount;
    try {
      const res = await fetch("/api/payments/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
          {/* Dev: simulate payment */}
          <div className="flex gap-1 items-center" title="Симуляція оплати (тільки в dev)">
            <input
              className="h-9 w-24 rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground"
              placeholder="Сума"
              value={mockAmount}
              onChange={(e) => setMockAmount(e.target.value)}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => poll(Math.round(Number(mockAmount) * 100))}
              disabled={!mockAmount || polling}
              title="Симулювати оплату"
            >
              <Zap className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => poll()} disabled={polling}>
            <RefreshCw className={`h-4 w-4 mr-2 ${polling ? "animate-spin" : ""}`} />
            Перевірити
          </Button>
        </div>
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
                      <span className="font-medium">{c.name}</span>
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{c.offsetFormatted}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div>
                        <p className="mb-1">Занять</p>
                        <p className="text-foreground font-medium">{c.conductedCount}</p>
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
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs w-28" title="Проведені заняття">Занять</th>
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
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{c.conductedCount}</td>
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
                        className={`p-1.5 rounded-md transition-colors ${tx.isIgnored ? "text-emerald-600 hover:bg-emerald-50" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"}`}
                      >
                        {tx.isIgnored ? <Undo2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
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
                      <th className="px-4 py-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className={`border-b border-border/30 last:border-0 transition-colors group ${tx.isIgnored ? "bg-muted/30 opacity-60 hover:opacity-80" : "hover:bg-muted/20"}`}>
                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          {new Date(tx.confirmedAt).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${tx.isIgnored ? "line-through text-muted-foreground" : ""}`}>{tx.studentName}</span>
                            {tx.isIgnored && <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full whitespace-nowrap">не є оплатою</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${tx.isIgnored ? "text-muted-foreground" : "text-emerald-600"}`}>+{formatAmount(tx.amountReal)}</span>
                        </td>
                        <td className="px-2 py-3">
                          <button onClick={() => toggleIgnore(tx)} className={`p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100 ${tx.isIgnored ? "text-emerald-600 hover:bg-emerald-50" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"}`}>
                            {tx.isIgnored ? <Undo2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
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
