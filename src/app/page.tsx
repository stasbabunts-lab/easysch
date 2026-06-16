import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { APP_NAME } from "@/lib/labels";
import { Logo } from "@/components/ui/Logo";
import {
  CalendarDays, Bell, CreditCard, Users, MessageCircle,
  ArrowRight, Check, Smartphone, Clock, BarChart3,
} from "lucide-react";

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");
  // Not logged in — show landing page below

  // Pricing shown on the landing — pulled from settings so it stays in sync.
  const [priceRow, periodRow] = await Promise.all([
    prisma.appSettings.findUnique({ where: { key: "subscription_price_kopecks" } }),
    prisma.appSettings.findUnique({ where: { key: "subscription_period_days" } }),
  ]);
  const priceUah = Math.round(parseInt(priceRow?.value ?? "15000", 10) / 100) || 150;
  const periodDays = parseInt(periodRow?.value ?? "30", 10) || 30;
  const periodLabel = periodDays === 30 ? "міс" : `${periodDays} дн`;

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-bold text-[15px] tracking-tight">{APP_NAME}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Увійти
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Почати безкоштовно
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-5 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          14 днів безкоштовно — без картки
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
          Розклад і оплати<br className="hidden sm:block" />
          <span className="text-primary"> без зайвих клопотів</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Для репетиторів, тренерів, коучів та всіх, хто працює на себе.
          Клієнт переказує гроші — а система сама бачить, від кого оплата.
          Розклад і нагадування — у Telegram.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-medium px-6 py-3 rounded-xl text-base hover:bg-primary/90 transition-colors w-full sm:w-auto justify-center"
          >
            Спробувати безкоштовно
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 border border-border text-foreground font-medium px-6 py-3 rounded-xl text-base hover:bg-muted/50 transition-colors w-full sm:w-auto justify-center"
          >
            Вже є акаунт
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Вхід через Google в один клік. Жодної прив&apos;язки картки.
        </p>
      </section>

      {/* ── Features grid ── */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            Все що потрібно — і нічого зайвого
          </h2>
          <p className="text-muted-foreground">
            Зроблено для тих, хто цінує час і хоче витрачати його на роботу, а не на адміністрування
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: CalendarDays,
              color: "text-blue-600",
              bg: "bg-blue-50",
              title: "Розклад під контролем",
              desc: "Створюйте разові та щотижневі заняття. Клієнт бачить ваш вільний час за особистим посиланням — без реєстрації.",
            },
            {
              icon: MessageCircle,
              color: "text-[#2AABEE]",
              bg: "bg-sky-50",
              title: "Повідомлення в Telegram",
              desc: "Ви та ваші клієнти отримують нагадування про заняття прямо в Telegram. Нічого не пропустять — навіть без додатку.",
            },
            {
              icon: CreditCard,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
              title: "Оплати без плутанини",
              desc: "Клієнт просто переказує гроші — система сама розуміє від кого прийшло. Жодних коментарів, дзвінків і ручних позначок.",
            },
            {
              icon: Smartphone,
              color: "text-violet-600",
              bg: "bg-violet-50",
              title: "Особиста сторінка розкладу",
              desc: "Дайте клієнту посилання вигляду easy-sch.com/ваш-код — він одразу бачить коли ви вільні. Жодної реєстрації з його боку.",
            },
            {
              icon: Bell,
              color: "text-amber-600",
              bg: "bg-amber-50",
              title: "Нагадування про оплату",
              desc: "Після заняття клієнт автоматично отримує реквізити в Telegram. Делікатно і без незручних розмов.",
            },
            {
              icon: BarChart3,
              color: "text-rose-600",
              bg: "bg-rose-50",
              title: "Баланс по кожному клієнту",
              desc: "Ви завжди бачите хто заплатив, хто винен і на скільки занять. Один екран — повна картина.",
            },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-border/50 bg-card p-6 space-y-3 hover:shadow-sm transition-shadow"
            >
              <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <h3 className="font-semibold text-[15px]">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Who it's for ── */}
      <section className="bg-muted/30 border-y border-border/50 py-16">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
              Кому підходить {APP_NAME}
            </h2>
            <p className="text-muted-foreground">Якщо ви працюєте один на один з клієнтами — це для вас</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[
              "Репетитори",
              "Викладачі мов",
              "Персональні тренери",
              "Психологи",
              "Коучі",
              "Логопеди",
              "Викладачі музики",
              "Всі, хто веде запис",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 bg-background rounded-xl border border-border/50 px-4 py-3 text-sm font-medium"
              >
                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            Як це працює
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              step: "1",
              icon: Users,
              title: "Додайте клієнта",
              desc: "Створіть профіль клієнта. Надішліть йому особистий код — він прив'яже його в Telegram-боті.",
            },
            {
              step: "2",
              icon: CalendarDays,
              title: "Складіть розклад",
              desc: "Додайте заняття разово або щотижнево. Клієнт бачить вільні слоти за вашим посиланням.",
            },
            {
              step: "3",
              icon: CreditCard,
              title: "Оплата надходить сама",
              desc: "Коли клієнт переказує гроші, система автоматично зараховує оплату і повідомляє вас обох.",
            },
          ].map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="relative text-center space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center relative">
                  <Icon className="h-6 w-6 text-primary" />
                  <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
                    {step}
                  </span>
                </div>
                <h3 className="font-semibold">{title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Payment matching highlight (the differentiator) ── */}
      <section className="max-w-5xl mx-auto px-5 pb-8">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-primary/5 border border-emerald-500/20 p-8 sm:p-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="h-14 w-14 rounded-2xl bg-emerald-600 flex items-center justify-center shrink-0">
              <CreditCard className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">Оплати розпізнаються самі</h3>
              <p className="text-muted-foreground leading-relaxed">
                Клієнт робить звичайний переказ на вашу банківську картку — без платіжних
                систем і комісій, гроші одразу у вас. А система сама розуміє, від кого
                прийшла оплата, і зараховує її: жодних коментарів до переказу й звіряння вручну.
              </p>
            </div>
          </div>
          <div className="mt-6 grid sm:grid-cols-3 gap-3">
            {[
              { icon: Check, text: "Розпізнає платника автоматично" },
              { icon: CreditCard, text: "Напряму на вашу картку, без комісій" },
              { icon: Bell, text: "Ви і клієнт бачите підтвердження" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5 bg-white/60 rounded-xl px-4 py-3 text-sm font-medium border border-emerald-500/10">
                <Icon className="h-4 w-4 text-emerald-600 shrink-0" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Telegram highlight ── */}
      <section className="max-w-5xl mx-auto px-5 pb-16">
        <div className="rounded-2xl bg-gradient-to-br from-[#2AABEE]/10 to-primary/5 border border-[#2AABEE]/20 p-8 sm:p-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="h-14 w-14 rounded-2xl bg-[#2AABEE] flex items-center justify-center shrink-0">
              <MessageCircle className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">Telegram — замість окремого додатку</h3>
              <p className="text-muted-foreground leading-relaxed">
                Нагадування про заняття й оплати приходять вам і клієнтам прямо в Telegram —
                автоматично, без окремого додатку.
              </p>
            </div>
          </div>
          <div className="mt-6 grid sm:grid-cols-3 gap-3">
            {[
              { icon: Clock, text: "Нагадування за годину до заняття" },
              { icon: CreditCard, text: "Реквізити після кожного заняття" },
              { icon: Check, text: "Підтвердження коли оплата отримана" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5 bg-white/60 rounded-xl px-4 py-3 text-sm font-medium border border-[#2AABEE]/10">
                <Icon className="h-4 w-4 text-[#2AABEE] shrink-0" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="max-w-2xl mx-auto px-5 py-16">
        <div className="max-w-sm mx-auto rounded-2xl border border-border/60 bg-card p-8 shadow-sm text-center">
          <span className="inline-block text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full mb-5">
            14 днів безкоштовно
          </span>
          <div className="flex items-end justify-center gap-1.5">
            <span className="text-5xl font-bold tracking-tight">{priceUah}</span>
            <span className="text-lg font-medium text-muted-foreground mb-1.5">грн / {periodLabel}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
            Усі функції без обмежень. На старті без прив&apos;язки картки, без прихованих платежів.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary text-primary-foreground font-medium px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors"
          >
            Спробувати безкоштовно
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-sidebar py-20">
        <div className="max-w-2xl mx-auto px-5 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Почніть безкоштовно прямо зараз
          </h2>
          <p className="text-white/60 mb-8 leading-relaxed">
            14 днів без обмежень. Жодної прив&apos;язки картки.<br />
            Після пробного періоду — зв&apos;яжіться з нами для продовження.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-8 py-3.5 rounded-xl text-base hover:bg-primary/90 transition-colors"
          >
            Зареєструватися
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-white/30 text-xs mt-4">Реєстрація в один клік через Google</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50 py-6">
        <div className="max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Logo size={20} />
            <span className="font-medium">{APP_NAME}</span>
          </div>
          <p>© 2025 {APP_NAME}. Для тих, хто працює на себе.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Конфіденційність</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Умови</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Увійти</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
