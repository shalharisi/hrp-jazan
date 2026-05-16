import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hospitalsTable = pgTable("hospitals", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  isKfch: boolean("is_kfch").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHospitalSchema = createInsertSchema(hospitalsTable).omit({ id: true, createdAt: true });
export type InsertHospital = z.infer<typeof insertHospitalSchema>;
export type Hospital = typeof hospitalsTable.$inferSelect;
