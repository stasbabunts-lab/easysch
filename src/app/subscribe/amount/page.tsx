"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface SubSettings {
  priceKopecks: number;
  periodDays: number;
  cardNumber: string;
}

export default function SubscribeAmountPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SubSettings>({ priceKopecks: 8000, periodDays: 30, cardNumber: "" });
  const [amountStr, setAmountStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/subscription/settings")
      .then((r) => r.json())
      .then((data: SubSettings) => {
        setSettings(data);
        setAmountStr(String(Math.round(data.priceKopecks / 100)));
      })
      .catch(() => {});
  }, []);

  const priceUah = Math.round(settings.priceKopecks / 100);
  const inputUah = parseFloat(amountStr) || 0;
  const addDays = inputUah > 0
    ? Math.floor(inputUah * 100 * settings.periodDays / settings.priceKopecks)
    : 0;

  async function handleProceed() {
    if (addDays < 1) {
      const minUah = Math.ceil(settings.priceKopecks / settings.periodDays) / 100;
      setError(`Мінімальна сума: ${minUah.toFixed(0)} грн`);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/subscription/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountKopecks: Math.round(inputUah * 100) }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      router.push(`/subscribe/pay?id=${data.id}`);
    } catch {
      setError("Не вдалось створити платіж. Спробуйте ще раз.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-10 px-4 space-y-6">
      <div>
        <Link
          href="/subscribe"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Назад
        </Link>
        <h1 className="text-2xl font-bold">Сума оплати</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {priceUah} грн = {settings.periodDays} днів підписки
        </p>
      </div>

      <div className="space-y-4">
        {/* Amount input */}
        <div className="rounded-xl border border-border/60 bg-card px-5 py-5 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Сума (грн)</label>
            <div className="relative">
              <input
                type="number"
                min={1}
                value={amountStr}
                onChange={(e) => { setAmountStr(e.target.value); setError(""); }}
                className="w-full text-4xl font-bold bg-transparent outline-none pr-16 py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder={String(priceUah)}
              />
              <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">грн</span>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {/* Days result — always visible */}
          <div className={`rounded-lg px-4 py-3 flex items-center justify-between transition-colors ${
            addDays > 0 ? "bg-primary/8 border border-primary/20" : "bg-muted/50 border border-border/40"
          }`}>
            <span className="text-sm text-muted-foreground">Отримаєте днів:</span>
            <span className={`text-lg font-bold ${addDays > 0 ? "text-primary" : "text-muted-foreground"}`}>
              {addDays > 0 ? `+${addDays}` : "—"}
            </span>
          </div>
        </div>

      </div>

      <button
        onClick={handleProceed}
        disabled={loading || addDays < 1}
        className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
      >
        {loading ? "Підготовка..." : "Оплатити →"}
      </button>
    </div>
  );
}
