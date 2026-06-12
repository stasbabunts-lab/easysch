"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Clock, Copy, MessageCircle, RefreshCw, XCircle } from "lucide-react";

type Status = "loading" | "PENDING" | "CONFIRMED" | "EXPIRED" | "error";

interface PendingData {
  amountTotal: number;
  cardNumber: string;
  telegramLink: string;
  expiresAt: string;
}

function formatUah(kopecks: number) {
  // e.g. 8003 → "80.03"
  const uah = Math.floor(kopecks / 100);
  const kop = kopecks % 100;
  return `${uah}.${String(kop).padStart(2, "0")}`;
}

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function PayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paymentId = searchParams.get("id");

  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<PendingData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [copiedCard, setCopiedCard] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeRef = useRef(true);

  async function poll() {
    if (!paymentId || !activeRef.current) return;
    try {
      const res = await fetch(`/api/subscription/status?id=${paymentId}`);
      if (!res.ok) { setStatus("error"); return; }
      const json = await res.json();

      if (json.status === "CONFIRMED") {
        setStatus("CONFIRMED");
        clearInterval(pollingRef.current!);
        clearInterval(timerRef.current!);
        return;
      }
      if (json.status === "EXPIRED") {
        setStatus("EXPIRED");
        clearInterval(pollingRef.current!);
        clearInterval(timerRef.current!);
        return;
      }

      if (status === "loading") {
        const sLeft = Math.max(0, Math.floor((new Date(json.expiresAt).getTime() - Date.now()) / 1000));
        setSecondsLeft(sLeft);
      }
      setData(json as PendingData);
      setStatus("PENDING");
    } catch {
      // keep trying
    }
  }

  useEffect(() => {
    if (!paymentId) { setStatus("error"); return; }
    poll();
    pollingRef.current = setInterval(poll, 15_000);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          clearInterval(pollingRef.current!);
          setStatus((s) => s === "PENDING" ? "EXPIRED" : s);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      activeRef.current = false;
      clearInterval(pollingRef.current!);
      clearInterval(timerRef.current!);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  function copy(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  }

  // ── CONFIRMED ─────────────────────────────────────────────────────────
  if (status === "CONFIRMED") {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
          </div>
        </div>
        <h1 className="text-2xl font-bold">Оплату отримано!</h1>
        <p className="text-muted-foreground">Підписку успішно продовжено.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-4 w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-colors"
        >
          До головної
        </button>
      </div>
    );
  }

  // ── EXPIRED ───────────────────────────────────────────────────────────
  if (status === "EXPIRED") {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            <XCircle className="h-10 w-10 text-muted-foreground" />
          </div>
        </div>
        <h1 className="text-2xl font-bold">Час вийшов</h1>
        <p className="text-muted-foreground text-sm">
          Платіж не надійшов протягом 10 хвилин.
          {data?.telegramLink && " Якщо ви вже оплатили — зверніться до підтримки."}
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Link
            href="/subscribe/amount"
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Спробувати знову
          </Link>
          {data?.telegramLink && (
            <div className="space-y-1.5">
              <a
                href={data.telegramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 border border-border rounded-xl py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <MessageCircle className="h-4 w-4" /> Звернутися до підтримки
              </a>
              <p className="text-center text-xs text-muted-foreground">
                У боті надішліть команду{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">/support</code>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <p className="text-muted-foreground">Щось пішло не так.</p>
        <Link href="/subscribe/amount" className="text-primary hover:underline text-sm">
          Спробувати ще раз
        </Link>
      </div>
    );
  }

  // ── LOADING / PENDING ─────────────────────────────────────────────────
  const amountStr = data ? formatUah(data.amountTotal) : null;
  const timerDanger = secondsLeft < 60;

  return (
    <div className="max-w-md mx-auto py-10 px-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Оплата підписки</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Переведіть точну суму на картку нижче
        </p>
      </div>

      {/* Timer */}
      <div className={`rounded-xl border px-5 py-3.5 flex items-center justify-between ${
        timerDanger ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
      }`}>
        <div className="flex items-center gap-2">
          <Clock className={`h-4 w-4 ${timerDanger ? "text-red-500" : "text-amber-600"}`} />
          <span className={`text-sm font-medium ${timerDanger ? "text-red-600" : "text-amber-700"}`}>
            Час на оплату
          </span>
        </div>
        <span className={`text-xl font-bold font-mono ${timerDanger ? "text-red-600" : "text-amber-700"}`}>
          {status === "loading" ? "10:00" : formatTimer(secondsLeft)}
        </span>
      </div>

      {/* Amount + card */}
      <div className="rounded-xl border border-border/60 bg-card px-5 py-5 space-y-5">
        {/* Amount */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Сума до сплати</p>
          {amountStr ? (
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold tabular-nums">{amountStr}</span>
              <span className="text-2xl font-semibold text-muted-foreground">грн</span>
              <button
                onClick={() => copy(amountStr, setCopiedAmount)}
                className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Copy className="h-3.5 w-3.5" />
                {copiedAmount ? "Скопійовано" : "Копіювати"}
              </button>
            </div>
          ) : (
            <div className="h-14 flex items-center">
              <div className="h-10 w-36 bg-muted animate-pulse rounded-lg" />
            </div>
          )}
          <p className="text-sm font-semibold text-amber-600 mt-2">
            ⚠️ Переводьте точну суму
          </p>
        </div>

        {/* Card */}
        {data?.cardNumber && (
          <div className="border-t border-border/50 pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Картка отримувача</p>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono font-semibold text-xl tracking-wider">{data.cardNumber}</span>
              <button
                onClick={() => copy(data.cardNumber, setCopiedCard)}
                className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
              >
                <Copy className="h-3.5 w-3.5" />
                {copiedCard ? "Скопійовано" : "Копіювати"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Polling indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        Перевіряємо надходження автоматично
      </div>

      {/* Help */}
      {data?.telegramLink && (
        <div className="space-y-1.5">
          <a
            href={data.telegramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Звернутися до підтримки
          </a>
          <p className="text-center text-xs text-muted-foreground">
            У боті надішліть команду{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">/support</code>
          </p>
        </div>
      )}
    </div>
  );
}

export default function SubscribePayPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto py-16 px-4 text-center text-muted-foreground text-sm">Завантаження...</div>}>
      <PayContent />
    </Suspense>
  );
}
