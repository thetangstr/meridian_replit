import { pgTable, text, serial, integer, boolean, timestamp, foreignKey, json, varchar, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users and roles
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("reviewer"), // reviewer, internal, external, admin
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
});

// CUJ (Critical User Journey) Categories
export const cujCategories = pgTable("cuj_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").default("category"),
});

export const insertCujCategorySchema = createInsertSchema(cujCategories).pick({
  name: true,
  description: true,
  icon: true,
});

// CUJs
export const cujs = pgTable("cujs", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => cujCategories.id),
  name: text("name").notNull(),
  description: text("description"),
});

export const insertCujSchema = createInsertSchema(cujs).pick({
  categoryId: true,
  name: true,
  description: true,
});

// Tasks
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  cujId: integer("cuj_id").notNull().references(() => cujs.id),
  name: text("name").notNull(),
  prerequisites: text("prerequisites"),
  expectedOutcome: text("expected_outcome").notNull(),
});

export const insertTaskSchema = createInsertSchema(tasks).pick({
  cujId: true,
  name: true,
  prerequisites: true,
  expectedOutcome: true,
});

// Cars
export const cars = pgTable("cars", {
  id: serial("id").primaryKey(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year").notNull(),
  androidVersion: text("android_version").notNull(),
  buildFingerprint: text("build_fingerprint").notNull(),
  location: text("location").notNull(),
  imageUrl: text("image_url"),
});

export const insertCarSchema = createInsertSchema(cars).pick({
  make: true,
  model: true,
  year: true,
  androidVersion: true,
  buildFingerprint: true,
  location: true,
  imageUrl: true,
});

// Reviews
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  carId: integer("car_id").notNull().references(() => cars.id),
  reviewerId: integer("reviewer_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"), // pending, in_progress, completed
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isPublished: boolean("is_published").default(false).notNull(), // Whether the review is locked and published
  lastModifiedById: integer("last_modified_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReviewSchema = createInsertSchema(reviews).pick({
  carId: true,
  reviewerId: true,
  status: true,
  startDate: true,
  endDate: true,
});

export const updateReviewSchema = createInsertSchema(reviews).pick({
  status: true,
  isPublished: true,
  lastModifiedById: true,
});

