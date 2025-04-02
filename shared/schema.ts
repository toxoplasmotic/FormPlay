import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  partner_id: integer("partner_id").references(() => users.id),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
  partner_id: true,
});

// TPS Report schema
export const tpsReports = pgTable("tps_reports", {
  id: serial("id").primaryKey(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  creator_id: integer("creator_id").notNull().references(() => users.id),
  receiver_id: integer("receiver_id").notNull().references(() => users.id),
  status: text("status").notNull(), // draft, pending, approved, denied, aborted, completed
  date: text("date").notNull(),
  time_start: text("time_start").notNull(),
  time_end: text("time_end").notNull(),
  location: text("location").notNull(),
  location_other: text("location_other"),
  sound: text("sound").notNull(),
  form_data: jsonb("form_data").notNull(), // Stores all form field data
  creator_notes: text("creator_notes"),
  receiver_notes: text("receiver_notes"),
  creator_initials: text("creator_initials"),
  receiver_initials: text("receiver_initials"),
  replicated_from_id: integer("replicated_from_id").references(() => tpsReports.id),
  pdf_path: text("pdf_path"), // Stores path to saved PDF file
});

export const insertTpsReportSchema = createInsertSchema(tpsReports).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// TPS report logs to track interactions
export const tpsLogs = pgTable("tps_logs", {
  id: serial("id").primaryKey(),
  tps_id: integer("tps_id").notNull().references(() => tpsReports.id),
  user_id: integer("user_id").notNull().references(() => users.id),
  action: text("action").notNull(), // created, viewed, updated, approved, denied, aborted, replicated
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  details: jsonb("details"), // Additional details about the action
});

export const insertTpsLogSchema = createInsertSchema(tpsLogs).omit({
  id: true,
  timestamp: true,
});

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type TpsReport = typeof tpsReports.$inferSelect;
export type InsertTpsReport = z.infer<typeof insertTpsReportSchema>;

export type TpsLog = typeof tpsLogs.$inferSelect;
export type InsertTpsLog = z.infer<typeof insertTpsLogSchema>;

// Form Data Types - Using a more generic approach for flexibility with different PDF forms
export interface PdfFormField {
  name: string;
  type: string;
  value: string | boolean | string[];
}

export interface TpsFormData {
  // Generic key-value store for form fields
  fields: Record<string, any>;
  // Separate metadata for display/processing needs that's not in the PDF
  metadata?: {
    matt_notes?: string;
    mina_notes?: string;
    location_display?: string;
    [key: string]: any;
  };
}

// Status types
export enum TpsStatus {
  DRAFT = "draft",
  PENDING_REVIEW = "pending_review",
  PENDING_APPROVAL = "pending_approval",
  COMPLETED = "completed",
  ABORTED = "aborted"
}
