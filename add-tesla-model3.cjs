// Script to add a Tesla Model 3 to the database
const { storage } = require('./server/storage');

async function addTeslaModel3() {
  try {
    const teslaModel3 = {
      make: 'Tesla',
      model: 'Model 3',
      year: 2023,
      androidVersion: '12',
      buildFingerprint: 'tesla/model3/autopilot:12/TM3V.2023.44.25.2/factory-keys',
      location: 'Fremont, CA',
      imageUrl: 'https://digitalassets.tesla.com/tesla-contents/image/upload/f_auto,q_auto/Mega-Menu-Vehicles-Model-3.png'
    };
    
    const car = await storage.createCar(teslaModel3);
    console.log('Tesla Model 3 added to database:', car);
    
    // Create a review for this car
    const now = new Date();
    const oneWeekLater = new Date(now);
    oneWeekLater.setDate(oneWeekLater.getDate() + 7);
    
    const review = await storage.createReview({
      carId: car.id,
      reviewerId: 2, // Assuming reviewer ID 2 exists
      status: 'in_progress',
      startDate: now,
      endDate: oneWeekLater
    });
    
    console.log('Review created:', review);
    
    // Get all tasks for the review
    const tasks = await storage.getTasksForReview(review.id);
    console.log(`Found ${tasks.length} tasks for review`);
    
    // Create task evaluations for first 10 tasks
    for (const task of tasks.slice(0, 10)) {
      const usabilityScore = Math.floor(Math.random() * 3) + 3; // 3-5
      const visualsScore = Math.floor(Math.random() * 3) + 3; // 3-5
      
      const evaluation = await storage.createTaskEvaluation({
        reviewId: review.id,
        taskId: task.id,
        doable: true,
        undoableReason: null,
        usabilityScore,
        usabilityFeedback: getRandomFeedback('usability'),
        visualsScore,
        visualsFeedback: getRandomFeedback('visuals')
      });
      
      console.log(`Created evaluation for task ${task.id}`);
    }
    
    // Create category evaluations
    for (let categoryId = 1; categoryId <= 4; categoryId++) {
      const responsivenessScore = Math.floor(Math.random() * 2) + 3; // 3-4
      const writingScore = Math.floor(Math.random() * 2) + 3; // 3-4
      const emotionalScore = Math.floor(Math.random() * 2) + 3; // 3-4
      
      const catEval = await storage.createCategoryEvaluation({
        reviewId: review.id,
        categoryId,
        responsivenessScore,
        responsivenessFeedback: 'System responds quickly to user input with minimal lag',
        writingScore,
        writingFeedback: 'Text is clear and easy to understand',
        emotionalScore,
        emotionalFeedback: 'Interface feels premium and consistent with Tesla brand'
      });
      
      console.log(`Created evaluation for category ${categoryId}`);
    }
    
    return { car, review };
  } catch (error) {
    console.error('Error adding Tesla Model 3:', error);
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
addTeslaModel3().then(({ car, review }) => {
  console.log(`Successfully added Tesla Model 3 (ID: ${car.id}) and created review (ID: ${review.id})`);
  process.exit(0);
}).catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});