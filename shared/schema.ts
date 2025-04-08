import { pgTable, text, serial, integer, boolean, timestamp, foreignKey, json, varchar, doublePrecision } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
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

// CUJ Database Version
export const cujDatabaseVersions = pgTable("cuj_database_versions", {
  id: serial("id").primaryKey(),
  versionNumber: text("version_number").notNull().unique(),
  sourceType: text("source_type").notNull(), // 'spreadsheet', 'manual', etc.
  sourceFileName: text("source_file_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
});

export const insertCujDatabaseVersionSchema = createInsertSchema(cujDatabaseVersions).pick({
  versionNumber: true,
  sourceType: true,
  sourceFileName: true,
  createdBy: true,
  isActive: true,
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
  status: text("status").notNull().default("not_started"), // not_started, pending, in_progress, completed
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isPublished: boolean("is_published").default(false).notNull(), // Whether the review is locked and published
  createdBy: integer("created_by").references(() => users.id),
  lastModifiedBy: integer("last_modified_by").references(() => users.id),
  cujDatabaseVersionId: integer("cuj_database_version_id").references(() => cujDatabaseVersions.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastModifiedAt: timestamp("last_modified_at").defaultNow().notNull(),
});

export const insertReviewSchema = createInsertSchema(reviews)
  .pick({
    carId: true,
    reviewerId: true,
    status: true,
    startDate: true,
    endDate: true,
    cujDatabaseVersionId: true,
  })
  .transform((data) => ({
    ...data,
    startDate: new Date(data.startDate),
    endDate: new Date(data.endDate),
  }));

export const updateReviewSchema = createInsertSchema(reviews).pick({
  status: true,
  isPublished: true,
  lastModifiedBy: true,
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
export interface User {
  id: number;
  username: string;
  password: string;
  name: string;
  role: string;
}
export type InsertUser = z.infer<typeof insertUserSchema>;

export interface CujDatabaseVersion {
  id: number;
  versionNumber: string;
  sourceType: string;
  sourceFileName: string | null;
  createdAt: Date;
  createdBy: number | null;
  isActive: boolean;
}
export type InsertCujDatabaseVersion = z.infer<typeof insertCujDatabaseVersionSchema>;

export interface CujCategory {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
}
export type InsertCujCategory = z.infer<typeof insertCujCategorySchema>;

export interface Cuj {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
}
export type InsertCuj = z.infer<typeof insertCujSchema>;

export interface Task {
  id: number;
  cujId: number;
  name: string;
  prerequisites: string | null;
  expectedOutcome: string;
}
export type InsertTask = z.infer<typeof insertTaskSchema>;

export interface Car {
  id: number;
  make: string;
  model: string;
  year: number;
  androidVersion: string;
  buildFingerprint: string;
  location: string;
  imageUrl: string | null;
}
export type InsertCar = z.infer<typeof insertCarSchema>;

export interface Review {
  id: number;
  carId: number;
  reviewerId: number;
  status: string;
  startDate: Date;
  endDate: Date;
  isPublished: boolean;
  createdBy: number | null;
  lastModifiedBy: number | null;
  cujDatabaseVersionId: number | null;
  createdAt: Date;
  lastModifiedAt: Date;
}
export type InsertReview = z.infer<typeof insertReviewSchema>;

export interface TaskEvaluation {
  id: number;
  reviewId: number;
  taskId: number;
  doable: boolean | null;
  undoableReason: string | null;
  usabilityScore: number | null;
  usabilityFeedback: string | null;
  visualsScore: number | null;
  visualsFeedback: string | null;
  media: any[];
  createdAt: Date;
  updatedAt: Date;
}
export type InsertTaskEvaluation = z.infer<typeof insertTaskEvaluationSchema>;

export interface CategoryEvaluation {
  id: number;
  reviewId: number;
  categoryId: number;
  responsivenessScore: number | null;
  responsivenessFeedback: string | null;
  writingScore: number | null;
  writingFeedback: string | null;
  emotionalScore: number | null;
  emotionalFeedback: string | null;
  media: any[];
  createdAt: Date;
  updatedAt: Date;
}
export type InsertCategoryEvaluation = z.infer<typeof insertCategoryEvaluationSchema>;

export interface ScoringConfig {
  id: number;
  taskDoableWeight: number;
  taskUsabilityWeight: number;
  taskVisualsWeight: number;
  categoryTasksWeight: number;
  categoryResponsivenessWeight: number;
  categoryWritingWeight: number;
  categoryEmotionalWeight: number;
  updatedAt: Date;
  updatedBy: number | null;
}
export type InsertScoringConfig = z.infer<typeof insertScoringConfigSchema>;

export interface Report {
  id: number;
  reviewId: number;
  overallScore: number | null;
  topLikes: string | null;
  topHates: string | null;
  benchmarkRank: number | null;
  benchmarkComparison: string | null;
  topIssues: any[];
  createdAt: Date;
  updatedAt: Date;
}
export type InsertReport = z.infer<typeof insertReportSchema>;

// Extended types for API responses
export type TaskWithCategory = Task & {
  cuj: Cuj & {
    category: CujCategory;
  };
};

export type ReviewWithDetails = Omit<Review, 'lastModifiedBy' | 'cujDatabaseVersionId'> & {
  car: Car;
  reviewer: User;
  lastModifiedBy?: User;
  lastModifiedById?: number | null;
  cujDatabaseVersion?: CujDatabaseVersion;
  cujDatabaseVersionId?: number | null;
};

export type TaskEvaluationWithTask = TaskEvaluation & {
  task: TaskWithCategory;
};

export type CategoryEvaluationWithCategory = CategoryEvaluation & {
  category: CujCategory;
};

export type Issue = {
  category: string;
  description: string;
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
  topIssues: Issue[];
};

export type MediaItem = {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  createdAt: string;
};

// Reviewer Assignments
export const reviewerAssignments = pgTable("reviewer_assignments", {
  id: serial("id").primaryKey(),
  reviewerId: integer("reviewer_id").notNull().references(() => users.id),
  categoryId: integer("category_id").notNull().references(() => cujCategories.id),
  carId: integer("car_id").notNull().references(() => cars.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReviewerAssignmentSchema = createInsertSchema(reviewerAssignments).pick({
  reviewerId: true,
  categoryId: true,
  carId: true,
  createdBy: true,
});

export interface ReviewerAssignment {
  id: number;
  reviewerId: number;
  categoryId: number;
  carId: number;
  createdAt: Date;
  createdBy: number | null;
  updatedAt: Date;
}
export type InsertReviewerAssignment = z.infer<typeof insertReviewerAssignmentSchema>;

export type ReviewerAssignmentWithDetails = ReviewerAssignment & {
  reviewer: User;
  category: CujCategory;
  car: Car;
  createdByUser?: User;
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  reviews: many(reviews, { relationName: "user_reviews" }),
  modifiedReviews: many(reviews, { relationName: "user_modified_reviews" }),
  createdVersions: many(cujDatabaseVersions),
  reviewerAssignments: many(reviewerAssignments),
  createdAssignments: many(reviewerAssignments, { relationName: "created_assignments" }),
}));

export const cujDatabaseVersionsRelations = relations(cujDatabaseVersions, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [cujDatabaseVersions.createdBy],
    references: [users.id],
  }),
  reviews: many(reviews),
}));

export const cujCategoriesRelations = relations(cujCategories, ({ many }) => ({
  cujs: many(cujs),
  categoryEvaluations: many(categoryEvaluations),
  reviewerAssignments: many(reviewerAssignments),
}));

export const cujsRelations = relations(cujs, ({ one, many }) => ({
  category: one(cujCategories, {
    fields: [cujs.categoryId],
    references: [cujCategories.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  cuj: one(cujs, {
    fields: [tasks.cujId],
    references: [cujs.id],
  }),
  taskEvaluations: many(taskEvaluations),
}));

export const carsRelations = relations(cars, ({ many }) => ({
  reviews: many(reviews),
  reviewerAssignments: many(reviewerAssignments),
}));

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  car: one(cars, {
    fields: [reviews.carId],
    references: [cars.id],
  }),
  reviewer: one(users, {
    fields: [reviews.reviewerId],
    references: [users.id],
    relationName: "user_reviews",
  }),
  createdByUser: one(users, {
    fields: [reviews.createdBy],
    references: [users.id],
  }),
  lastModifiedByUser: one(users, {
    fields: [reviews.lastModifiedBy],
    references: [users.id],
    relationName: "user_modified_reviews",
  }),
  cujDatabaseVersion: one(cujDatabaseVersions, {
    fields: [reviews.cujDatabaseVersionId],
    references: [cujDatabaseVersions.id],
  }),
  taskEvaluations: many(taskEvaluations),
  categoryEvaluations: many(categoryEvaluations),
  reports: many(reports),
}));

export const taskEvaluationsRelations = relations(taskEvaluations, ({ one }) => ({
  review: one(reviews, {
    fields: [taskEvaluations.reviewId],
    references: [reviews.id],
  }),
  task: one(tasks, {
    fields: [taskEvaluations.taskId],
    references: [tasks.id],
  }),
}));

export const categoryEvaluationsRelations = relations(categoryEvaluations, ({ one }) => ({
  review: one(reviews, {
    fields: [categoryEvaluations.reviewId],
    references: [reviews.id],
  }),
  category: one(cujCategories, {
    fields: [categoryEvaluations.categoryId],
    references: [cujCategories.id],
  }),
}));

export const scoringConfigRelations = relations(scoringConfig, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [scoringConfig.updatedBy],
    references: [users.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  review: one(reviews, {
    fields: [reports.reviewId],
    references: [reviews.id],
  }),
}));

export const reviewerAssignmentsRelations = relations(reviewerAssignments, ({ one }) => ({
  reviewer: one(users, {
    fields: [reviewerAssignments.reviewerId],
    references: [users.id],
  }),
  category: one(cujCategories, {
    fields: [reviewerAssignments.categoryId],
    references: [cujCategories.id],
  }),
  car: one(cars, {
    fields: [reviewerAssignments.carId],
    references: [cars.id],
  }),
  createdByUser: one(users, {
    fields: [reviewerAssignments.createdBy],
    references: [users.id],
    relationName: "created_assignments",
  }),
}));
