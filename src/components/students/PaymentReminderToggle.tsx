"use client";

import { useState } from "react";

interface Props {
  studentId: string;
  enabled: boolean;
}

export function PaymentReminderToggle({ studentId, enabled: initial }: Props) {
  const [enabled, setEnabled] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    const next = !enabled;
    setEnabled(next);
    setLoading(true);
    await fetch(`/api/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sendPaymentReminder: next }),
    }).catch(() => setEnabled(!next)); // revert on error
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={enabled ? "Нагадування про оплату увімкнено" : "Нагадування про оплату вимкнено"}
      className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors ${
        loading ? "opacity-50 cursor-wait" : "cursor-pointer hover:bg-muted/60"
      }`}
    >
      {/* Track */}
      <div
        className={`relative h-4 w-7 rounded-full transition-colors duration-200 ${
          enabled ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        {/* Thumb */}
        <div
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </div>
      <span className={enabled ? "text-foreground" : "text-muted-foreground"}>
        Нагадування про оплату
      </span>
    </button>
  );
}
