import { 
  User, InsertUser, CujCategory, InsertCujCategory, Cuj, InsertCuj, 
  Task, InsertTask, Car, InsertCar, Review, InsertReview, ReviewWithDetails,
  TaskEvaluation, InsertTaskEvaluation, CategoryEvaluation, InsertCategoryEvaluation,
  TaskEvaluationWithTask, CategoryEvaluationWithCategory, ScoringConfig,
  Report, InsertReport, ReportWithReview, MediaItem, CujDatabaseVersion,
  InsertCujDatabaseVersion, ReviewerAssignment, InsertReviewerAssignment,
  ReviewerAssignmentWithDetails, TaskWithCategory
} from '../shared/schema';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { IStorage } from './storage';

/**
 * In-memory implementation of the storage interface.
 * This class provides a complete implementation without PostgreSQL.
 */
export class MemStorage implements IStorage {
  users: Map<number, User>;
  cujCategories: Map<number, CujCategory>;
  cujs: Map<number, Cuj>;
  tasks: Map<number, Task>;
  cars: Map<number, Car>;
  reviews: Map<number, Review>;
  taskEvaluations: Map<string, TaskEvaluation>;
  categoryEvaluations: Map<string, CategoryEvaluation>;
  scoringConfig: ScoringConfig;
  reports: Map<number, Report>;
  cujSyncData: { lastSync: string, status: string };
  cujDatabaseVersions: Map<number, CujDatabaseVersion>;
  reviewerAssignments: Map<number, ReviewerAssignment>;
  mediaItems: Map<string, MediaItem>;

  userIdCounter: number = 1;
  categoryIdCounter: number = 1;
  cujIdCounter: number = 1;
  taskIdCounter: number = 1;
  carIdCounter: number = 1;
  reviewIdCounter: number = 1;
  taskEvalIdCounter: number = 1;
  categoryEvalIdCounter: number = 1;
  reportIdCounter: number = 1;
  cujDatabaseVersionIdCounter: number = 1;
  reviewerAssignmentIdCounter: number = 1;

  constructor() {
    this.users = new Map();
    this.cujCategories = new Map();
    this.cujs = new Map();
    this.tasks = new Map();
    this.cars = new Map();
    this.reviews = new Map();
    this.taskEvaluations = new Map();
    this.categoryEvaluations = new Map();
    this.reports = new Map();
    this.cujDatabaseVersions = new Map();
    this.reviewerAssignments = new Map();
    this.mediaItems = new Map();
    
    // Default scoring config
    this.scoringConfig = {
      id: 1,
      taskWeights: {
        doable: 43.75,
        usabilityAndInteraction: 37.5,
        visuals: 18.75
      },
      categoryWeights: {
        doable: 43.75,
        usabilityAndInteraction: 37.5,
        visuals: 18.75
      }
    };
    
    this.cujSyncData = {
      lastSync: new Date().toISOString(),
      status: 'success'
    };
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // CUJ Category operations
  async getCujCategory(id: number): Promise<CujCategory | undefined> {
    return this.cujCategories.get(id);
  }

  async getAllCujCategories(): Promise<CujCategory[]> {
    return Array.from(this.cujCategories.values());
  }

  async createCujCategory(category: InsertCujCategory): Promise<CujCategory> {
    const id = this.categoryIdCounter++;
    const newCategory: CujCategory = { ...category, id };
    this.cujCategories.set(id, newCategory);
    return newCategory;
  }

  // CUJ operations
  async getCuj(id: number): Promise<Cuj | undefined> {
    return this.cujs.get(id);
  }

  async getCujsForCategory(categoryId: number): Promise<Cuj[]> {
    return Array.from(this.cujs.values()).filter(cuj => cuj.categoryId === categoryId);
  }

  async createCuj(cuj: InsertCuj): Promise<Cuj> {
    const id = this.cujIdCounter++;
    const newCuj: Cuj = { ...cuj, id };
    this.cujs.set(id, newCuj);
    return newCuj;
  }

  // Task operations
  async getTask(id: number): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getTasksForCuj(cujId: number): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(task => task.cujId === cujId);
  }

