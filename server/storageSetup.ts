import { storage } from './storage';
import { createTestStorage } from './testData';
import { InsertTaskEvaluation, InsertCategoryEvaluation, Car, Task, CujCategory, Cuj } from '../shared/schema';

// Export a function to initialize the storage with test data
export async function initializeStorageWithTestData() {
  // Create test storage
  const testStorage = createTestStorage();
  
  // Copy all data from test storage to our main storage instance
  Object.assign(storage, testStorage);

  // Now let's add some evaluations for BMW i7 (review2)
  await addBMWi7Evaluations();
  
  console.log('Storage initialized with test data');
  console.log(`Tasks, CUJs, and categories added to storage`);
}

// Function to add test evaluations for BMW i7
async function addBMWi7Evaluations() {
  // Find BMW i7 review
  const allReviews = await storage.getAllReviews();
  let bmwReview = allReviews.find(review => review.car.make === "BMW" && review.car.model === "i7");
  
  if (!bmwReview) {
    console.log("BMW i7 review not found");
    return;
  }

  // Set status to in_progress
  await storage.updateReviewStatus(bmwReview.id, "in_progress");
  const bmwReviewId = bmwReview.id;

  // Get all tasks
  const allTasks = await storage.getTasksForReview(bmwReviewId);
  
  // Get all categories
  const allCategories = await storage.getAllCujCategories();
  
  // Process navigation tasks
  const navigationTasks = allTasks.filter(task => 
    task.cuj && task.cuj.category && task.cuj.category.name === "Navigation"
  );

  // Add evaluations for navigation tasks (high scores)
  for (const task of navigationTasks) {
    const taskEval: InsertTaskEvaluation = {
      reviewId: bmwReviewId,
      taskId: task.id,
      doable: true,
      usabilityScore: Math.floor(Math.random() * 2) + 3, // 3 or 4
      visualsScore: Math.floor(Math.random() * 2) + 3, // 3 or 4
      media: []
    };

    await storage.createTaskEvaluation(taskEval);
  }

  // Process media tasks
  const mediaTasks = allTasks.filter(task => 
    task.cuj && task.cuj.category && task.cuj.category.name === "Media"
  );

  // Add evaluations for media tasks (mixed scores)
  for (const task of mediaTasks) {
    const taskEval: InsertTaskEvaluation = {
      reviewId: bmwReviewId,
      taskId: task.id,
      doable: task.id % 5 === 0 ? false : true, // Make some tasks not doable
      usabilityScore: Math.floor(Math.random() * 3) + 2, // 2, 3, or 4
      visualsScore: Math.floor(Math.random() * 3) + 2, // 2, 3, or 4
      media: []
    };

    await storage.createTaskEvaluation(taskEval);
  }

  // Process communication tasks
  const commTasks = allTasks.filter(task => 
    task.cuj && task.cuj.category && task.cuj.category.name === "Communications"
  );

  // Add evaluations for communication tasks (lower scores)
  for (const task of commTasks) {
    const taskEval: InsertTaskEvaluation = {
      reviewId: bmwReviewId,
      taskId: task.id,
      doable: true,
      usabilityScore: Math.floor(Math.random() * 2) + 1, // 1 or 2
      visualsScore: Math.floor(Math.random() * 2) + 2, // 2 or 3
      media: []
    };

    await storage.createTaskEvaluation(taskEval);
  }

  // Add category evaluations
  for (const category of allCategories) {
    let catEval: InsertCategoryEvaluation;
    
    if (category.name === "Navigation") {
      catEval = {
        reviewId: bmwReviewId,
        categoryId: category.id,
        responsivenessScore: 4,
        writingScore: 4,
        emotionalScore: 3,
        media: []
      };
    } else if (category.name === "Media") {
      catEval = {
        reviewId: bmwReviewId,
        categoryId: category.id,
        responsivenessScore: 3,
        writingScore: 3,
        emotionalScore: 4,
        media: []
      };
    } else if (category.name === "Communications") {
      catEval = {
        reviewId: bmwReviewId,
        categoryId: category.id,
        responsivenessScore: 2,
        writingScore: 2,
        emotionalScore: 2,
        media: []
      };
    } else {
      catEval = {
        reviewId: bmwReviewId,
        categoryId: category.id,
        responsivenessScore: 3,
        writingScore: 3,
        emotionalScore: 3,
        media: []
      };
    }

    await storage.createCategoryEvaluation(catEval);
  }
}