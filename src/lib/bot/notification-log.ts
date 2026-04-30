import { prisma } from "@/lib/prisma";

export type NotifType =
  | "lesson_reminder"
  | "payment_reminder"
  | "payment_confirmed"
  | "payment_request";

export async function logNotification(params: {
  teacherId: string;
  studentId?: string;
  studentName: string;
  type: NotifType;
  text: string;
}) {
  try {
    await prisma.notificationLog.create({ data: params });
  } catch {
    // Non-critical — don't let logging failures block the main flow
  }
}
