import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ScheduleManager } from "@/components/schedule/ScheduleManager";

export default async function SchedulePage() {
  const session = await auth();
  if (!session) return null;

  const students = await prisma.student.findMany({
    where: { teacherId: session.user.id },
    select: { id: true, name: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Розклад</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Керуйте заняттями. Клієнти бачать розклад за вашим кодом.
        </p>
      </div>
      <ScheduleManager students={students} />
    </div>
  );
}
