import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { APP_NAME } from "@/lib/labels";

export default async function SubscriptionExpiredPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // If sub is actually active now (just renewed), redirect back
  const teacher = await prisma.teacher.findUnique({
    where: { id: session.user.id },
    select: { subscriptionExpiresAt: true, name: true, email: true },
  });
  if (teacher?.subscriptionExpiresAt && teacher.subscriptionExpiresAt > new Date()) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="max-w-md w-full border-border/50 shadow-lg">
        <CardContent className="py-10 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold">Підписка закінчилась</h1>
            <p className="text-muted-foreground text-sm mt-2">
              Доступ до {APP_NAME} призупинено. Ваші дані збережено.
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-left space-y-1">
            <p className="text-muted-foreground">Акаунт:</p>
            <p className="font-medium">{teacher?.name}</p>
            <p className="text-muted-foreground text-xs">{teacher?.email}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Для продовження підписки зверніться до адміністратора.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
