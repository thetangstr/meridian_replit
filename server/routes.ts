import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initializeStorageWithTestData } from "./storageSetup";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import memoryStore from "memorystore";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { 
  insertUserSchema, 
  insertTaskEvaluationSchema, 
  insertCategoryEvaluationSchema,
  insertScoringConfigSchema,
  insertReportSchema,
  insertCarSchema,
  insertReviewSchema,
  userRoles,
  scoringConfig
} from "@shared/schema";

// Add User type to Express Request
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      password: string;
      name: string;
      role: string;
    }
  }
}

// Type for requests with authenticated user
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
    password: string;
    name: string;
    role: string;
  };
}

// Setup memory store for sessions
const MemoryStore = memoryStore(session);

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize storage with test data
  initializeStorageWithTestData();
  
  // Add session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'scoreMyCarSecret',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    })
  }));
  
  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Configure local strategy
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      if (user.password !== password) { // In production, use proper password hashing
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
  
  // Serialize and deserialize user
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
  
  // Authentication middleware
  const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).send('Unauthorized');
  };
  
  // Role-based authorization middleware
  const hasRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.isAuthenticated()) {
        return res.status(401).send('Unauthorized');
      }
      
      if (!roles.includes((req as AuthenticatedRequest).user.role)) {
        return res.status(403).send('Forbidden: Insufficient permissions');
      }
      
      next();
    };
  };
  
  // Authentication routes
  app.post('/api/auth/login', passport.authenticate('local'), (req, res) => {
    res.json(req.user);
  });
  
  app.post('/api/auth/logout', (req: any, res, next) => {
    req.logout((err: any) => {
      if (err) return next(err);
      res.status(200).send('Logged out');
    });
  });
  
  app.get('/api/auth/me', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send('Not authenticated');
    }
    res.json(req.user);
  });
  
  // User routes
  app.get('/api/users', isAuthenticated, hasRole(['admin']), async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });
  
  app.post('/api/users', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const newUser = await storage.createUser(userData);
      res.status(201).json(newUser);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
  
  // CUJ Category routes
  app.get('/api/cuj-categories', isAuthenticated, async (req, res) => {
    const categories = await storage.getAllCujCategories();
    res.json(categories);
  });
  
  app.get('/api/cuj-categories/:id', isAuthenticated, async (req, res) => {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    
    const category = await storage.getCujCategory(categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json(category);
  });
  
  // Car routes
  app.get('/api/cars', isAuthenticated, async (req, res) => {
    try {
      const cars = await storage.getAllCars();
      res.json(cars);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  app.get('/api/cars/:id', isAuthenticated, async (req, res) => {
    const carId = parseInt(req.params.id);
    if (isNaN(carId)) {
      return res.status(400).json({ error: 'Invalid car ID' });
    }
    
    try {
      const car = await storage.getCar(carId);
      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }
      res.json(car);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  app.post('/api/cars', isAuthenticated, hasRole(['admin', 'reviewer']), async (req, res) => {
    try {
      const carData = insertCarSchema.parse(req.body);
      const newCar = await storage.createCar(carData);
      res.status(201).json(newCar);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  // Tasks routes
  app.get('/api/tasks/:id', isAuthenticated, async (req, res) => {
    const taskId = parseInt(req.params.id);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }
    
    const task = await storage.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(task);
  });
  
  // Review routes
  app.get('/api/reviews', isAuthenticated, async (req: Request, res: Response) => {
    const authenticatedReq = req as AuthenticatedRequest;
    const reviewerId = authenticatedReq.user.id;
    const isAdmin = authenticatedReq.user.role === 'admin';
    
    // Admin can see all reviews, reviewers only see their own
    const reviews = isAdmin 
      ? await storage.getAllReviews()
      : await storage.getReviewsByReviewer(reviewerId);
    
    res.json(reviews);
  });
  
  app.get('/api/reviews/:id', isAuthenticated, async (req, res) => {
    const reviewId = parseInt(req.params.id);
    if (isNaN(reviewId)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }
    
    const review = await storage.getReview(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    // Check if user has access to this review
    if (req.user.role !== 'admin' && review.reviewerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to view this review' });
    }
    
    res.json(review);
  });
  
  app.patch('/api/reviews/:id', isAuthenticated, hasRole(['admin', 'reviewer']), async (req, res) => {
    const reviewId = parseInt(req.params.id);
    if (isNaN(reviewId)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }
    
    const review = await storage.getReview(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    // Check if user has access to this review (only admins can publish/unpublish)
    const isPublishOperation = req.body.isPublished !== undefined;
    
    if (isPublishOperation && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can publish or unpublish reviews' });
    } else if (!isPublishOperation && req.user.role !== 'admin' && review.reviewerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to update this review' });
    }
    
    try {
      const updateData: { status?: string; isPublished?: boolean } = {};
      
      // Handle status updates
      if (req.body.status) {
        updateData.status = req.body.status;
      }
      
      // Handle publish/unpublish (admin only - already checked above)
      if (isPublishOperation) {
        updateData.isPublished = req.body.isPublished;
      }
      
      // Use the new updateReview method which tracks lastModifiedById
      const updatedReview = await storage.updateReview(
        reviewId, 
        req.user.id, 
        updateData
      );
      
      res.json(updatedReview);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
  
  app.post('/api/reviews', isAuthenticated, hasRole(['admin', 'reviewer']), async (req, res) => {
    try {
      const reviewData = insertReviewSchema.parse(req.body);
      
      // Ensure the reviewerId matches the logged-in user for non-admin users
      if (req.user && req.user.role !== 'admin' && reviewData.reviewerId !== req.user.id) {
        return res.status(403).json({ 
          error: 'You can only create reviews assigned to yourself' 
        });
      }
      
      const newReview = await storage.createReview(reviewData);
      res.status(201).json(newReview);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
  
  // Task evaluations within a review
  app.get('/api/reviews/:reviewId/tasks', isAuthenticated, async (req, res) => {
    const reviewId = parseInt(req.params.reviewId);
    if (isNaN(reviewId)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }
    
    const review = await storage.getReview(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    // Check if user has access to this review
    if (req.user?.role !== 'admin' && review.reviewerId !== req.user?.id) {
      return res.status(403).json({ error: 'You do not have permission to view this review' });
    }
    
    try {
      const tasksWithCategories = await storage.getTasksForReview(reviewId);
      const completedTaskIds = await storage.getCompletedTaskIds(reviewId);
      
      res.json({ tasks: tasksWithCategories, completedTaskIds });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  app.get('/api/reviews/:reviewId/tasks/:taskId/evaluation', isAuthenticated, async (req, res) => {
    const reviewId = parseInt(req.params.reviewId);
    const taskId = parseInt(req.params.taskId);
    
    if (isNaN(reviewId) || isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid ID parameters' });
    }
    
    const review = await storage.getReview(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    // Check if user has access to this review
    if (req.user.role !== 'admin' && review.reviewerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to view this evaluation' });
    }
    
    try {
      const evaluation = await storage.getTaskEvaluation(reviewId, taskId);
      if (!evaluation) {
        return res.status(404).json({ error: 'Evaluation not found' });
      }
      
      res.json(evaluation);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  app.post('/api/reviews/:reviewId/tasks/:taskId/evaluation', isAuthenticated, hasRole(['admin', 'reviewer']), async (req, res) => {
    const reviewId = parseInt(req.params.reviewId);
    const taskId = parseInt(req.params.taskId);
    
    if (isNaN(reviewId) || isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid ID parameters' });
    }
    
    const review = await storage.getReview(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    // Check if user has access to this review
    if (req.user.role !== 'admin' && review.reviewerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to add evaluations to this review' });
    }
    
    try {
      const evaluationData = insertTaskEvaluationSchema.parse({
        ...req.body,
        reviewId,
        taskId
      });
      
      const evaluation = await storage.createTaskEvaluation(evaluationData);
      res.status(201).json(evaluation);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
  
  app.put('/api/reviews/:reviewId/tasks/:taskId/evaluation', isAuthenticated, hasRole(['admin', 'reviewer']), async (req, res) => {
    const reviewId = parseInt(req.params.reviewId);
    const taskId = parseInt(req.params.taskId);
    
    if (isNaN(reviewId) || isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid ID parameters' });
    }
    
    const review = await storage.getReview(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    // Check if user has access to this review
    if (req.user.role !== 'admin' && review.reviewerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to update evaluations in this review' });
    }
    
    try {
      const evaluationData = insertTaskEvaluationSchema.parse({
        ...req.body,
        reviewId,
        taskId
      });
      
      const evaluation = await storage.updateTaskEvaluation(reviewId, taskId, evaluationData);
      res.json(evaluation);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
  
  // Category evaluations within a review
  app.get('/api/reviews/:reviewId/categories/:categoryId/evaluation', isAuthenticated, async (req, res) => {
    const reviewId = parseInt(req.params.reviewId);
    const categoryId = parseInt(req.params.categoryId);
    
    if (isNaN(reviewId) || isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid ID parameters' });
    }
    
    const review = await storage.getReview(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    // Check if user has access to this review
    if (req.user.role !== 'admin' && review.reviewerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to view this evaluation' });
    }
    
    try {
      const evaluation = await storage.getCategoryEvaluation(reviewId, categoryId);
      if (!evaluation) {
        return res.status(404).json({ error: 'Evaluation not found' });
      }
      
      res.json(evaluation);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  app.post('/api/reviews/:reviewId/categories/:categoryId/evaluation', isAuthenticated, hasRole(['admin', 'reviewer']), async (req, res) => {
    const reviewId = parseInt(req.params.reviewId);
    const categoryId = parseInt(req.params.categoryId);
    
    if (isNaN(reviewId) || isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid ID parameters' });
    }
    
    const review = await storage.getReview(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    // Check if user has access to this review
    if (req.user.role !== 'admin' && review.reviewerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to add evaluations to this review' });
    }
    
    try {
      const evaluationData = insertCategoryEvaluationSchema.parse({
        ...req.body,
        reviewId,
        categoryId
      });
      
      const evaluation = await storage.createCategoryEvaluation(evaluationData);
      res.status(201).json(evaluation);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
  
  app.put('/api/reviews/:reviewId/categories/:categoryId/evaluation', isAuthenticated, hasRole(['admin', 'reviewer']), async (req, res) => {
    const reviewId = parseInt(req.params.reviewId);
    const categoryId = parseInt(req.params.categoryId);
    
    if (isNaN(reviewId) || isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid ID parameters' });
    }
    
    const review = await storage.getReview(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    // Check if user has access to this review
    if (req.user.role !== 'admin' && review.reviewerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to update evaluations in this review' });
    }
    
    try {
      const evaluationData = insertCategoryEvaluationSchema.parse({
        ...req.body,
        reviewId,
        categoryId
      });
      
      const evaluation = await storage.updateCategoryEvaluation(reviewId, categoryId, evaluationData);
      res.json(evaluation);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
  
  // Get all task evaluations for a review
  app.get('/api/reviews/:reviewId/task-evaluations', isAuthenticated, async (req, res) => {
    const reviewId = parseInt(req.params.reviewId);
    
    if (isNaN(reviewId)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }
    
    const review = await storage.getReview(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    // Check if user has access to this review
    if (req.user.role !== 'admin' && review.reviewerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to view this review' });
    }
    
    try {
      const taskEvaluations = await storage.getTaskEvaluationsForReview(reviewId);
      res.json(taskEvaluations);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Get all category evaluations for a review
  app.get('/api/reviews/:reviewId/category-evaluations', isAuthenticated, async (req, res) => {
    const reviewId = parseInt(req.params.reviewId);
    
    if (isNaN(reviewId)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }
    
    const review = await storage.getReview(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    // Check if user has access to this review
    if (req.user.role !== 'admin' && review.reviewerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to view this review' });
    }
    
    try {
      const categoryEvaluations = await storage.getCategoryEvaluationsForReview(reviewId);
      
      // Log what we're sending back for debugging
      console.log(`[express] GET /api/reviews/${reviewId}/category-evaluations returning ${categoryEvaluations.length} evaluations:`);
      console.log(JSON.stringify(categoryEvaluations, null, 2).substring(0, 200) + '...');
      
      res.json(categoryEvaluations);
    } catch (error) {
      console.error(`[express] Error getting category evaluations:`, error);
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Report routes
  app.get('/api/reports/:id', isAuthenticated, async (req, res) => {
    const reportId = parseInt(req.params.id);
    if (isNaN(reportId)) {
      return res.status(400).json({ error: 'Invalid report ID' });
    }
    
    try {
      const report = await storage.getReport(reportId);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }
      
      // If not admin or internal, return limited details
      if (req.user.role === 'external') {
        // Filter sensitive information for external users
        const limitedReport = {
          ...report,
          topIssues: [],
          topHates: null,
          benchmarkRank: null,
          benchmarkComparison: null
        };
        return res.json(limitedReport);
      }
      
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Admin routes
  app.get('/api/admin/scoring-config', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const config = await storage.getScoringConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  app.patch('/api/admin/scoring-config/task', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const { doableWeight, usabilityWeight, visualsWeight } = req.body;
      
      const configData = {
        taskDoableWeight: doableWeight,
        taskUsabilityWeight: usabilityWeight,
        taskVisualsWeight: visualsWeight,
        updatedBy: req.user.id
      };
      
      const updatedConfig = await storage.updateTaskScoringConfig(configData);
      res.json(updatedConfig);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
  
  app.patch('/api/admin/scoring-config/category', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const { taskAvgWeight, responsivenessWeight, writingWeight, emotionalWeight } = req.body;
      
      const configData = {
        categoryTasksWeight: taskAvgWeight,
        categoryResponsivenessWeight: responsivenessWeight,
        categoryWritingWeight: writingWeight,
        categoryEmotionalWeight: emotionalWeight,
        updatedBy: req.user.id
      };
      
      const updatedConfig = await storage.updateCategoryScoringConfig(configData);
      res.json(updatedConfig);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
  
  app.get('/api/admin/cuj-sync-status', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const status = await storage.getCujSyncStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  // CUJ Database Version routes
  app.get('/api/cuj-database-versions', isAuthenticated, async (req, res) => {
    try {
      const versions = await storage.getAllCujDatabaseVersions();
      res.json(versions);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  app.get('/api/cuj-database-versions/active', isAuthenticated, async (req, res) => {
    try {
      const activeVersion = await storage.getActiveCujDatabaseVersion();
      if (!activeVersion) {
        return res.status(404).json({ error: "No active CUJ database version found" });
      }
      res.json(activeVersion);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  app.post('/api/cuj-database-versions', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const versionData = req.body;
      
      // Add the current user's ID as the creator
      versionData.createdBy = (req as AuthenticatedRequest).user.id;
      
      const newVersion = await storage.createCujDatabaseVersion(versionData);
      res.status(201).json(newVersion);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  app.post('/api/cuj-database-versions/:id/set-active', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }
      
      const updatedVersion = await storage.setActiveCujDatabaseVersion(id);
      res.json(updatedVersion);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  app.post('/api/admin/sync-cuj-data', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const result = await storage.syncCujData();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Set up media upload directory and config
  const uploadsDir = path.join(process.cwd(), 'public/uploads');
  
  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  // Configure multer for file uploads
  const multerStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
      // Create a unique filename with original extension
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueSuffix}${ext}`);
    }
  });
  
  const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed'));
    }
  };
  
  const upload = multer({ 
    storage: multerStorage,
    fileFilter,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max file size
    }
  });
  
  // Media upload endpoint - Not requiring authentication for testing purposes
  app.post('/api/media/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const file = req.file;
      const isVideo = file.mimetype.startsWith('video/');
      
      const mediaData = {
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        type: isVideo ? 'video' as const : 'image' as const,
        userId: req.user?.id || 1 // Default to user ID 1 if not authenticated
      };
      
      const mediaItem = await storage.saveMedia(mediaData);
      res.status(201).json(mediaItem);
    } catch (error) {
      console.error('Media upload error:', error);
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Get media item endpoint - Not requiring authentication for testing purposes
  app.get('/api/media/:id', async (req, res) => {
    try {
      const mediaId = req.params.id;
      const mediaItem = await storage.getMediaItem(mediaId);
      
      if (!mediaItem) {
        return res.status(404).json({ error: 'Media item not found' });
      }
      
      res.json(mediaItem);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Delete media item endpoint - Not requiring authentication for testing purposes
  app.delete('/api/media/:id', async (req, res) => {
    try {
      const mediaId = req.params.id;
      const userId = req.user?.id || 1; // Default to user ID 1 if not authenticated
      
      const success = await storage.deleteMedia(mediaId, userId);
      
      if (!success) {
        return res.status(404).json({ error: 'Media item not found or unauthorized' });
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Serve uploaded files
  app.use('/uploads', express.static(uploadsDir));
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}
