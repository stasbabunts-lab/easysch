import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateUniqueTeacherCode } from "@/lib/teacher-code";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
    }
    const exists = await prisma.teacher.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "Email уже зарегистрирован" }, { status: 409 });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const code = await generateUniqueTeacherCode();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    const teacher = await prisma.teacher.create({
      data: { name, email, passwordHash, code, subscriptionExpiresAt: trialEnd },
      select: { id: true, email: true, name: true, code: true },
    });
    return NextResponse.json(teacher, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// PATCH: update teacher settings
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { teacherReminderMinutes, studentReminderMinutes, name, paymentDetails, telegramUsername, phone } = body;

  const data: Record<string, string | null> = {};

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
  if (paymentDetails !== undefined) data.paymentDetails = paymentDetails?.trim() || null;
  if (telegramUsername !== undefined) data.telegramUsername = telegramUsername?.replace(/^@/, "").trim() || null;
  if (phone !== undefined) data.phone = phone?.trim() || null;

  const updated = await prisma.teacher.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      name: true,
      teacherReminderMinutes: true,
      studentReminderMinutes: true,
      telegramChatId: true,
      telegramUsername: true,
      phone: true,
      paymentDetails: true,
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
      email: true,
      code: true,
      teacherReminderMinutes: true,
      studentReminderMinutes: true,
      telegramChatId: true,
      telegramUsername: true,
      phone: true,
      paymentDetails: true,
    },
  });

  if (!teacher) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(teacher);
}
