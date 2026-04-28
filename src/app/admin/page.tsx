import { isAdminAuthenticated } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default async function AdminPage() {
  const ok = await isAdminAuthenticated();
  if (!ok) redirect("/admin/login");

  const teachers = await prisma.teacher.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      code: true,
      createdAt: true,
      subscriptionExpiresAt: true,
      telegramChatId: true,
      _count: { select: { students: true, lessons: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return <AdminDashboard teachers={teachers} />;
}
