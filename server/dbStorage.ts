import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../shared/db";
import * as schema from "../shared/schema";
import {
  User,
  InsertUser,
  CujCategory,
  InsertCujCategory,
  Cuj,
  InsertCuj,
  Task,
  InsertTask,
  Car,
  InsertCar,
  Review,
  InsertReview,
  TaskEvaluation,
  InsertTaskEvaluation,
  CategoryEvaluation,
  InsertCategoryEvaluation,
  ScoringConfig,
  InsertScoringConfig,
  Report,
  InsertReport,
  ReviewWithDetails,
  TaskWithCategory,
  ReportWithReview,
  CategoryEvaluationWithCategory,
  TaskEvaluationWithTask,
  MediaItem
} from "@shared/schema";
import { IStorage } from "./storage";
import { calculateTaskScore, calculateCategoryScore } from "../client/src/lib/utils";
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

export class DbStorage implements IStorage {
  private mediaDir: string;

  constructor() {
    this.mediaDir = path.join(process.cwd(), 'public', 'media');
    // Ensure media directory exists
    if (!fs.existsSync(this.mediaDir)) {
      fs.mkdirSync(this.mediaDir, { recursive: true });
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(schema.users).values(user).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(schema.users);
  }

  // CUJ Category operations
  async getCujCategory(id: number): Promise<CujCategory | undefined> {
    const result = await db.select().from(schema.cujCategories).where(eq(schema.cujCategories.id, id));
    return result[0];
  }

  async getAllCujCategories(): Promise<CujCategory[]> {
    return await db.select().from(schema.cujCategories);
  }

  async createCujCategory(category: InsertCujCategory): Promise<CujCategory> {
    const result = await db.insert(schema.cujCategories).values(category).returning();
    return result[0];
  }

  // CUJ operations
  async getCuj(id: number): Promise<Cuj | undefined> {
    const result = await db.select().from(schema.cujs).where(eq(schema.cujs.id, id));
    return result[0];
  }

  async getCujsForCategory(categoryId: number): Promise<Cuj[]> {
    return await db.select().from(schema.cujs).where(eq(schema.cujs.categoryId, categoryId));
  }

  async createCuj(cuj: InsertCuj): Promise<Cuj> {
    const result = await db.insert(schema.cujs).values(cuj).returning();
    return result[0];
  }

  // Task operations
  async getTask(id: number): Promise<Task | undefined> {
    const result = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id));
    return result[0];
  }

  async getTasksForCuj(cujId: number): Promise<Task[]> {
    return await db.select().from(schema.tasks).where(eq(schema.tasks.cujId, cujId));
  }

  async getTasksForReview(reviewId: number): Promise<TaskWithCategory[]> {
    // This is a more complex join query
    const result = await db.query.tasks.findMany({
      with: {
        cuj: {
          with: {
            category: true
          }
        }
      }
    });
    
    return result as TaskWithCategory[];
  }

  async createTask(task: InsertTask): Promise<Task> {
    const result = await db.insert(tasks).values(task).returning();
    return result[0];
  }

  // Car operations
  async getCar(id: number): Promise<Car | undefined> {
    const result = await db.select().from(cars).where(eq(cars.id, id));
    return result[0];
  }

  async getAllCars(): Promise<Car[]> {
    return await db.select().from(cars);
  }

  async createCar(car: InsertCar): Promise<Car> {
    const result = await db.insert(cars).values(car).returning();
    return result[0];
  }

  // Review operations
  async getReview(id: number): Promise<ReviewWithDetails | undefined> {
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, id),
      with: {
        car: true,
        reviewer: true
      }
    });
    
    if (!review) return undefined;
    
    return review as ReviewWithDetails;
  }

  async getAllReviews(): Promise<ReviewWithDetails[]> {
    const reviewResults = await db.query.reviews.findMany({
      with: {
        car: true,
        reviewer: true
      }
    });
    
    return reviewResults as ReviewWithDetails[];
  }

  async getReviewsByReviewer(reviewerId: number): Promise<ReviewWithDetails[]> {
    const reviewResults = await db.query.reviews.findMany({
      where: eq(reviews.reviewerId, reviewerId),
      with: {
        car: true,
        reviewer: true
      }
    });
    
    return reviewResults as ReviewWithDetails[];
  }

  async createReview(review: InsertReview): Promise<Review> {
    const result = await db.insert(reviews).values(review).returning();
    return result[0];
  }

  async updateReviewStatus(id: number, status: string): Promise<Review> {
    const result = await db
      .update(reviews)
      .set({ status, updatedAt: new Date() })
      .where(eq(reviews.id, id))
      .returning();
    
    return result[0];
  }
  
  async updateReview(id: number, lastModifiedById: number, data: { status?: string, isPublished?: boolean }): Promise<Review> {
    // First check if review exists and if it's published
    const reviewCheck = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id));
      
    if (reviewCheck.length === 0) {
      throw new Error('Review not found');
    }
    
    const review = reviewCheck[0];
    
    // Don't allow changes to published reviews unless it's being unpublished
    if (review.isPublished && data.isPublished !== false) {
      throw new Error('Cannot modify a published review');
    }
    
    const updateData: any = {
      ...data,
      lastModifiedById,
      updatedAt: new Date()
    };
    
    const result = await db
      .update(reviews)
      .set(updateData)
      .where(eq(reviews.id, id))
      .returning();
    
    return result[0];
  }

  // Task Evaluation operations
  async getTaskEvaluation(reviewId: number, taskId: number): Promise<TaskEvaluation | undefined> {
    const result = await db
      .select()
      .from(taskEvaluations)
      .where(
        and(
          eq(taskEvaluations.reviewId, reviewId),
          eq(taskEvaluations.taskId, taskId)
        )
      );
    
    return result[0];
  }

  async getTaskEvaluationsForReview(reviewId: number): Promise<TaskEvaluationWithTask[]> {
    const result = await db.query.taskEvaluations.findMany({
      where: eq(taskEvaluations.reviewId, reviewId),
      with: {
        task: {
          with: {
            cuj: {
              with: {
                category: true
              }
            }
          }
        }
      }
    });
    
    return result as TaskEvaluationWithTask[];
  }

  async createTaskEvaluation(evaluation: InsertTaskEvaluation): Promise<TaskEvaluation> {
    const result = await db.insert(taskEvaluations).values(evaluation).returning();
    return result[0];
  }

  async updateTaskEvaluation(reviewId: number, taskId: number, evaluation: InsertTaskEvaluation): Promise<TaskEvaluation> {
    const now = new Date();
    const result = await db
      .update(taskEvaluations)
      .set({ ...evaluation, updatedAt: now })
      .where(
        and(
          eq(taskEvaluations.reviewId, reviewId),
          eq(taskEvaluations.taskId, taskId)
        )
      )
      .returning();
    
    return result[0];
  }

  async getCompletedTaskIds(reviewId: number): Promise<number[]> {
    const result = await db
      .select({ taskId: taskEvaluations.taskId })
      .from(taskEvaluations)
      .where(eq(taskEvaluations.reviewId, reviewId));
    
    return result.map(r => r.taskId);
  }

  // Category Evaluation operations
  async getCategoryEvaluation(reviewId: number, categoryId: number): Promise<CategoryEvaluation | undefined> {
    const result = await db
      .select()
      .from(categoryEvaluations)
      .where(
        and(
          eq(categoryEvaluations.reviewId, reviewId),
          eq(categoryEvaluations.categoryId, categoryId)
        )
      );
    
    return result[0];
  }

  async getCategoryEvaluationsForReview(reviewId: number): Promise<CategoryEvaluationWithCategory[]> {
    const result = await db.query.categoryEvaluations.findMany({
      where: eq(categoryEvaluations.reviewId, reviewId),
      with: {
        category: true
      }
    });
    
    return result as CategoryEvaluationWithCategory[];
  }

  async createCategoryEvaluation(evaluation: InsertCategoryEvaluation): Promise<CategoryEvaluation> {
    const result = await db.insert(categoryEvaluations).values(evaluation).returning();
    return result[0];
  }

  async updateCategoryEvaluation(reviewId: number, categoryId: number, evaluation: InsertCategoryEvaluation): Promise<CategoryEvaluation> {
    const now = new Date();
    const result = await db
      .update(categoryEvaluations)
      .set({ ...evaluation, updatedAt: now })
      .where(
        and(
          eq(categoryEvaluations.reviewId, reviewId),
          eq(categoryEvaluations.categoryId, categoryId)
        )
      )
      .returning();
    
    return result[0];
  }

  // Scoring Config operations
  async getScoringConfig(): Promise<ScoringConfig> {
    const configs = await db.select().from(scoringConfig);
    if (configs.length === 0) {
      // Create default config if none exists
      const defaultConfig: InsertScoringConfig = {
        taskDoableWeight: 43.75,
        taskUsabilityWeight: 37.5,
        taskVisualsWeight: 18.75,
        categoryTasksWeight: 80,
        categoryResponsivenessWeight: 15,
        categoryWritingWeight: 5,
        categoryEmotionalWeight: 5
      };
      
      const newConfig = await db.insert(scoringConfig).values(defaultConfig).returning();
      return newConfig[0];
    }
    
    return configs[0];
  }

  async updateTaskScoringConfig(config: Partial<ScoringConfig>): Promise<ScoringConfig> {
    const currentConfig = await this.getScoringConfig();
    const updatedConfig = await db
      .update(scoringConfig)
      .set({
        taskDoableWeight: config.taskDoableWeight ?? currentConfig.taskDoableWeight,
        taskUsabilityWeight: config.taskUsabilityWeight ?? currentConfig.taskUsabilityWeight,
        taskVisualsWeight: config.taskVisualsWeight ?? currentConfig.taskVisualsWeight,
        updatedAt: new Date(),
        updatedBy: config.updatedBy
      })
      .where(eq(scoringConfig.id, currentConfig.id))
      .returning();
    
    return updatedConfig[0];
  }

  async updateCategoryScoringConfig(config: Partial<ScoringConfig>): Promise<ScoringConfig> {
    const currentConfig = await this.getScoringConfig();
    const updatedConfig = await db
      .update(scoringConfig)
      .set({
        categoryTasksWeight: config.categoryTasksWeight ?? currentConfig.categoryTasksWeight,
        categoryResponsivenessWeight: config.categoryResponsivenessWeight ?? currentConfig.categoryResponsivenessWeight,
        categoryWritingWeight: config.categoryWritingWeight ?? currentConfig.categoryWritingWeight,
        categoryEmotionalWeight: config.categoryEmotionalWeight ?? currentConfig.categoryEmotionalWeight,
        updatedAt: new Date(),
        updatedBy: config.updatedBy
      })
      .where(eq(scoringConfig.id, currentConfig.id))
      .returning();
    
    return updatedConfig[0];
  }

  // Report operations
  async getReport(id: number): Promise<ReportWithReview | undefined> {
    const report = await db.query.reports.findFirst({
      where: eq(reports.id, id),
      with: {
        review: {
          with: {
            car: true,
            reviewer: true
          }
        }
      }
    });
    
    if (!report) return undefined;
    
    // Get category evaluations
    const categoryEvals = await this.getCategoryEvaluationsForReview(report.reviewId);
    const taskEvals = await this.getTaskEvaluationsForReview(report.reviewId);
    const config = await this.getScoringConfig();
    
    // Calculate category scores
    const categoryScores = categoryEvals.map(catEval => {
      // Find task evaluations for this category
      const categoryTasks = taskEvals.filter(
        taskEval => taskEval.task.cuj.categoryId === catEval.categoryId
      );
      
      // Calculate task score for this category
      const taskScores = categoryTasks.map(taskEval => 
        calculateTaskScore(
          taskEval.doable ? 100 : 0,
          (taskEval.usabilityScore || 0) * 25,
          (taskEval.visualsScore || 0) * 25,
          config
        )
      );
      
      // Average of task scores
      const avgTaskScore = taskScores.length 
        ? taskScores.reduce((sum, score) => sum + score, 0) / taskScores.length
        : 0;
      
      // Calculate overall category score
      return {
        category: catEval.category,
        taskScore: avgTaskScore,
        responsivenessScore: (catEval.responsivenessScore || 0) * 25,
        writingScore: (catEval.writingScore || 0) * 25,
        emotionalScore: (catEval.emotionalScore || 0) * 25,
        score: calculateCategoryScore(
          avgTaskScore,
          (catEval.responsivenessScore || 0) * 25,
          (catEval.writingScore || 0) * 25,
          (catEval.emotionalScore || 0) * 25,
          config
        )
      };
    });
    
    return {
      ...report,
      categoryScores
    } as ReportWithReview;
  }

  async getReportForReview(reviewId: number): Promise<Report | undefined> {
    const result = await db
      .select()
      .from(reports)
      .where(eq(reports.reviewId, reviewId));
    
    return result[0];
  }

  async createReport(report: InsertReport): Promise<Report> {
    const result = await db.insert(reports).values(report).returning();
    return result[0];
  }

  async updateReport(id: number, reportUpdate: Partial<InsertReport>): Promise<Report> {
    const now = new Date();
    const result = await db
      .update(reports)
      .set({ ...reportUpdate, updatedAt: now })
      .where(eq(reports.id, id))
      .returning();
    
    return result[0];
  }

  // Media operations
  async saveMedia(file: {
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    type: 'image' | 'video';
    userId: number;
  }): Promise<MediaItem> {
    const id = uuidv4();
    const url = `/media/${file.filename}`;
    const thumbnailUrl = file.type === 'video' ? `/media/thumbnail_${file.filename}` : undefined;
    
    const mediaItem: MediaItem = {
      id,
      type: file.type,
      url,
      thumbnailUrl,
      createdAt: new Date().toISOString()
    };
    
    return mediaItem;
  }

  async getMediaItem(id: string): Promise<MediaItem | undefined> {
    // Currently, media items are not stored in the database.
    // This would need to be implemented with a media table.
    return undefined;
  }

  async deleteMedia(id: string, userId: number): Promise<boolean> {
    // Media deletion would need to be implemented with a media table
    return false;
  }

  // CUJ Database Version operations
  async getCujDatabaseVersion(id: number): Promise<CujDatabaseVersion | undefined> {
    try {
      const result = await db
        .select()
        .from(schema.cujDatabaseVersions)
        .where(eq(schema.cujDatabaseVersions.id, id))
        .limit(1);
      
      return result.length ? result[0] : undefined;
    } catch (error) {
      console.error('Error fetching CUJ database version:', error);
      return undefined;
    }
  }
  
  async getActiveCujDatabaseVersion(): Promise<CujDatabaseVersion | undefined> {
    try {
      console.log('Fetching active CUJ database version');
      
      const result = await db
        .select()
        .from(schema.cujDatabaseVersions)
        .where(eq(schema.cujDatabaseVersions.isActive, true))
        .limit(1);
      
      if (result.length) {
        console.log('Found active CUJ database version:', result[0]);
        return result[0];
      }
      
      // If no active version found, get the latest version
      console.log('No active CUJ database version found, fetching latest');
      
      const latest = await db
        .select()
        .from(schema.cujDatabaseVersions)
        .orderBy(desc(schema.cujDatabaseVersions.createdAt))
        .limit(1);
      
      if (latest.length) {
        console.log('Found latest CUJ database version:', latest[0]);
        return latest[0];
      }
      
      console.log('No CUJ database versions found at all');
      return undefined;
    } catch (error) {
      console.error('Error fetching active CUJ database version:', error);
      return undefined;
    }
  }
  
  async getAllCujDatabaseVersions(): Promise<CujDatabaseVersion[]> {
    try {
      return await db
        .select()
        .from(schema.cujDatabaseVersions)
        .orderBy(desc(schema.cujDatabaseVersions.createdAt));
    } catch (error) {
      console.error('Error fetching all CUJ database versions:', error);
      return [];
    }
  }
  
  async createCujDatabaseVersion(version: InsertCujDatabaseVersion): Promise<CujDatabaseVersion> {
    try {
      if (version.isActive) {
        // Deactivate all other versions
        await db
          .update(schema.cujDatabaseVersions)
          .set({ isActive: false })
          .where(sql`1=1`); // This is like WHERE TRUE
      }
      
      const result = await db
        .insert(schema.cujDatabaseVersions)
        .values(version)
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error creating CUJ database version:', error);
      throw error;
    }
  }
  
  async setActiveCujDatabaseVersion(id: number): Promise<CujDatabaseVersion> {
    try {
      // Deactivate all versions
      await db
        .update(schema.cujDatabaseVersions)
        .set({ isActive: false })
        .where(sql`1=1`); // This is like WHERE TRUE
      
      // Activate the requested version
      const result = await db
        .update(schema.cujDatabaseVersions)
        .set({ isActive: true })
        .where(eq(schema.cujDatabaseVersions.id, id))
        .returning();
      
      if (!result.length) {
        throw new Error(`CUJ database version with ID ${id} not found`);
      }
      
      return result[0];
    } catch (error) {
      console.error('Error setting active CUJ database version:', error);
      throw error;
    }
  }

  // CUJ Data Sync
  private cujSyncData = {
    lastSync: new Date().toISOString(),
    status: 'complete'
  };

  async getCujSyncStatus(): Promise<{ lastSync: string, status: string }> {
    return this.cujSyncData;
  }

  async syncCujData(spreadsheetData?: any): Promise<{ success: boolean, message: string, versionId?: number }> {
    try {
      // Create a new CUJ database version for this sync
      const version = await this.createCujDatabaseVersion({
        name: `Sync ${new Date().toISOString()}`,
        description: 'Automatically created during CUJ data sync',
        isActive: true,
        createdAt: new Date().toISOString()
      });
      
      this.cujSyncData = {
        lastSync: new Date().toISOString(),
        status: 'complete'
      };
      
      return { 
        success: true, 
        message: 'Sync completed successfully',
        versionId: version.id
      };
    } catch (error) {
      console.error('Error syncing CUJ data:', error);
      
      this.cujSyncData = {
        lastSync: new Date().toISOString(),
        status: 'error'
      };
      
      return { 
        success: false, 
        message: String(error) 
      };
    }
  }
  
  // Reviewer Assignment methods
  async getReviewerAssignment(id: number): Promise<ReviewerAssignmentWithDetails | undefined> {
    try {
      const result = await db
        .select({
          assignment: schema.reviewerAssignments,
          reviewer: schema.users,
          car: schema.cars,
          category: schema.cujCategories
        })
        .from(schema.reviewerAssignments)
        .leftJoin(schema.users, eq(schema.reviewerAssignments.reviewerId, schema.users.id))
        .leftJoin(schema.cars, eq(schema.reviewerAssignments.carId, schema.cars.id))
        .leftJoin(schema.cujCategories, eq(schema.reviewerAssignments.categoryId, schema.cujCategories.id))
        .where(eq(schema.reviewerAssignments.id, id))
        .limit(1);
      
      if (!result.length) {
        return undefined;
      }
      
      const row = result[0];
      return {
        ...row.assignment,
        reviewer: row.reviewer,
        car: row.car,
        category: row.category
      };
    } catch (error) {
      console.error('Error fetching reviewer assignment:', error);
      return undefined;
    }
  }
  
  async getReviewerAssignmentByReviewerCarCategory(
    reviewerId: number, 
    carId: number, 
    categoryId: number
  ): Promise<ReviewerAssignment | undefined> {
    try {
      const result = await db
        .select()
        .from(schema.reviewerAssignments)
        .where(
          and(
            eq(schema.reviewerAssignments.reviewerId, reviewerId),
            eq(schema.reviewerAssignments.carId, carId),
            eq(schema.reviewerAssignments.categoryId, categoryId)
          )
        )
        .limit(1);
      
      return result.length ? result[0] : undefined;
    } catch (error) {
      console.error('Error fetching reviewer assignment by reviewer, car, and category:', error);
      return undefined;
    }
  }
  
  async getReviewerAssignmentsForReviewer(reviewerId: number): Promise<ReviewerAssignmentWithDetails[]> {
    try {
      const result = await db
        .select({
          assignment: schema.reviewerAssignments,
          reviewer: schema.users,
          car: schema.cars,
          category: schema.cujCategories
        })
        .from(schema.reviewerAssignments)
        .leftJoin(schema.users, eq(schema.reviewerAssignments.reviewerId, schema.users.id))
        .leftJoin(schema.cars, eq(schema.reviewerAssignments.carId, schema.cars.id))
        .leftJoin(schema.cujCategories, eq(schema.reviewerAssignments.categoryId, schema.cujCategories.id))
        .where(eq(schema.reviewerAssignments.reviewerId, reviewerId));
      
      return result.map(row => ({
        ...row.assignment,
        reviewer: row.reviewer,
        car: row.car,
        category: row.category
      }));
    } catch (error) {
      console.error('Error fetching reviewer assignments for reviewer:', error);
      return [];
    }
  }
  
  async getReviewerAssignmentsForCar(carId: number): Promise<ReviewerAssignmentWithDetails[]> {
    try {
      const result = await db
        .select({
          assignment: schema.reviewerAssignments,
          reviewer: schema.users,
          car: schema.cars,
          category: schema.cujCategories
        })
        .from(schema.reviewerAssignments)
        .leftJoin(schema.users, eq(schema.reviewerAssignments.reviewerId, schema.users.id))
        .leftJoin(schema.cars, eq(schema.reviewerAssignments.carId, schema.cars.id))
        .leftJoin(schema.cujCategories, eq(schema.reviewerAssignments.categoryId, schema.cujCategories.id))
        .where(eq(schema.reviewerAssignments.carId, carId));
      
      return result.map(row => ({
        ...row.assignment,
        reviewer: row.reviewer,
        car: row.car,
        category: row.category
      }));
    } catch (error) {
      console.error('Error fetching reviewer assignments for car:', error);
      return [];
    }
  }
  
  async getReviewerAssignmentsForCategory(categoryId: number): Promise<ReviewerAssignmentWithDetails[]> {
    try {
      const result = await db
        .select({
          assignment: schema.reviewerAssignments,
          reviewer: schema.users,
          car: schema.cars,
          category: schema.cujCategories
        })
        .from(schema.reviewerAssignments)
        .leftJoin(schema.users, eq(schema.reviewerAssignments.reviewerId, schema.users.id))
        .leftJoin(schema.cars, eq(schema.reviewerAssignments.carId, schema.cars.id))
        .leftJoin(schema.cujCategories, eq(schema.reviewerAssignments.categoryId, schema.cujCategories.id))
        .where(eq(schema.reviewerAssignments.categoryId, categoryId));
      
      return result.map(row => ({
        ...row.assignment,
        reviewer: row.reviewer,
        car: row.car,
        category: row.category
      }));
    } catch (error) {
      console.error('Error fetching reviewer assignments for category:', error);
      return [];
    }
  }
  
  async createReviewerAssignment(assignment: InsertReviewerAssignment): Promise<ReviewerAssignment> {
    try {
      // Check if there's already an assignment for this car+category combination
      const existing = await db
        .select()
        .from(schema.reviewerAssignments)
        .where(
          and(
            eq(schema.reviewerAssignments.carId, assignment.carId),
            eq(schema.reviewerAssignments.categoryId, assignment.categoryId)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        throw new Error(`A reviewer is already assigned to this car and category combination`);
      }
      
      const result = await db
        .insert(schema.reviewerAssignments)
        .values(assignment)
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error creating reviewer assignment:', error);
      throw error;
    }
  }
  
  async deleteReviewerAssignment(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(schema.reviewerAssignments)
        .where(eq(schema.reviewerAssignments.id, id))
        .returning({ id: schema.reviewerAssignments.id });
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting reviewer assignment:', error);
      return false;
    }
  }
}