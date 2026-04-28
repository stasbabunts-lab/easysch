-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "telegramId" TEXT,
    "telegramHandle" TEXT,
    "lessonPrice" INTEGER NOT NULL,
    "paymentOffset" INTEGER NOT NULL,
    "balanceAdjustmentKopecks" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Student_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("code", "createdAt", "id", "lessonPrice", "name", "notes", "paymentOffset", "teacherId", "telegramHandle", "telegramId") SELECT "code", "createdAt", "id", "lessonPrice", "name", "notes", "paymentOffset", "teacherId", "telegramHandle", "telegramId" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE UNIQUE INDEX "Student_code_key" ON "Student"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
