import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { SubscriptionBanner } from "@/components/layout/SubscriptionBanner";
import { FirstVisitGuide } from "@/components/layout/FirstVisitGuide";
import { GuideButton } from "@/components/layout/GuideButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const teacher = await prisma.teacher.findUnique({
    where: { id: session.user.id },
    select: { subscriptionExpiresAt: true },
  });

  const now = new Date();
  const expiresAt = teacher?.subscriptionExpiresAt ?? null;
  const isExpired = expiresAt ? expiresAt <= now : true;
  const daysLeft = expiresAt
    ? Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000)
    : null;

  // Hard block if expired
  if (isExpired) redirect("/subscription-expired");

  return (
    <div className="flex h-screen overflow-hidden">
      <FirstVisitGuide />
      <GuideButton />
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto">
        {daysLeft !== null && daysLeft <= 7 && (
          <SubscriptionBanner daysLeft={daysLeft} />
        )}
        <div className="mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-8 pb-20 md:pb-8">
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
