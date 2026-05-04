"use client";

import { useState } from "react";
import type { NotifType } from "@/lib/bot/notification-log";

const NOTIF_META: Record<NotifType, { label: string; cls: string }> = {
  lesson_reminder:   { label: "Нагадування урок",   cls: "bg-blue-50 text-blue-700" },
  payment_reminder:  { label: "Нагадування оплата",  cls: "bg-amber-50 text-amber-700" },
  payment_confirmed: { label: "Оплату підтверджено", cls: "bg-emerald-50 text-emerald-700" },
  payment_request:   { label: "Запит оплати",        cls: "bg-violet-50 text-violet-700" },
};

export interface NotifEntry {
  id: string;
  studentName: string;
  type: string;
  text: string;
  sentAt: string; // ISO string (serialized from Date)
}

function formatNotifTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleString("uk-UA", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  });
}

export function NotificationLog({ notifs }: { notifs: NotifEntry[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (notifs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Сповіщення поки не надсилались
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {notifs.map((n) => {
        const meta = NOTIF_META[n.type as NotifType] ?? { label: n.type, cls: "bg-muted text-muted-foreground" };
        const isExpanded = expanded.has(n.id);
        return (
          <div
            key={n.id}
            className="flex items-start justify-between gap-3 py-2.5 border-b border-border/40 last:border-0 cursor-pointer hover:bg-muted/20 -mx-4 px-4 rounded transition-colors"
            onClick={() => toggle(n.id)}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0 mt-0.5">
                {n.studentName.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{n.studentName}</span>
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>
                <p className={`text-xs text-muted-foreground mt-0.5 ${isExpanded ? "whitespace-pre-wrap break-words" : "truncate"}`}>
                  {n.text}
                </p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
              {formatNotifTime(n.sentAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