// Task Evaluations
export const taskEvaluations = pgTable("task_evaluations", {
  id: serial("id").primaryKey(),
  reviewId: integer("review_id").notNull().references(() => reviews.id),
  taskId: integer("task_id").notNull().references(() => tasks.id),
  doable: boolean("doable"),
  undoableReason: text("undoable_reason"),
  usabilityScore: integer("usability_score"), // 1-4
  usabilityFeedback: text("usability_feedback"),
  visualsScore: integer("visuals_score"), // 1-4
  visualsFeedback: text("visuals_feedback"),
  media: json("media").default([]), // Array of image/video URLs
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTaskEvaluationSchema = createInsertSchema(taskEvaluations).pick({
  reviewId: true,
  taskId: true,
  doable: true,
  undoableReason: true,
  usabilityScore: true,
  usabilityFeedback: true,
  visualsScore: true,
  visualsFeedback: true,
  media: true,
});

// Category Evaluations
export const categoryEvaluations = pgTable("category_evaluations", {
  id: serial("id").primaryKey(),
  reviewId: integer("review_id").notNull().references(() => reviews.id),
  categoryId: integer("category_id").notNull().references(() => cujCategories.id),
  responsivenessScore: integer("responsiveness_score"), // 1-4
  responsivenessFeedback: text("responsiveness_feedback"), // Feedback for low scores
  writingScore: integer("writing_score"), // 1-4
  writingFeedback: text("writing_feedback"), // Feedback for low scores
  emotionalScore: integer("emotional_score"), // 1-4 (bonus)
  emotionalFeedback: text("emotional_feedback"), // Feedback for low scores
  media: json("media").default([]), // Array of image/video URLs
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCategoryEvaluationSchema = createInsertSchema(categoryEvaluations).pick({
  reviewId: true,
  categoryId: true,
  responsivenessScore: true,
  responsivenessFeedback: true,
  writingScore: true,
  writingFeedback: true,
  emotionalScore: true,
  emotionalFeedback: true,
  media: true,
});

// Scoring Configuration
export const scoringConfig = pgTable("scoring_config", {
  id: serial("id").primaryKey(),
  // Task level weights
  taskDoableWeight: doublePrecision("task_doable_weight").notNull().default(43.75),
  taskUsabilityWeight: doublePrecision("task_usability_weight").notNull().default(37.5),
  taskVisualsWeight: doublePrecision("task_visuals_weight").notNull().default(18.75),
  // Category level weights
  categoryTasksWeight: doublePrecision("category_tasks_weight").notNull().default(80),
  categoryResponsivenessWeight: doublePrecision("category_responsiveness_weight").notNull().default(15),
  categoryWritingWeight: doublePrecision("category_writing_weight").notNull().default(5),
  categoryEmotionalWeight: doublePrecision("category_emotional_weight").notNull().default(5),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
});

export const insertScoringConfigSchema = createInsertSchema(scoringConfig).pick({
  taskDoableWeight: true,
  taskUsabilityWeight: true,
  taskVisualsWeight: true,
  categoryTasksWeight: true,
  categoryResponsivenessWeight: true,
  categoryWritingWeight: true,
  categoryEmotionalWeight: true,
  updatedBy: true,
});

// Report Metadata
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  reviewId: integer("review_id").notNull().references(() => reviews.id),
  overallScore: doublePrecision("overall_score"),
  topLikes: text("top_likes"),
  topHates: text("top_hates"),
  benchmarkRank: integer("benchmark_rank"),
  benchmarkComparison: text("benchmark_comparison"), // better, worse
  topIssues: json("top_issues").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReportSchema = createInsertSchema(reports).pick({
  reviewId: true,
  overallScore: true,
  topLikes: true,
  topHates: true,
  benchmarkRank: true,
  benchmarkComparison: true,
  topIssues: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type CujCategory = typeof cujCategories.$inferSelect;
export type InsertCujCategory = z.infer<typeof insertCujCategorySchema>;

export type Cuj = typeof cujs.$inferSelect;
export type InsertCuj = z.infer<typeof insertCujSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type Car = typeof cars.$inferSelect;
export type InsertCar = z.infer<typeof insertCarSchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type TaskEvaluation = typeof taskEvaluations.$inferSelect;
export type InsertTaskEvaluation = z.infer<typeof insertTaskEvaluationSchema>;

export type CategoryEvaluation = typeof categoryEvaluations.$inferSelect;
export type InsertCategoryEvaluation = z.infer<typeof insertCategoryEvaluationSchema>;

export type ScoringConfig = typeof scoringConfig.$inferSelect;
export type InsertScoringConfig = z.infer<typeof insertScoringConfigSchema>;

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

// Extended types for API responses
export type TaskWithCategory = Task & {
  cuj: Cuj & {
    category: CujCategory;
  };
};

export type ReviewWithDetails = Review & {
  car: Car;
  reviewer: User;
  lastModifiedBy?: User;
};

export type TaskEvaluationWithTask = TaskEvaluation & {
  task: TaskWithCategory;
};

export type CategoryEvaluationWithCategory = CategoryEvaluation & {
  category: CujCategory;
};

export type ReportWithReview = Report & {
  review: ReviewWithDetails;
  categoryScores: Array<{
    category: CujCategory;
    score: number;
    taskScore: number;
    responsivenessScore: number;
    writingScore: number;
    emotionalScore: number;
  }>;
};

export type MediaItem = {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  createdAt: string;
};

// Scoring Scale Descriptions
export const scoringScaleDescriptions = {
  usability: {
    1: { label: "Very difficult", description: "I frequently struggled to complete it." },
    2: { label: "Somewhat difficult", description: "I encountered some challenges and it wasn't always intuitive." },
    3: { label: "Generally easy", description: "I could usually complete it without much difficulty." },
    4: { label: "Very easy", description: "I could easily understand and operate it." }
  },
  visuals: {
    1: { label: "Very poor", description: "It was unattractive, confusing, or ineffective." },
    2: { label: "Somewhat poor", description: "It had some issues with aesthetics, clarity, or consistency." },
    3: { label: "Good", description: "It was reasonably attractive, clear, and consistent." },
    4: { label: "Excellent", description: "It was highly attractive, clear, and effective." }
  },
  responsiveness: {
    1: { label: "Very poor", description: "It felt slow, laggy, and unclear." },
    2: { label: "Somewhat poor", description: "There were noticeable delays, lag, or unclear feedback." },
    3: { label: "Good", description: "It felt reasonably responsive with clear feedback." },
    4: { label: "Excellent", description: "It felt very smooth, responsive, and provided clear, immediate feedback." }
  },
  writing: {
    1: { label: "Very poor", description: "It was confusing, inaccurate, inconsistent, or contained errors." },
    2: { label: "Somewhat poor", description: "It had some issues with clarity, consistency, conciseness, or accuracy." },
    3: { label: "Reasonably clear", description: "It was reasonably clear, consistent, concise, and accurate." },
    4: { label: "Excellent", description: "It was very clear, consistent, concise, and accurate." }
  },
  emotional: {
    1: { label: "Negative", description: "It felt frustrating, impersonal, or unpleasant." },
    2: { label: "Neutral", description: "It didn't evoke strong feelings, positive or negative." },
    3: { label: "Positive", description: "It felt enjoyable, satisfying, or engaging." },
    4: { label: "Strongly positive", description: "It felt delightful, exciting, or created a sense of connection." }
  }
};

// For filtering reviews by status
export const reviewStatuses = ["pending", "in_progress", "completed"] as const;
export type ReviewStatus = typeof reviewStatuses[number];

// User roles
export const userRoles = ["reviewer", "internal", "external", "admin"] as const;
export type UserRole = typeof userRoles[number];
