import Link from "next/link";
import { ArrowLeft, Bot, Landmark, CreditCard, CalendarPlus, MessageCircle, Check } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SupportForm } from "./SupportForm";

export const metadata = {
  title: "Як розпочати роботу",
};

interface Step {
  icon: React.ElementType;
  href: string;
  title: React.ReactNode;
  body: React.ReactNode;
}

function telegramStepBody(connected: boolean, code: string): React.ReactNode {
  if (connected) {
    return (
      <>
        Ваш Telegram-бот{" "}
        <span className="font-medium text-emerald-700 inline-flex items-center gap-0.5">
          (<Check className="h-3.5 w-3.5" /> бот вже підключено)
        </span>
        . Ви отримуєте сповіщення про оплати та нагадування про заняття.
        Клієнти підключаються так само — кожен отримує свій особистий код на сторінці «Клієнти».
      </>
    );
  }
  return (
    <>
      Натисніть кнопку — ваш персональний код підставиться автоматично. Після підключення
      ви отримуватимете сповіщення про оплати та нагадування про заняття.
      <a
        href={`https://t.me/EasySchBot?start=${code}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors no-underline"
      >
        <MessageCircle className="h-4 w-4" />
        Підключити Telegram
      </a>
      <span className="mt-2 block">
        Клієнти підключаються так само — кожен отримує свій особистий код на сторінці «Клієнти».
      </span>
    </>
  );
}

function buildSteps(connected: boolean, code: string): Step[] {
  return [
    {
      icon: Bot,
      href: "/dashboard/settings",
      title: "Підключіть Telegram-бот",
      body: telegramStepBody(connected, code),
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
    {
      icon: Landmark,
      href: "/dashboard/settings",
      title: (
        <>
          Підключіть Monobank{" "}
          <span className="ml-1 inline-block align-middle rounded-full bg-amber-100 text-amber-700 text-[11px] font-medium px-2 py-0.5">
            необов&apos;язково
          </span>
        </>
      ),
      body: (
        <>
          Стежити за балансами можна й вручну — оплату відмічаєте кнопкою на сторінці «Оплати».
          Але <span className="font-medium text-foreground">набагато зручніше підключити Monobank</span>:
          тоді система сама бачить вхідні платежі й автоматично зараховує їх потрібному клієнту, без ручної роботи.{" "}
          У «Налаштування» → «Банківські рахунки» додайте токен Monobank. Отримати його можна на{" "}
          <Link href="https://api.monobank.ua/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">api.monobank.ua</Link>{" "}
          — натисніть «Отримати токен» і підтвердьте у застосунку Monobank.
          Далі система автоматично перевіряє вхідні платежі кожні 5 хвилин.{" "}
          <span className="font-medium text-emerald-700">🔒 Доступ лише на перегляд:</span>{" "}
          персональний токен Monobank лише <span className="font-medium text-foreground">читає виписку</span> — ним <span className="font-medium text-foreground">неможливо</span> переказати чи зняти кошти або керувати рахунком.{" "}
          <span className="font-medium text-foreground">Як розпізнається платіж:</span>{" "}
          кожен клієнт має унікальний ідентифікатор у копійках (наприклад, 03).
          Клієнт платить рівно <span className="font-medium text-foreground">суму + ці копійки</span> — система знаходить платіж за «хвостиком» і автоматично зараховує потрібному клієнту.
        </>
      ),
    },
  ];
}

export default async function GuidePage() {
  const session = await auth();
  const teacher = session
    ? await prisma.teacher.findUnique({
        where: { id: session.user.id },
        select: { telegramChatId: true, code: true },
      })
    : null;

  const connected = !!teacher?.telegramChatId;
  const code = teacher?.code ?? "";
  const STEPS = buildSteps(connected, code);

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
          Кілька кроків, щоб почати — і за бажанням налаштувати автоматичні оплати.
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

      <SupportForm />
    </div>
  );
}
