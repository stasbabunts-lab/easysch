"use client";

import { useState } from "react";
import { MessageCircle, Send, CheckCircle2 } from "lucide-react";

export function SupportForm() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text || status === "sending") return;

    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Не вдалося надіслати. Спробуйте ще раз.");
      }
      setMessage("");
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Не вдалося надіслати.");
    }
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
          <MessageCircle className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-medium text-foreground flex items-center gap-2">
            Залишилися питання?
            <span className="rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold px-2 py-0.5">
              бета
            </span>
          </h2>
          <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
            Сервіс зараз у режимі бета-тестування. Якщо щось не працює, маєте питання
            чи ідею, як зробити краще — напишіть нам прямо звідси. Якщо ви підключили Telegram-бот{" "}
            <span className="text-foreground">@EasySchBot</span> — відповідь надійде туди.
            Якщо ні — ми відповімо на вашу електронну пошту.
          </p>

          {status === "sent" ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Дякуємо! Ваше повідомлення надіслано в підтримку.
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="text-primary hover:underline ml-1"
              >
                Написати ще
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-3 space-y-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Опишіть ваше питання, проблему або пропозицію…"
                className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              {status === "error" && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <button
                type="submit"
                disabled={!message.trim() || status === "sending"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
                {status === "sending" ? "Надсилаємо…" : "Надіслати в підтримку"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
