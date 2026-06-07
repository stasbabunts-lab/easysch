import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, ChevronRight, ArrowLeft } from "lucide-react";

export default async function SubscribeMethodPage() {
  const settings = await prisma.appSettings.findMany({
    where: { key: { in: ["subscription_price_kopecks", "subscription_period_days"] } },
  });
  const map: Record<string, string> = {
    subscription_price_kopecks: "15000",
    subscription_period_days: "30",
  };
  for (const s of settings) map[s.key] = s.value;

  const priceUah = Math.round(parseInt(map.subscription_price_kopecks) / 100);
  const periodDays = parseInt(map.subscription_period_days);

  return (
    <div className="max-w-md mx-auto py-10 px-4 space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Назад
        </Link>
        <h1 className="text-2xl font-bold">Продовжити підписку</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {priceUah} грн / {periodDays} днів
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Спосіб оплати</p>
        <Link href="/subscribe/amount">
          <Card className="border-2 border-primary cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Переказ на карту</p>
                  <p className="text-xs text-muted-foreground">Банківський переказ</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <Link
        href="/subscribe/amount"
        className="block w-full text-center bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
      >
        Продовжити
      </Link>
    </div>
  );
}
