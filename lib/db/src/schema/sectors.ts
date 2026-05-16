import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sectorsTable = pgTable("sectors", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  hospitalId: integer("hospital_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSectorSchema = createInsertSchema(sectorsTable).omit({ id: true, createdAt: true });
export type InsertSector = z.infer<typeof insertSectorSchema>;
export type Sector = typeof sectorsTable.$inferSelect;
