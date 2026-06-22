import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Email registration is disabled — use Google sign-in
export async function POST() {
  return NextResponse.json({ error: "Registration via email is disabled" }, { status: 403 });
}

// PATCH: update teacher settings
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { teacherReminderMinutes, studentReminderMinutes, name, displayName, paymentDetails, postLessonNote, lessonNoun, telegramUsername, phone, paymentMinAmount, paymentMaxAmount, alias, weekStartsMonday, showStudentPhone } = body;

  const data: Record<string, string | number | boolean | null> = {};

  if (teacherReminderMinutes !== undefined) {
    const parsed = String(teacherReminderMinutes)
      .split(",")
      .map((v) => parseInt(v.trim(), 10))
      .filter((v) => !isNaN(v) && v > 0);
    data.teacherReminderMinutes = parsed.join(",") || "60";
  }
  if (studentReminderMinutes !== undefined) {
    const parsed = String(studentReminderMinutes)
      .split(",")
      .map((v) => parseInt(v.trim(), 10))
      .filter((v) => !isNaN(v) && v > 0);
    data.studentReminderMinutes = parsed.join(",") || "60";
  }
  if (name !== undefined) data.name = name;
  if (displayName !== undefined) data.displayName = displayName?.trim() || null;
  if (paymentDetails !== undefined) data.paymentDetails = paymentDetails?.trim() || null;
  if (postLessonNote !== undefined) data.postLessonNote = postLessonNote?.trim() || null;
  if (lessonNoun !== undefined) data.lessonNoun = lessonNoun?.trim() || "заняття";
  if (telegramUsername !== undefined) data.telegramUsername = telegramUsername?.replace(/^@/, "").trim() || null;
  if (phone !== undefined) data.phone = phone?.trim() || null;
  if (paymentMinAmount !== undefined) data.paymentMinAmount = paymentMinAmount === null || paymentMinAmount === "" ? null : Math.round(Number(paymentMinAmount) * 100);
  if (paymentMaxAmount !== undefined) data.paymentMaxAmount = paymentMaxAmount === null || paymentMaxAmount === "" ? null : Math.round(Number(paymentMaxAmount) * 100);
  if (alias !== undefined) {
    const cleaned = alias?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || null;
    if (cleaned && cleaned.length < 3) {
      return NextResponse.json({ error: "Аліас має бути не менше 3 символів" }, { status: 400 });
    }
    if (cleaned) {
      const existing = await prisma.teacher.findFirst({ where: { alias: cleaned, NOT: { id: session.user.id } } });
      if (existing) return NextResponse.json({ error: "Цей аліас вже зайнятий" }, { status: 409 });
    }
    data.alias = cleaned;
  }
  if (weekStartsMonday !== undefined) data.weekStartsMonday = Boolean(weekStartsMonday);
  if (showStudentPhone !== undefined) data.showStudentPhone = Boolean(showStudentPhone);

  const updated = await prisma.teacher.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      name: true,
      displayName: true,
      alias: true,
      teacherReminderMinutes: true,
      studentReminderMinutes: true,
      telegramChatId: true,
      telegramUsername: true,
      phone: true,
      paymentDetails: true,
      postLessonNote: true,
      lessonNoun: true,
      paymentMinAmount: true,
      paymentMaxAmount: true,
      weekStartsMonday: true,
      showStudentPhone: true,
    },
  });

  return NextResponse.json(updated);
}

// GET: current teacher settings (never returns raw bankCreds)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teacher = await prisma.teacher.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      code: true,
      alias: true,
      teacherReminderMinutes: true,
      studentReminderMinutes: true,
      telegramChatId: true,
      telegramUsername: true,
      phone: true,
      paymentDetails: true,
      postLessonNote: true,
      lessonNoun: true,
      paymentMinAmount: true,
      paymentMaxAmount: true,
      weekStartsMonday: true,
      showStudentPhone: true,
    },
  });

  if (!teacher) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(teacher);
}
