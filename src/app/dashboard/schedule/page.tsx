import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ScheduleManager } from "@/components/schedule/ScheduleManager";
import { GuideButton } from "@/components/layout/GuideButton";
import { resolveLessonNoun, adj, thisNoun } from "@/lib/lesson-noun";

export default async function SchedulePage() {
  const session = await auth();
  if (!session) return null;

  const students = await prisma.student.findMany({
    where: { teacherId: session.user.id, isArchived: false },
    select: { id: true, name: true, createdAt: true },
  });

  const teacher = await prisma.teacher.findUnique({
    where: { id: session.user.id },
    select: { weekStartsMonday: true, showStudentPhone: true, lessonNoun: true },
  });
  const noun = resolveLessonNoun(teacher?.lessonNoun);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Розклад</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Керуйте розкладом. Клієнти бачать його за вашим кодом.
          </p>
        </div>
        <GuideButton />
      </div>
      <ScheduleManager
        students={students}
        weekStartsMonday={teacher?.weekStartsMonday ?? false}
        showStudentPhone={teacher?.showStudentPhone ?? false}
        noun={{
          nom: noun.nom,
          gen: noun.gen,
          acc: noun.acc,
          plural: noun.plural,
          genPl: noun.genPl,
          weeklyNom: adj("weekly", noun),
          weeklyInstr: adj("weekly", noun, "instr"),
          oneTimeNom: adj("oneTime", noun),
          oneTimeInstr: adj("oneTime", noun, "instr"),
          thisAcc: thisNoun(noun, "acc"),
          thisGen: thisNoun(noun, "gen"),
        }}
      />
    </div>
  );
}
