import Link from "next/link";
import { ArrowLeft, Bot, Landmark, CreditCard, CalendarPlus } from "lucide-react";

export const metadata = {
  title: "Як розпочати роботу",
};

interface Step {
  icon: React.ElementType;
  href: string;
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    icon: Bot,
    href: "/dashboard/settings",
    title: "Підключіть Telegram-бот",
    body: (
      <>
        У «Налаштування» знайдіть ваш персональний код і надішліть команду{" "}
        <code className="bg-muted px-1 py-0.5 rounded text-xs">/start КОД</code> боту{" "}
        <Link href="https://t.me/EasySchBot" target="_blank" className="text-primary hover:underline">@EasySchBot</Link>.
        Після цього ви отримуватимете сповіщення про оплати та нагадування про заняття.
        Клієнти підключаються так само — кожен отримує свій особистий код на сторінці «Клієнти».
      </>
    ),
  },
  {
    icon: CreditCard,
    href: "/dashboard/payments",
    title: "Заповніть реквізити для оплати",
    body: (
      <>
        На сторінці «Оплати» вкажіть номер картки або IBAN.
        Ці реквізити автоматично надсилаються клієнту в Telegram після кожного заняття та коли ви створюєте запит на оплату.
      </>
    ),
  },
  {
    icon: Landmark,
    href: "/dashboard/settings",
    title: "Налаштуйте API банку",
    body: (
      <>
        У «Налаштування» додайте токен вашого банку.
        Система автоматично перевіряє вхідні транзакції кожні 5 хвилин.{" "}
        <span className="font-medium text-emerald-700">🔒 Доступ лише на перегляд:</span>{" "}
        застосунок лише <span className="font-medium text-foreground">читає виписку</span>, щоб бачити вхідні платежі — він не може переказувати чи знімати кошти або керувати вашим рахунком.{" "}
        <span className="font-medium text-foreground">Як розпізнається платіж:</span>{" "}
        кожен клієнт має унікальний ідентифікатор у копійках (наприклад, 03).
        Клієнт платить рівно <span className="font-medium text-foreground">суму + ці копійки</span> — система знаходить платіж за «хвостиком» і автоматично зараховує потрібному клієнту.
      </>
    ),
  },
  {
    icon: CalendarPlus,
    href: "/dashboard/students",
    title: "Додавайте клієнтів і заняття",
    body: (
      <>
        У «Клієнти» додайте учнів і вкажіть ціну заняття.
        У «Розклад» створюйте слоти часу — поки слот не призначено клієнту, він відображається як{" "}
        <span className="font-medium text-foreground">вільний час</span> на публічній сторінці розкладу.
        Після призначення клієнту слот стає заняттям і зникає з публічного вигляду.
      </>
    ),
  },
];

export default function GuidePage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          На головну
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-3 flex items-center gap-2">
          <span>🚀</span> Як розпочати роботу
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Чотири кроки, щоб налаштувати автоматичні оплати та нагадування.
        </p>
      </div>

      <ol className="space-y-3">
        {STEPS.map(({ icon: Icon, href, title, body }, i) => (
          <li
            key={i}
            className="rounded-xl border border-border/60 bg-card shadow-sm p-5 flex gap-4"
          >
            <div className="relative shrink-0">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <span className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                {i + 1}
              </span>
            </div>
            <div className="min-w-0">
              <Link href={href} className="font-medium text-foreground hover:text-primary transition-colors">
                {title}
              </Link>
              <p className="text-muted-foreground mt-1 leading-relaxed text-sm">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
