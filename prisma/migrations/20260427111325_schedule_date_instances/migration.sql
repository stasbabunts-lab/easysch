/*
  Warnings:

  - You are about to drop the column `dayOfWeek` on the `AvailabilitySlot` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `AvailabilitySlot` table. All the data in the column will be lost.
  - Made the column `date` on table `AvailabilitySlot` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AvailabilitySlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringGroupId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "studentId" TEXT,
    CONSTRAINT "AvailabilitySlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AvailabilitySlot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AvailabilitySlot" ("date", "durationMin", "endTime", "id", "isActive", "startTime", "studentId", "teacherId") SELECT "date", "durationMin", "endTime", "id", "isActive", "startTime", "studentId", "teacherId" FROM "AvailabilitySlot";
DROP TABLE "AvailabilitySlot";
ALTER TABLE "new_AvailabilitySlot" RENAME TO "AvailabilitySlot";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
