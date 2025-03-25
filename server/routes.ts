import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import memoryStore from "memorystore";
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

// Setup memory store for sessions
const MemoryStore = memoryStore(session);

export async function registerRoutes(app: Express): Promise<Server> {
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
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).send('Unauthorized');
  };
  
  // Role-based authorization middleware
  const hasRole = (roles: string[]) => {
    return (req: any, res: any, next: any) => {
      if (!req.isAuthenticated()) {
        return res.status(401).send('Unauthorized');
      }
      
      if (!roles.includes(req.user.role)) {
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
  app.get('/api/reviews', isAuthenticated, async (req, res) => {
    const reviewerId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
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
    
    // Check if user has access to this review
    if (req.user.role !== 'admin' && review.reviewerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to update this review' });
    }
    
    try {
      // Only allow updating the status
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
      
      const updatedReview = await storage.updateReviewStatus(reviewId, status);
      res.json(updatedReview);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });
  
  app.post('/api/reviews', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const reviewData = insertReviewSchema.parse(req.body);
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
    if (req.user.role !== 'admin' && review.reviewerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to view this review' });
    }
    
    try {
      const tasks = await storage.getTasksForReview(reviewId);
      const completedTaskIds = await storage.getCompletedTaskIds(reviewId);
      
      res.json({ tasks, completedTaskIds });
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
  
  app.post('/api/admin/sync-cuj-data', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const result = await storage.syncCujData();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}