  async getTasksForReview(reviewId: number): Promise<TaskWithCategory[]> {
    const allTasks = Array.from(this.tasks.values());
    const allCujs = Array.from(this.cujs.values());
    const allCategories = Array.from(this.cujCategories.values());
    
    const tasksWithCategory: TaskWithCategory[] = [];
    
    for (const task of allTasks) {
      const cuj = allCujs.find(c => c.id === task.cujId);
      if (cuj) {
        const category = allCategories.find(cat => cat.id === cuj.categoryId);
        if (category) {
          tasksWithCategory.push({
            ...task,
            cuj,
            category
          });
        }
      }
    }
    
    return tasksWithCategory;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const id = this.taskIdCounter++;
    const newTask: Task = { ...task, id };
    this.tasks.set(id, newTask);
    return newTask;
  }

  // Car operations
  async getCar(id: number): Promise<Car | undefined> {
    return this.cars.get(id);
  }

  async getAllCars(): Promise<Car[]> {
    return Array.from(this.cars.values());
  }

  async createCar(car: InsertCar): Promise<Car> {
    const id = this.carIdCounter++;
    const newCar: Car = { ...car, id };
    this.cars.set(id, newCar);
    return newCar;
  }

  // Review operations
  async getReview(id: number): Promise<ReviewWithDetails | undefined> {
    const review = this.reviews.get(id);
    if (!review) return undefined;
    
    const car = await this.getCar(review.carId);
    const reviewer = await this.getUser(review.reviewerId);
    
    if (!car || !reviewer) return undefined;
    
    let lastModifiedByUser = undefined;
    if (review.lastModifiedBy !== null) {
      lastModifiedByUser = await this.getUser(review.lastModifiedBy);
    }
    
    let cujDatabaseVersion = undefined;
    if (review.cujDatabaseVersionId !== null) {
      cujDatabaseVersion = await this.getCujDatabaseVersion(review.cujDatabaseVersionId);
    }
    
    return {
      ...review,
      car,
      reviewer,
      lastModifiedBy: lastModifiedByUser,
      cujDatabaseVersion
    };
  }

  async getAllReviews(): Promise<ReviewWithDetails[]> {
    const reviews: ReviewWithDetails[] = [];
    
    for (const review of this.reviews.values()) {
      const fullReview = await this.getReview(review.id);
      if (fullReview) {
        reviews.push(fullReview);
      }
    }
    
    return reviews;
  }

  async getReviewsByReviewer(reviewerId: number): Promise<ReviewWithDetails[]> {
    const reviews: ReviewWithDetails[] = [];
    
    for (const review of this.reviews.values()) {
      if (review.reviewerId === reviewerId) {
        const fullReview = await this.getReview(review.id);
        if (fullReview) {
          reviews.push(fullReview);
        }
      }
    }
    
    return reviews;
  }

  async createReview(review: InsertReview): Promise<Review> {
    const id = this.reviewIdCounter++;
    const now = new Date();
    
    const newReview: Review = {
      ...review,
      id,
      createdAt: now,
      lastModifiedAt: now
    };
    
    this.reviews.set(id, newReview);
    return newReview;
  }

  async updateReviewStatus(id: number, status: string): Promise<Review> {
    const review = this.reviews.get(id);
    if (!review) throw new Error(`Review with id ${id} not found`);
    
    const updatedReview: Review = {
      ...review,
      status,
      lastModifiedAt: new Date()
    };
    
    this.reviews.set(id, updatedReview);
    return updatedReview;
  }

  async updateReview(id: number, lastModifiedBy: number, data: { status?: string, isPublished?: boolean }): Promise<Review> {
    const review = this.reviews.get(id);
    if (!review) throw new Error(`Review with id ${id} not found`);
    
    const updatedReview: Review = {
      ...review,
      ...data,
      lastModifiedBy,
      lastModifiedAt: new Date()
    };
    
    this.reviews.set(id, updatedReview);
    return updatedReview;
  }

  // Task Evaluation operations
  private getTaskEvaluationKey(reviewId: number, taskId: number): string {
    return `${reviewId}-${taskId}`;
  }

  async getTaskEvaluation(reviewId: number, taskId: number): Promise<TaskEvaluation | undefined> {
    const key = this.getTaskEvaluationKey(reviewId, taskId);
    return this.taskEvaluations.get(key);
  }

