import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const seedUsers = [
  {
    username: "admin",
    password: "admin123",
    role: "admin" as const,
    nameAr: "مدير النظام",
    nameEn: "System Administrator",
  },
  {
    username: "coordinator",
    password: "coord123",
    role: "coordinator" as const,
    nameAr: "منسق الحمل عالي الخطورة",
    nameEn: "HRP Coordinator",
  },
  {
    username: "doctor",
    password: "doc123",
    role: "doctor" as const,
    nameAr: "طبيب النساء والولادة",
    nameEn: "OB/GYN Physician",
  },
  {
    username: "viewer",
    password: "view123",
    role: "viewer" as const,
    nameAr: "مستخدم للعرض",
    nameEn: "Read-only User",
  },
];

async function main() {
  console.log("Seeding users...");

  for (const u of seedUsers) {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, u.username)).limit(1);
    if (existing) {
      console.log(`  ⟳  ${u.username} — already exists, skipping`);
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, 12);
    await db.insert(usersTable).values({
      username: u.username,
      passwordHash,
      role: u.role,
      nameAr: u.nameAr,
      nameEn: u.nameEn,
      isActive: true,
    });
    console.log(`  ✓  ${u.username} (${u.role}) — created`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
