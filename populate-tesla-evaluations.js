// Script to add a Tesla Model 3 with evaluations
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

import { 
  cars, 
  reviews, 
  taskEvaluations, 
  categoryEvaluations,
  users,
  tasks,
  cujCategories
} from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function populateTeslaEvaluations() {
  try {
    console.log('Creating Tesla Model 3...');
    // Create Tesla Model 3
    const [car] = await db.insert(cars).values({
      make: 'Tesla',
      model: 'Model 3',
      year: 2023,
      androidVersion: '12',
      buildFingerprint: 'tesla/model3/autopilot:12/TM3V.2023.44.25.2/factory-keys',
      location: 'Fremont, CA',
      imageUrl: 'https://digitalassets.tesla.com/tesla-contents/image/upload/f_auto,q_auto/Mega-Menu-Vehicles-Model-3.png'
    }).returning();
    
    console.log('Created car:', car);
    
    // Get reviewer
    const [reviewer] = await db.select().from(users).where(eq(users.role, 'reviewer')).limit(1);
    
    if (!reviewer) {
      throw new Error('No reviewer found in the database');
    }
    
    console.log('Using reviewer:', reviewer.name);
    
    // Create a review
    const now = new Date();
    const oneWeekLater = new Date(now);
    oneWeekLater.setDate(oneWeekLater.getDate() + 7);
    
    const [review] = await db.insert(reviews).values({
      carId: car.id,
      reviewerId: reviewer.id,
      status: 'in_progress',
      startDate: now,
      endDate: oneWeekLater,
      isPublished: false
    }).returning();
    
    console.log('Created review:', review);
    
    // Get all tasks
    const allTasks = await db.select().from(tasks).limit(20);
    console.log(`Found ${allTasks.length} tasks`);
    
    // Create task evaluations for each task (first 10)
    for (const task of allTasks.slice(0, 10)) {
      const usabilityScore = Math.floor(Math.random() * 3) + 3; // 3-5
      const visualsScore = Math.floor(Math.random() * 3) + 3; // 3-5
      
      const [evaluation] = await db.insert(taskEvaluations).values({
        reviewId: review.id,
        taskId: task.id,
        doable: true,
        undoableReason: null,
        usabilityScore,
        usabilityFeedback: getRandomFeedback('usability'),
        visualsScore,
        visualsFeedback: getRandomFeedback('visuals')
      }).returning();
      
      console.log(`Created evaluation for task ${task.id}`);
    }
    
    // Get all categories
    const allCategories = await db.select().from(cujCategories);
    console.log(`Found ${allCategories.length} categories`);
    
    // Create category evaluations
    for (const category of allCategories) {
      const responsivenessScore = Math.floor(Math.random() * 2) + 3; // 3-4
      const writingScore = Math.floor(Math.random() * 2) + 3; // 3-4
      const emotionalScore = Math.floor(Math.random() * 2) + 3; // 3-4
      
      const [catEval] = await db.insert(categoryEvaluations).values({
        reviewId: review.id,
        categoryId: category.id,
        responsivenessScore,
        responsivenessFeedback: 'System responds quickly to user input with minimal lag',
        writingScore,
        writingFeedback: 'Text is clear and easy to understand',
        emotionalScore,
        emotionalFeedback: 'Interface feels premium and consistent with Tesla brand'
      }).returning();
      
      console.log(`Created evaluation for category ${category.id}`);
    }
    
    console.log('Tesla Model 3 data population complete!');
    console.log(`Review ID: ${review.id}`);
    return { car, review };
    
  } catch (error) {
    console.error('Error populating Tesla evaluations:', error);
    throw error;
  }
}

function getRandomFeedback(type) {
  if (type === 'usability') {
    const feedbacks = [
      'Interface is very intuitive and responsive',
      'Controls are well placed and easy to understand',
      'Menus are logically organized with clear navigation',
      'Touch targets are appropriately sized and spaced',
      'System provides clear feedback for user actions'
    ];
    return feedbacks[Math.floor(Math.random() * feedbacks.length)];
  } else if (type === 'visuals') {
    const feedbacks = [
      'Clean design with good contrast and readability',
      'Consistent visual language throughout the interface',
      'Typography is legible at various distances',
      'Color scheme enhances usability without distraction',
      'Icons are recognizable and follow established patterns'
    ];
    return feedbacks[Math.floor(Math.random() * feedbacks.length)];
  }
  return 'Excellent overall';
}

// Execute the function
populateTeslaEvaluations().then(({ car, review }) => {
  console.log(`Successfully added Tesla Model 3 (ID: ${car.id}) and created review (ID: ${review.id})`);
  process.exit(0);
}).catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});