  async getTaskEvaluationsForReview(reviewId: number): Promise<TaskEvaluationWithTask[]> {
    const evals: TaskEvaluationWithTask[] = [];
    
    for (const [key, evaluation] of this.taskEvaluations.entries()) {
      const [evalReviewId] = key.split('-').map(Number);
      
      if (evalReviewId === reviewId) {
        const task = await this.getTask(evaluation.taskId);
        if (task) {
          evals.push({
            ...evaluation,
            task
          });
        }
      }
    }
    
    return evals;
  }

  async createTaskEvaluation(evaluation: InsertTaskEvaluation): Promise<TaskEvaluation> {
    const key = this.getTaskEvaluationKey(evaluation.reviewId, evaluation.taskId);
    const existing = this.taskEvaluations.get(key);
    
    const now = new Date();
    
    const newEvaluation: TaskEvaluation = {
      ...evaluation,
      id: existing ? existing.id : this.taskEvalIdCounter++,
      createdAt: existing ? existing.createdAt : now,
      lastModifiedAt: now
    };
    
    this.taskEvaluations.set(key, newEvaluation);
    return newEvaluation;
  }

  async updateTaskEvaluation(reviewId: number, taskId: number, evaluation: InsertTaskEvaluation): Promise<TaskEvaluation> {
    const key = this.getTaskEvaluationKey(reviewId, taskId);
    const existing = this.taskEvaluations.get(key);
    
    if (!existing) {
      return this.createTaskEvaluation(evaluation);
    }
    
    const updatedEval: TaskEvaluation = {
      ...existing,
      ...evaluation,
      lastModifiedAt: new Date()
    };
    
    this.taskEvaluations.set(key, updatedEval);
    return updatedEval;
  }

  async getCompletedTaskIds(reviewId: number): Promise<number[]> {
    const completedIds: number[] = [];
    
    for (const [key, evaluation] of this.taskEvaluations.entries()) {
      const [evalReviewId] = key.split('-').map(Number);
      
      if (evalReviewId === reviewId && evaluation.isCompleted) {
        completedIds.push(evaluation.taskId);
      }
    }
    
    return completedIds;
  }

  // Category Evaluation operations
  private getCategoryEvaluationKey(reviewId: number, categoryId: number): string {
    return `${reviewId}-${categoryId}`;
  }

  async getCategoryEvaluation(reviewId: number, categoryId: number): Promise<CategoryEvaluation | undefined> {
    const key = this.getCategoryEvaluationKey(reviewId, categoryId);
    return this.categoryEvaluations.get(key);
  }

  async getCategoryEvaluationsForReview(reviewId: number): Promise<CategoryEvaluationWithCategory[]> {
    const evals: CategoryEvaluationWithCategory[] = [];
    
    for (const [key, evaluation] of this.categoryEvaluations.entries()) {
      const [evalReviewId] = key.split('-').map(Number);
      
      if (evalReviewId === reviewId) {
        const category = await this.getCujCategory(evaluation.categoryId);
        if (category) {
          evals.push({
            ...evaluation,
            category
          });
        }
      }
    }
    
    return evals;
  }

  async createCategoryEvaluation(evaluation: InsertCategoryEvaluation): Promise<CategoryEvaluation> {
    const key = this.getCategoryEvaluationKey(evaluation.reviewId, evaluation.categoryId);
    const existing = this.categoryEvaluations.get(key);
    
    const now = new Date();
    
    const newEvaluation: CategoryEvaluation = {
      ...evaluation,
      id: existing ? existing.id : this.categoryEvalIdCounter++,
      createdAt: existing ? existing.createdAt : now,
      lastModifiedAt: now
    };
    
    this.categoryEvaluations.set(key, newEvaluation);
    return newEvaluation;
  }

  async updateCategoryEvaluation(reviewId: number, categoryId: number, evaluation: InsertCategoryEvaluation): Promise<CategoryEvaluation> {
    const key = this.getCategoryEvaluationKey(reviewId, categoryId);
    const existing = this.categoryEvaluations.get(key);
    
    if (!existing) {
      return this.createCategoryEvaluation(evaluation);
    }
    
    const updatedEval: CategoryEvaluation = {
      ...existing,
      ...evaluation,
      lastModifiedAt: new Date()
    };
    
    this.categoryEvaluations.set(key, updatedEval);
    return updatedEval;
  }

  // Scoring Config operations
  async getScoringConfig(): Promise<ScoringConfig> {
    return this.scoringConfig;
  }

