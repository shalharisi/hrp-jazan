import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pregnanciesTable = pgTable("pregnancies", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  visitDate: text("visit_date").notNull(),
  lmpDate: text("lmp_date"),
  gestationalAge: integer("gestational_age"),
  riskLevel: text("risk_level").notNull(), // low, medium, high, critical
  riskFactors: text("risk_factors").array().notNull().default([]),
  isVteHighRisk: boolean("is_vte_high_risk").notNull().default(false),
  enoxaparinPrescribed: boolean("enoxaparin_prescribed").notNull().default(false),
  doctorName: text("doctor_name"),
  referralRecommendation: text("referral_recommendation").notNull(), // follow_at_center, follow_at_hospital, transfer_kfch
  referredHospitalId: integer("referred_hospital_id"),
  appointmentDate: text("appointment_date"),
  compliance: text("compliance").notNull().default("pending"), // compliant, non_compliant, pending
  workingDaysToAppointment: integer("working_days_to_appointment"),
  notes: text("notes"),
  coordinatorClassification: text("coordinator_classification"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPregnancySchema = createInsertSchema(pregnanciesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPregnancy = z.infer<typeof insertPregnancySchema>;
export type Pregnancy = typeof pregnanciesTable.$inferSelect;
