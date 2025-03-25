import fs from "fs";
import path from "path";

import { 
  users,
  User,
  InsertUser,
  cujCategories,
  CujCategory,
  InsertCujCategory,
  cujs,
  Cuj,
  InsertCuj,
  tasks,
  Task,
  InsertTask,
  cars,
  Car,
  InsertCar,
  reviews,
  Review,
  InsertReview,
  taskEvaluations,
  TaskEvaluation,
  InsertTaskEvaluation,
  categoryEvaluations,
  CategoryEvaluation,
  InsertCategoryEvaluation,
  scoringConfig,
  ScoringConfig,
  InsertScoringConfig,
  reports,
  Report,
  InsertReport,
  ReviewWithDetails,
  TaskWithCategory,
  ReportWithReview,
  CategoryEvaluationWithCategory,
  TaskEvaluationWithTask,
  MediaItem
} from "@shared/schema";
import { calculateTaskScore, calculateCategoryScore } from "../client/src/lib/utils";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // CUJ Category operations
  getCujCategory(id: number): Promise<CujCategory | undefined>;
  getAllCujCategories(): Promise<CujCategory[]>;
  createCujCategory(category: InsertCujCategory): Promise<CujCategory>;
  
  // CUJ operations
  getCuj(id: number): Promise<Cuj | undefined>;
  getCujsForCategory(categoryId: number): Promise<Cuj[]>;
  createCuj(cuj: InsertCuj): Promise<Cuj>;
  
  // Task operations
  getTask(id: number): Promise<Task | undefined>;
  getTasksForCuj(cujId: number): Promise<Task[]>;
  getTasksForReview(reviewId: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  
  // Car operations
  getCar(id: number): Promise<Car | undefined>;
  getAllCars(): Promise<Car[]>;
  createCar(car: InsertCar): Promise<Car>;
  
  // Review operations
  getReview(id: number): Promise<ReviewWithDetails | undefined>;
  getAllReviews(): Promise<ReviewWithDetails[]>;
  getReviewsByReviewer(reviewerId: number): Promise<ReviewWithDetails[]>;
  createReview(review: InsertReview): Promise<Review>;
  updateReviewStatus(id: number, status: string): Promise<Review>;
  
  // Task Evaluation operations
  getTaskEvaluation(reviewId: number, taskId: number): Promise<TaskEvaluation | undefined>;
  getTaskEvaluationsForReview(reviewId: number): Promise<TaskEvaluationWithTask[]>;
  createTaskEvaluation(evaluation: InsertTaskEvaluation): Promise<TaskEvaluation>;
  updateTaskEvaluation(reviewId: number, taskId: number, evaluation: InsertTaskEvaluation): Promise<TaskEvaluation>;
  getCompletedTaskIds(reviewId: number): Promise<number[]>;
  
  // Category Evaluation operations
  getCategoryEvaluation(reviewId: number, categoryId: number): Promise<CategoryEvaluation | undefined>;
  getCategoryEvaluationsForReview(reviewId: number): Promise<CategoryEvaluationWithCategory[]>;
  createCategoryEvaluation(evaluation: InsertCategoryEvaluation): Promise<CategoryEvaluation>;
  updateCategoryEvaluation(reviewId: number, categoryId: number, evaluation: InsertCategoryEvaluation): Promise<CategoryEvaluation>;
  
  // Scoring Config operations
  getScoringConfig(): Promise<ScoringConfig>;
  updateTaskScoringConfig(config: Partial<ScoringConfig>): Promise<ScoringConfig>;
  updateCategoryScoringConfig(config: Partial<ScoringConfig>): Promise<ScoringConfig>;
  
  // Report operations
  getReport(id: number): Promise<ReportWithReview | undefined>;
  getReportForReview(reviewId: number): Promise<Report | undefined>;
  createReport(report: InsertReport): Promise<Report>;
  updateReport(id: number, report: Partial<InsertReport>): Promise<Report>;
  
  // Media operations
  saveMedia(file: {
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    type: 'image' | 'video';
    userId: number;
  }): Promise<MediaItem>;
  getMediaItem(id: string): Promise<MediaItem | undefined>;
  deleteMedia(id: string, userId: number): Promise<boolean>;
  
  // CUJ Data Sync
  getCujSyncStatus(): Promise<{ lastSync: string, status: string }>;
  syncCujData(): Promise<{ success: boolean, message: string }>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private cujCategories: Map<number, CujCategory>;
  private cujs: Map<number, Cuj>;
  private tasks: Map<number, Task>;
  private cars: Map<number, Car>;
  private reviews: Map<number, Review>;
  private taskEvaluations: Map<string, TaskEvaluation>;
  private categoryEvaluations: Map<string, CategoryEvaluation>;
  private scoringConfig: ScoringConfig;
  private reports: Map<number, Report>;
  private cujSyncData: { lastSync: string, status: string };
  
  private userIdCounter: number = 1;
  private categoryIdCounter: number = 1;
  private cujIdCounter: number = 1;
  private taskIdCounter: number = 1;
  private carIdCounter: number = 1;
  private reviewIdCounter: number = 1;
  private taskEvalIdCounter: number = 1;
  private categoryEvalIdCounter: number = 1;
  private reportIdCounter: number = 1;

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
    
    // Initialize with default scoring config
    this.scoringConfig = {
      id: 1,
      taskDoableWeight: 43.75,
      taskUsabilityWeight: 37.5,
      taskVisualsWeight: 18.75,
      categoryTasksWeight: 80,
      categoryResponsivenessWeight: 15,
      categoryWritingWeight: 5,
      categoryEmotionalWeight: 5,
      updatedAt: new Date().toISOString(),
      updatedBy: null
    };
    
    this.cujSyncData = {
      lastSync: new Date().toISOString(),
      status: "up_to_date"
    };
    
    // Initialize with sample data
    this.initializeSampleData();
  }
  
  private initializeSampleData() {
    // Create sample users
    this.createUser({ username: "admin", password: "admin123", name: "Admin User", role: "admin" });
    this.createUser({ username: "reviewer", password: "review123", name: "Test Reviewer", role: "reviewer" });
    this.createUser({ username: "internal", password: "internal123", name: "Internal Stakeholder", role: "internal" });
    this.createUser({ username: "external", password: "external123", name: "External Viewer", role: "external" });
    
    // Create sample categories
    const navigationCategory = this.createCujCategory({ 
      name: "Navigation", 
      description: "All navigation related functions", 
      icon: "navigation" 
    });
    
    const mediaCategory = this.createCujCategory({ 
      name: "Media", 
      description: "Audio, video and entertainment functions", 
      icon: "headphones" 
    });
    
    const communicationCategory = this.createCujCategory({ 
      name: "Communications", 
      description: "Phone, messaging and voice assistant features", 
      icon: "phone" 
    });
    
    const generalCategory = this.createCujCategory({ 
      name: "General", 
      description: "System-wide settings and features", 
      icon: "settings" 
    });
    
    // Create sample CUJs
    const navCuj = this.createCuj({
      categoryId: navigationCategory.id,
      name: "Destination Entry",
      description: "Entering and navigating to destinations"
    });
    
    const mediaCuj = this.createCuj({
      categoryId: mediaCategory.id,
      name: "Music Playback",
      description: "Playing and controlling music from different sources"
    });
    
    // Create sample tasks
    this.createTask({
      cujId: navCuj.id,
      name: "Enter a destination using voice commands",
      prerequisites: "Vehicle is on, Infotainment system is powered on, Microphone is enabled",
      expectedOutcome: "Navigation route is calculated and displayed on the map."
    });
    
    this.createTask({
      cujId: navCuj.id,
      name: "Start turn-by-turn navigation",
      prerequisites: "Destination is entered, Route is calculated",
      expectedOutcome: "Clear and timely voice prompts and visual cues guide the driver along the route."
    });
    
    this.createTask({
      cujId: mediaCuj.id,
      name: "Connect smartphone via Bluetooth",
      prerequisites: "Smartphone Bluetooth is enabled",
      expectedOutcome: "Smartphone is successfully paired and audio can be streamed."
    });
    
    // Create sample cars
    this.createCar({
      make: "Tesla",
      model: "Model 3",
      year: 2025,
      androidVersion: "15.2",
      buildFingerprint: "TM3-2025Q1-14.8.6",
      location: "Mountain View, CA",
      imageUrl: "https://images.unsplash.com/photo-1619767886558-f20ee7a30bc6?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"
    });
    
    this.createCar({
      make: "BMW",
      model: "i7",
      year: 2025,
      androidVersion: "15.0",
      buildFingerprint: "BMW-i7-2025Q1-13.7.2",
      location: "San Francisco, CA",
      imageUrl: "https://images.unsplash.com/photo-1617914900071-532377d42425?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"
    });
    
    // Create sample reviews
    const now = new Date();
    const oneWeekLater = new Date(now);
    oneWeekLater.setDate(oneWeekLater.getDate() + 7);
    
    this.createReview({
      carId: 1,
      reviewerId: 2, // reviewer
      status: "in_progress",
      startDate: now.toISOString(),
      endDate: oneWeekLater.toISOString()
    });
    
    this.createReview({
      carId: 2,
      reviewerId: 2, // reviewer
      status: "pending",
      startDate: now.toISOString(),
      endDate: oneWeekLater.toISOString()
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
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
  
  // CUJ Category methods
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
  
  // CUJ methods
  async getCuj(id: number): Promise<Cuj | undefined> {
    return this.cujs.get(id);
  }
  
  async getCujsForCategory(categoryId: number): Promise<Cuj[]> {
    return Array.from(this.cujs.values()).filter(
      (cuj) => cuj.categoryId === categoryId
    );
  }
  
  async createCuj(cuj: InsertCuj): Promise<Cuj> {
    const id = this.cujIdCounter++;
    const newCuj: Cuj = { ...cuj, id };
    this.cujs.set(id, newCuj);
    return newCuj;
  }
  
  // Task methods
  async getTask(id: number): Promise<Task | undefined> {
    return this.tasks.get(id);
  }
  
  async getTasksForCuj(cujId: number): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(
      (task) => task.cujId === cujId
    );
  }
  
  async getTasksForReview(reviewId: number): Promise<TaskWithCategory[]> {
    // Get all tasks
    const allTasks = Array.from(this.tasks.values());
    console.log(`Found ${allTasks.length} total tasks`);
    
    // Enhance each task with its CUJ and category information
    const tasksWithCategories: TaskWithCategory[] = [];
    
    for (const task of allTasks) {
      // Get the CUJ directly from the map instead of using the async method
      const cuj = this.cujs.get(task.cujId);
      let category = null;
      
      if (cuj) {
        // Get the category directly from the map
        category = this.cujCategories.get(cuj.categoryId);
        console.log(`Task ${task.id} (${task.name}) is linked to CUJ ${cuj.id} (${cuj.name}) and category ${category?.id} (${category?.name})`);
      } else {
        console.log(`Task ${task.id} (${task.name}) has CUJ ID ${task.cujId} but CUJ not found`);
      }
      
      tasksWithCategories.push({
        ...task,
        cuj: cuj ? {
          ...cuj,
          category: category || {
            id: 0,
            name: "Unknown",
            description: null,
            icon: null
          }
        } : {
          id: 0,
          name: "Unknown",
          description: null,
          categoryId: 0,
          category: {
            id: 0,
            name: "Unknown",
            description: null,
            icon: null
          }
        }
      } as TaskWithCategory);
    }
    
    console.log(`Returning ${tasksWithCategories.length} tasks with categories`);
    return tasksWithCategories;
  }
  
  async createTask(task: InsertTask): Promise<Task> {
    const id = this.taskIdCounter++;
    const newTask: Task = { ...task, id };
    this.tasks.set(id, newTask);
    return newTask;
  }
  
  // Car methods
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
  
  // Review methods
  async getReview(id: number): Promise<ReviewWithDetails | undefined> {
    const review = this.reviews.get(id);
    if (!review) return undefined;
    
    const car = await this.getCar(review.carId);
    const reviewer = await this.getUser(review.reviewerId);
    
    if (!car || !reviewer) return undefined;
    
    return {
      ...review,
      car,
      reviewer
    };
  }
  
  async getAllReviews(): Promise<ReviewWithDetails[]> {
    const reviews = Array.from(this.reviews.values());
    const detailedReviews: ReviewWithDetails[] = [];
    
    for (const review of reviews) {
      const car = await this.getCar(review.carId);
      const reviewer = await this.getUser(review.reviewerId);
      
      if (car && reviewer) {
        detailedReviews.push({
          ...review,
          car,
          reviewer
        });
      }
    }
    
    return detailedReviews;
  }
  
  async getReviewsByReviewer(reviewerId: number): Promise<ReviewWithDetails[]> {
    const reviews = Array.from(this.reviews.values()).filter(
      (review) => review.reviewerId === reviewerId
    );
    
    const detailedReviews: ReviewWithDetails[] = [];
    
    for (const review of reviews) {
      const car = await this.getCar(review.carId);
      const reviewer = await this.getUser(review.reviewerId);
      
      if (car && reviewer) {
        detailedReviews.push({
          ...review,
          car,
          reviewer
        });
      }
    }
    
    return detailedReviews;
  }
  
  async createReview(review: InsertReview): Promise<Review> {
    const id = this.reviewIdCounter++;
    const now = new Date().toISOString();
    
    const newReview: Review = {
      ...review,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    this.reviews.set(id, newReview);
    return newReview;
  }
  
  async updateReviewStatus(id: number, status: string): Promise<Review> {
    const review = this.reviews.get(id);
    if (!review) {
      throw new Error('Review not found');
    }
    
    const updatedReview: Review = {
      ...review,
      status,
      updatedAt: new Date().toISOString()
    };
    
    this.reviews.set(id, updatedReview);
    return updatedReview;
  }
  
  // Task Evaluation methods
  private getTaskEvaluationKey(reviewId: number, taskId: number): string {
    return `${reviewId}-${taskId}`;
  }
  
  async getTaskEvaluation(reviewId: number, taskId: number): Promise<TaskEvaluation | undefined> {
    const key = this.getTaskEvaluationKey(reviewId, taskId);
    return this.taskEvaluations.get(key);
  }
  
  async getTaskEvaluationsForReview(reviewId: number): Promise<TaskEvaluationWithTask[]> {
    const evaluations = Array.from(this.taskEvaluations.values()).filter(
      (evaluation) => evaluation.reviewId === reviewId
    );
    
    const result: TaskEvaluationWithTask[] = [];
    
    for (const evaluation of evaluations) {
      const task = await this.getTask(evaluation.taskId);
      if (task) {
        const cuj = await this.getCuj(task.cujId);
        if (cuj) {
          const category = await this.getCujCategory(cuj.categoryId);
          if (category) {
            result.push({
              ...evaluation,
              task: {
                ...task,
                cuj: {
                  ...cuj,
                  category
                }
              }
            });
          }
        }
      }
    }
    
    return result;
  }
  
  async createTaskEvaluation(evaluation: InsertTaskEvaluation): Promise<TaskEvaluation> {
    const id = this.taskEvalIdCounter++;
    const now = new Date().toISOString();
    
    const newEvaluation: TaskEvaluation = {
      ...evaluation,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    const key = this.getTaskEvaluationKey(evaluation.reviewId, evaluation.taskId);
    this.taskEvaluations.set(key, newEvaluation);
    
    return newEvaluation;
  }
  
  async updateTaskEvaluation(reviewId: number, taskId: number, evaluation: InsertTaskEvaluation): Promise<TaskEvaluation> {
    const key = this.getTaskEvaluationKey(reviewId, taskId);
    const existingEval = this.taskEvaluations.get(key);
    
    if (!existingEval) {
      throw new Error('Evaluation not found');
    }
    
    const updatedEval: TaskEvaluation = {
      ...existingEval,
      ...evaluation,
      updatedAt: new Date().toISOString()
    };
    
    this.taskEvaluations.set(key, updatedEval);
    return updatedEval;
  }
  
  async getCompletedTaskIds(reviewId: number): Promise<number[]> {
    // Get all task evaluations for this review
    const evaluations = Array.from(this.taskEvaluations.values())
      .filter(evaluation => evaluation.reviewId === reviewId);
    
    // Only count tasks as completed if they have been properly submitted
    // Map to just the task IDs
    return evaluations.map(evaluation => evaluation.taskId);
  }
  
  // Category Evaluation methods
  private getCategoryEvaluationKey(reviewId: number, categoryId: number): string {
    return `${reviewId}-${categoryId}`;
  }
  
  async getCategoryEvaluation(reviewId: number, categoryId: number): Promise<CategoryEvaluation | undefined> {
    const key = this.getCategoryEvaluationKey(reviewId, categoryId);
    return this.categoryEvaluations.get(key);
  }
  
  async getCategoryEvaluationsForReview(reviewId: number): Promise<CategoryEvaluationWithCategory[]> {
    const evaluations = Array.from(this.categoryEvaluations.values()).filter(
      (evaluation) => evaluation.reviewId === reviewId
    );
    
    const result: CategoryEvaluationWithCategory[] = [];
    
    for (const evaluation of evaluations) {
      const category = await this.getCujCategory(evaluation.categoryId);
      if (category) {
        result.push({
          ...evaluation,
          category
        });
      }
    }
    
    return result;
  }
  
  async createCategoryEvaluation(evaluation: InsertCategoryEvaluation): Promise<CategoryEvaluation> {
    const id = this.categoryEvalIdCounter++;
    const now = new Date().toISOString();
    
    const newEvaluation: CategoryEvaluation = {
      ...evaluation,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    const key = this.getCategoryEvaluationKey(evaluation.reviewId, evaluation.categoryId);
    this.categoryEvaluations.set(key, newEvaluation);
    
    return newEvaluation;
  }
  
  async updateCategoryEvaluation(reviewId: number, categoryId: number, evaluation: InsertCategoryEvaluation): Promise<CategoryEvaluation> {
    const key = this.getCategoryEvaluationKey(reviewId, categoryId);
    const existingEval = this.categoryEvaluations.get(key);
    
    if (!existingEval) {
      throw new Error('Evaluation not found');
    }
    
    const updatedEval: CategoryEvaluation = {
      ...existingEval,
      ...evaluation,
      updatedAt: new Date().toISOString()
    };
    
    this.categoryEvaluations.set(key, updatedEval);
    return updatedEval;
  }
  
  // Scoring Config methods
  async getScoringConfig(): Promise<ScoringConfig> {
    return this.scoringConfig;
  }
  
  async updateTaskScoringConfig(config: Partial<ScoringConfig>): Promise<ScoringConfig> {
    // Update only the task level weights
    this.scoringConfig = {
      ...this.scoringConfig,
      ...(config.taskDoableWeight !== undefined && { taskDoableWeight: config.taskDoableWeight }),
      ...(config.taskUsabilityWeight !== undefined && { taskUsabilityWeight: config.taskUsabilityWeight }),
      ...(config.taskVisualsWeight !== undefined && { taskVisualsWeight: config.taskVisualsWeight }),
      updatedAt: new Date().toISOString(),
      updatedBy: config.updatedBy || this.scoringConfig.updatedBy
    };
    
    return this.scoringConfig;
  }
  
  async updateCategoryScoringConfig(config: Partial<ScoringConfig>): Promise<ScoringConfig> {
    // Update only the category level weights
    this.scoringConfig = {
      ...this.scoringConfig,
      ...(config.categoryTasksWeight !== undefined && { categoryTasksWeight: config.categoryTasksWeight }),
      ...(config.categoryResponsivenessWeight !== undefined && { categoryResponsivenessWeight: config.categoryResponsivenessWeight }),
      ...(config.categoryWritingWeight !== undefined && { categoryWritingWeight: config.categoryWritingWeight }),
      ...(config.categoryEmotionalWeight !== undefined && { categoryEmotionalWeight: config.categoryEmotionalWeight }),
      updatedAt: new Date().toISOString(),
      updatedBy: config.updatedBy || this.scoringConfig.updatedBy
    };
    
    return this.scoringConfig;
  }
  
  // Report methods
  async getReport(id: number): Promise<ReportWithReview | undefined> {
    const report = this.reports.get(id);
    if (!report) return undefined;
    
    const reviewDetail = await this.getReview(report.reviewId);
    if (!reviewDetail) return undefined;
    
    // Calculate category scores
    const config = await this.getScoringConfig();
    const categoryEvaluations = await this.getCategoryEvaluationsForReview(report.reviewId);
    const taskEvaluations = await this.getTaskEvaluationsForReview(report.reviewId);
    
    // Group task evaluations by category
    const tasksByCategoryId = new Map<number, TaskEvaluationWithTask[]>();
    
    for (const taskEval of taskEvaluations) {
      const categoryId = taskEval.task.cuj.category.id;
      if (!tasksByCategoryId.has(categoryId)) {
        tasksByCategoryId.set(categoryId, []);
      }
      tasksByCategoryId.get(categoryId)?.push(taskEval);
    }
    
    // Calculate scores for each category
    const categoryScores = [];
    const categories = await this.getAllCujCategories();
    
    for (const category of categories) {
      const categoryEval = categoryEvaluations.find(evaluation => evaluation.categoryId === category.id);
      const taskEvals = tasksByCategoryId.get(category.id) || [];
      
      // Calculate average task score for this category
      let taskAvgScore = 0;
      let taskCount = 0;
      
      for (const taskEval of taskEvals) {
        const taskScore = calculateTaskScore(
          taskEval,
          {
            doable: config.taskDoableWeight,
            usability: config.taskUsabilityWeight,
            visuals: config.taskVisualsWeight
          }
        );
        
        if (taskScore !== null) {
          taskAvgScore += taskScore;
          taskCount++;
        }
      }
      
      taskAvgScore = taskCount > 0 ? taskAvgScore / taskCount : 0;
      
      // Calculate overall category score
      const categoryScore = calculateCategoryScore(
        taskCount > 0 ? taskAvgScore : null,
        categoryEval || null,
        {
          tasks: config.categoryTasksWeight,
          responsiveness: config.categoryResponsivenessWeight,
          writing: config.categoryWritingWeight,
          emotional: config.categoryEmotionalWeight
        }
      );
      
      categoryScores.push({
        category,
        score: categoryScore || 0,
        taskScore: taskAvgScore,
        responsivenessScore: categoryEval?.responsivenessScore || 0,
        writingScore: categoryEval?.writingScore || 0,
        emotionalScore: categoryEval?.emotionalScore || 0
      });
    }
    
    return {
      ...report,
      review: reviewDetail,
      categoryScores
    };
  }
  
  async getReportForReview(reviewId: number): Promise<Report | undefined> {
    return Array.from(this.reports.values()).find(
      (report) => report.reviewId === reviewId
    );
  }
  
  async createReport(report: InsertReport): Promise<Report> {
    const id = this.reportIdCounter++;
    const now = new Date().toISOString();
    
    const newReport: Report = {
      ...report,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    this.reports.set(id, newReport);
    return newReport;
  }
  
  async updateReport(id: number, reportUpdate: Partial<InsertReport>): Promise<Report> {
    const report = this.reports.get(id);
    if (!report) {
      throw new Error('Report not found');
    }
    
    const updatedReport: Report = {
      ...report,
      ...reportUpdate,
      updatedAt: new Date().toISOString()
    };
    
    this.reports.set(id, updatedReport);
    return updatedReport;
  }
  
  // CUJ Data Sync methods
  async getCujSyncStatus(): Promise<{ lastSync: string, status: string }> {
    return this.cujSyncData;
  }
  
  async syncCujData(): Promise<{ success: boolean, message: string }> {
    // Simulate syncing CUJ data
    // In a real app, this would fetch from an external source
    this.cujSyncData = {
      lastSync: new Date().toISOString(),
      status: "up_to_date"
    };
    
    return {
      success: true,
      message: "CUJ data successfully synchronized"
    };
  }
  
  // Media operations
  private mediaItems: Map<string, MediaItem> = new Map();
  
  async saveMedia(file: {
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    type: 'image' | 'video';
    userId: number;
  }): Promise<MediaItem> {
    const id = `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Use relative paths which are more reliable across different environments
    const url = `/uploads/${file.filename}`;
    
    // Create thumbnail URL for images (in a real implementation, this would generate a thumbnail)
    const thumbnailUrl = file.type === 'image' ? url : undefined;
    
    const mediaItem: MediaItem = {
      id,
      type: file.type,
      url,
      thumbnailUrl,
      createdAt: new Date().toISOString()
    };
    
    this.mediaItems.set(id, mediaItem);
    return mediaItem;
  }
  
  async getMediaItem(id: string): Promise<MediaItem | undefined> {
    return this.mediaItems.get(id);
  }
  
  async deleteMedia(id: string, userId: number): Promise<boolean> {
    const item = this.mediaItems.get(id);
    if (!item) {
      return false;
    }
    
    try {
      // Extract the filename from the URL (handle both absolute and relative URLs)
      let filename: string | undefined;
      
      if (item.url.startsWith('http')) {
        // For absolute URLs
        const urlPath = new URL(item.url).pathname;
        filename = urlPath.split('/').pop();
      } else {
        // For relative URLs like "/uploads/filename.jpg"
        filename = item.url.split('/').pop();
      }
      
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
}

export const storage = new MemStorage();