  async updateTaskScoringConfig(config: Partial<ScoringConfig>): Promise<ScoringConfig> {
    if (config.taskWeights) {
      this.scoringConfig.taskWeights = {
        ...this.scoringConfig.taskWeights,
        ...config.taskWeights
      };
    }
    
    return this.scoringConfig;
  }

  async updateCategoryScoringConfig(config: Partial<ScoringConfig>): Promise<ScoringConfig> {
    if (config.categoryWeights) {
      this.scoringConfig.categoryWeights = {
        ...this.scoringConfig.categoryWeights,
        ...config.categoryWeights
      };
    }
    
    return this.scoringConfig;
  }

  // Report operations
  async getReport(id: number): Promise<ReportWithReview | undefined> {
    const report = this.reports.get(id);
    if (!report) return undefined;
    
    const review = await this.getReview(report.reviewId);
    if (!review) return undefined;
    
    return {
      ...report,
      review
    };
  }

  async getReportForReview(reviewId: number): Promise<Report | undefined> {
    for (const report of this.reports.values()) {
      if (report.reviewId === reviewId) {
        return report;
      }
    }
    
    return undefined;
  }

  async createReport(report: InsertReport): Promise<Report> {
    const id = this.reportIdCounter++;
    const now = new Date();
    
    const newReport: Report = {
      ...report,
      id,
      createdAt: now,
      lastModifiedAt: now
    };
    
    this.reports.set(id, newReport);
    return newReport;
  }

  async updateReport(id: number, reportUpdate: Partial<InsertReport>): Promise<Report> {
    const report = this.reports.get(id);
    if (!report) throw new Error(`Report with id ${id} not found`);
    
    const updatedReport: Report = {
      ...report,
      ...reportUpdate,
      lastModifiedAt: new Date()
    };
    
    this.reports.set(id, updatedReport);
    return updatedReport;
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
    const now = new Date();
    
    const mediaItem: MediaItem = {
      id,
      filename: file.filename,
      originalName: file.originalName,
      mimetype: file.mimetype,
      size: file.size,
      type: file.type,
      userId: file.userId,
      uploadedAt: now
    };
    
    this.mediaItems.set(id, mediaItem);
    return mediaItem;
  }

  async getMediaItem(id: string): Promise<MediaItem | undefined> {
    return this.mediaItems.get(id);
  }

  async deleteMedia(id: string, userId: number): Promise<boolean> {
    try {
      const mediaItem = this.mediaItems.get(id);
      
      if (!mediaItem) {
        return false;
      }
      
      const filename = mediaItem.filename;
      
      if (filename) {
        // Construct the path to the file
        const filePath = path.join(process.cwd(), 'public/uploads', filename);
        
        // Check if file exists
        if (fs.existsSync(filePath)) {
          // Delete the file
          fs.unlinkSync(filePath);
        }
      }
      
      // Remove from in-memory storage
      this.mediaItems.delete(id);
      return true;
    } catch (error) {
      console.error('Error deleting media file:', error);
      return false;
    }
  }

  // CUJ Database Version operations
  async getCujDatabaseVersion(id: number): Promise<CujDatabaseVersion | undefined> {
    return this.cujDatabaseVersions.get(id);
  }

  async getActiveCujDatabaseVersion(): Promise<CujDatabaseVersion | undefined> {
    for (const version of this.cujDatabaseVersions.values()) {
      if (version.isActive) {
        return version;
      }
    }
    return undefined;
  }

  async getAllCujDatabaseVersions(): Promise<CujDatabaseVersion[]> {
    return Array.from(this.cujDatabaseVersions.values());
  }

  async createCujDatabaseVersion(version: InsertCujDatabaseVersion): Promise<CujDatabaseVersion> {
    const id = this.cujDatabaseVersionIdCounter++;
    const now = new Date();
    
    const newVersion: CujDatabaseVersion = {
      ...version,
      id,
      createdAt: now
    };
    
    this.cujDatabaseVersions.set(id, newVersion);
    return newVersion;
  }

