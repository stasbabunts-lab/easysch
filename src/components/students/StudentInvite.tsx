"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Copy, Check, Send } from "lucide-react";

const BOT_USERNAME = "EasySchBot";

export function inviteMessage(code: string, nounPlural = "заняття") {
  return (
    `Підключіться до бота, щоб отримувати нагадування про ${nounPlural} та реквізити для оплат:\n` +
    `https://t.me/${BOT_USERNAME}?start=${code}\n\n` +
    `Або відкрийте @${BOT_USERNAME} і надішліть команду: /start ${code}`
  );
}

/** Bright, unmistakable "forward this to the client" block. */
export function StudentInviteBody({ code, nounPlural = "заняття" }: { code: string; nounPlural?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteMessage(code, nounPlural));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не вдалося скопіювати");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg bg-primary/10 border border-primary/30 px-3 py-2.5">
        <Send className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-sm font-semibold text-foreground">
          Перешліть це повідомлення клієнту — воно для нього, а не для вас.
          Не вводьте код самі.
        </p>
      </div>

      <div className="rounded-xl border-2 border-primary/40 bg-card px-4 py-3">
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
          {inviteMessage(code, nounPlural)}
        </p>
      </div>

      <Button onClick={copy} className="w-full">
        {copied ? (
          <><Check className="h-4 w-4 mr-2" /> Скопійовано</>
        ) : (
          <><Copy className="h-4 w-4 mr-2" /> Скопіювати повідомлення</>
        )}
      </Button>
    </div>
  );
}

/** Envelope button (for the client list) that re-opens the invite message. */
export function StudentInviteButton({ name, code, nounPlural = "заняття" }: { name: string; code: string; nounPlural?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex items-center justify-center h-7 w-7 rounded-md text-primary bg-primary/8 hover:bg-primary/15 transition-colors shrink-0"
        title="Повідомлення для підключення клієнта"
        aria-label="Повідомлення для підключення клієнта"
      >
        <Mail className="h-3.5 w-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Підключення: {name}
            </DialogTitle>
          </DialogHeader>
          <StudentInviteBody code={code} nounPlural={nounPlural} />
        </DialogContent>
      </Dialog>
    </>
  );
}
