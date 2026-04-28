import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function nextWeekday(dow: number): Date {
  const d = new Date();
  const diff = ((dow - d.getDay()) + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const teacher = await prisma.teacher.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      passwordHash,
      name: "Анна Смирнова",
      code: "DEMO01",
      teacherReminderMinutes: "60,1440",
      studentReminderMinutes: "60",
    },
  });

  const students = await Promise.all([
    prisma.student.upsert({
      where: { id: "seed-student-1" },
      update: {},
      create: {
        id: "seed-student-1",
        teacherId: teacher.id,
        name: "Іван Петров",
        code: "IVAN01",
        lessonPrice: 150000,
        paymentOffset: 1,
        notes: "Підготовка до IELTS",
      },
    }),
    prisma.student.upsert({
      where: { id: "seed-student-2" },
      update: {},
      create: {
        id: "seed-student-2",
        teacherId: teacher.id,
        name: "Марія Козлова",
        code: "MARIA2",
        lessonPrice: 120000,
        paymentOffset: 2,
        notes: "Розмовний клуб",
      },
    }),
  ]);

  await prisma.availabilitySlot.deleteMany({ where: { teacherId: teacher.id } });

  const groupA = "group-mon-1000";
  const groupB = "group-wed-1000";
  const groupC = "group-fri-1200";

  const monStart = nextWeekday(1);
  const wedStart = nextWeekday(3);
  const friStart = nextWeekday(5);

  const slotRows: {
    teacherId: string; date: string; startTime: string; endTime: string;
    durationMin: number; isRecurring: boolean; recurringGroupId: string | null; studentId: string | null;
  }[] = [];

  for (let i = 0; i < 8; i++) {
    const mon = new Date(monStart); mon.setDate(monStart.getDate() + i * 7);
    const wed = new Date(wedStart); wed.setDate(wedStart.getDate() + i * 7);
    const fri = new Date(friStart); fri.setDate(friStart.getDate() + i * 7);

    slotRows.push({
      teacherId: teacher.id, date: isoDate(mon), startTime: "10:00", endTime: "11:00",
      durationMin: 60, isRecurring: true, recurringGroupId: groupA,
      studentId: students[0].id,
    });
    slotRows.push({
      teacherId: teacher.id, date: isoDate(wed), startTime: "10:00", endTime: "11:00",
      durationMin: 60, isRecurring: true, recurringGroupId: groupB,
      studentId: students[1].id,
    });
    slotRows.push({
      teacherId: teacher.id, date: isoDate(fri), startTime: "12:00", endTime: "13:00",
      durationMin: 60, isRecurring: true, recurringGroupId: groupC,
      studentId: null,
    });
  }

  const thu = nextWeekday(4);
  slotRows.push({
    teacherId: teacher.id, date: isoDate(thu), startTime: "15:00", endTime: "16:00",
    durationMin: 60, isRecurring: false, recurringGroupId: null,
    studentId: students[0].id,
  });

  await prisma.availabilitySlot.createMany({ data: slotRows });

  console.log("✅ Seed complete");
  console.log("   Login: demo@example.com / password123");
  console.log("   Teacher code: DEMO01");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