  async setActiveCujDatabaseVersion(id: number): Promise<CujDatabaseVersion> {
    const version = this.cujDatabaseVersions.get(id);
    if (!version) {
      throw new Error(`CUJ database version with id ${id} not found`);
    }
    
    // Set all other versions as inactive
    for (const [versionId, versionData] of this.cujDatabaseVersions.entries()) {
      this.cujDatabaseVersions.set(versionId, {
        ...versionData,
        isActive: versionId === id
      });
    }
    
    const updatedVersion: CujDatabaseVersion = {
      ...version,
      isActive: true
    };
    
    this.cujDatabaseVersions.set(id, updatedVersion);
    return updatedVersion;
  }

  // CUJ Data Sync
  async getCujSyncStatus(): Promise<{ lastSync: string, status: string }> {
    return this.cujSyncData;
  }

  async syncCujData(spreadsheetData?: any): Promise<{ success: boolean, message: string, versionId?: number }> {
    const now = new Date();
    this.cujSyncData = {
      lastSync: now.toISOString(),
      status: 'success'
    };
    
    // In the real implementation, we would process the spreadsheet data here
    
    // For the mock implementation, we'll create a new version
    const version = await this.createCujDatabaseVersion({
      name: `Sync ${now.toISOString()}`,
      description: 'Automatically synchronized CUJ database',
      isActive: true
    });
    
    // Set it as active
    await this.setActiveCujDatabaseVersion(version.id);
    
    return {
      success: true,
      message: 'CUJ data synchronized successfully',
      versionId: version.id
    };
  }

  // Reviewer Assignment operations
  async getReviewerAssignment(id: number): Promise<ReviewerAssignmentWithDetails | undefined> {
    const assignment = this.reviewerAssignments.get(id);
    if (!assignment) return undefined;
    
    const reviewer = await this.getUser(assignment.reviewerId);
    const car = await this.getCar(assignment.carId);
    const category = await this.getCujCategory(assignment.categoryId);
    
    if (!reviewer || !car || !category) return undefined;
    
    return {
      ...assignment,
      reviewer,
      car,
      category
    };
  }

  async getReviewerAssignmentByReviewerCarCategory(
    reviewerId: number,
    carId: number,
    categoryId: number
  ): Promise<ReviewerAssignment | undefined> {
    for (const assignment of this.reviewerAssignments.values()) {
      if (
        assignment.reviewerId === reviewerId &&
        assignment.carId === carId &&
        assignment.categoryId === categoryId
      ) {
        return assignment;
      }
    }
    
    return undefined;
  }

  async getReviewerAssignmentsForReviewer(reviewerId: number): Promise<ReviewerAssignmentWithDetails[]> {
    const assignments: ReviewerAssignmentWithDetails[] = [];
    
    for (const assignment of this.reviewerAssignments.values()) {
      if (assignment.reviewerId === reviewerId) {
        const details = await this.getReviewerAssignment(assignment.id);
        if (details) {
          assignments.push(details);
        }
      }
    }
    
    return assignments;
  }

  async getReviewerAssignmentsForCar(carId: number): Promise<ReviewerAssignmentWithDetails[]> {
    const assignments: ReviewerAssignmentWithDetails[] = [];
    
    for (const assignment of this.reviewerAssignments.values()) {
      if (assignment.carId === carId) {
        const details = await this.getReviewerAssignment(assignment.id);
        if (details) {
          assignments.push(details);
        }
      }
    }
    
    return assignments;
  }

  async getReviewerAssignmentsForCategory(categoryId: number): Promise<ReviewerAssignmentWithDetails[]> {
    const assignments: ReviewerAssignmentWithDetails[] = [];
    
    for (const assignment of this.reviewerAssignments.values()) {
      if (assignment.categoryId === categoryId) {
        const details = await this.getReviewerAssignment(assignment.id);
        if (details) {
          assignments.push(details);
        }
      }
    }
    
    return assignments;
  }

  async createReviewerAssignment(assignment: InsertReviewerAssignment): Promise<ReviewerAssignment> {
    const id = this.reviewerAssignmentIdCounter++;
    const now = new Date();
    
    const newAssignment: ReviewerAssignment = {
      ...assignment,
      id,
      createdAt: now
    };
    
    this.reviewerAssignments.set(id, newAssignment);
    return newAssignment;
  }

  async deleteReviewerAssignment(id: number): Promise<boolean> {
    if (!this.reviewerAssignments.has(id)) {
      return false;
    }
    
    this.reviewerAssignments.delete(id);
    return true;
  }
}