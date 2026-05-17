import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const healthCentersTable = pgTable("health_centers", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  sectorId: integer("sector_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHealthCenterSchema = createInsertSchema(healthCentersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertHealthCenter = z.infer<typeof insertHealthCenterSchema>;
export type HealthCenter = typeof healthCentersTable.$inferSelect;
