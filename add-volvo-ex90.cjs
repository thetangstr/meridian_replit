const { Client } = require('pg');
require('dotenv').config();

async function addVolvoEX90WithTestData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');

    // First, create test users if they don't exist
    // Check if the admin user exists
    const checkAdminResult = await client.query(
      'SELECT * FROM users WHERE username = $1',
      ['admin']
    );

    let adminId;
    if (checkAdminResult.rows.length === 0) {
      // Create the admin user
      const adminResult = await client.query(
        `INSERT INTO users (username, password, name, role) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ['admin', 'password123', 'Admin User', 'admin']
      );
      adminId = adminResult.rows[0].id;
      console.log(`Created new admin user with ID: ${adminId}`);
    } else {
      adminId = checkAdminResult.rows[0].id;
      console.log(`Using existing admin user with ID: ${adminId}`);
    }

    // Check if the reviewer user exists
    const checkReviewerResult = await client.query(
      'SELECT * FROM users WHERE username = $1',
      ['reviewer']
    );

    let reviewerId;
    if (checkReviewerResult.rows.length === 0) {
      // Create the reviewer user
      const reviewerResult = await client.query(
        `INSERT INTO users (username, password, name, role) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ['reviewer', 'password123', 'Reviewer User', 'reviewer']
      );
      reviewerId = reviewerResult.rows[0].id;
      console.log(`Created new reviewer user with ID: ${reviewerId}`);
    } else {
      reviewerId = checkReviewerResult.rows[0].id;
      console.log(`Using existing reviewer user with ID: ${reviewerId}`);
    }
    
    // Create CUJ Categories if they don't exist
    const categories = [
      { name: 'Navigation', description: 'Tasks related to navigation and maps' },
      { name: 'Voice Control', description: 'Tasks related to voice commands and control' },
      { name: 'Media', description: 'Tasks related to media playback and control' },
      { name: 'Climate', description: 'Tasks related to climate control' },
      { name: 'Phone', description: 'Tasks related to phone connectivity and calls' }
    ];
    
    const categoryIds = {};
    
    for (const category of categories) {
      // Check if category exists
      const checkCategoryResult = await client.query(
        'SELECT * FROM cuj_categories WHERE name = $1',
        [category.name]
      );
      
      let categoryId;
      if (checkCategoryResult.rows.length === 0) {
        // Create the category
        const categoryResult = await client.query(
          `INSERT INTO cuj_categories (name, description) 
           VALUES ($1, $2) RETURNING id`,
          [category.name, category.description]
        );
        categoryId = categoryResult.rows[0].id;
        console.log(`Created new category ${category.name} with ID: ${categoryId}`);
      } else {
        categoryId = checkCategoryResult.rows[0].id;
        console.log(`Using existing category ${category.name} with ID: ${categoryId}`);
      }
      
      categoryIds[category.name] = categoryId;
    }
    
    // Create CUJs if they don't exist
    const cujs = [
      { 
        category_id: categoryIds['Navigation'], 
        name: 'Enter Destination', 
        description: 'User enters a destination in the navigation system'
      },
      { 
        category_id: categoryIds['Voice Control'], 
        name: 'Voice Commands', 
        description: 'User interacts with the system using voice commands'
      },
      { 
        category_id: categoryIds['Media'], 
        name: 'Music Playback', 
        description: 'User plays and controls music'
      }
    ];
    
    const cujIds = {};
    
    for (const cuj of cujs) {
      // Check if CUJ exists
      const checkCujResult = await client.query(
        'SELECT * FROM cujs WHERE name = $1 AND category_id = $2',
        [cuj.name, cuj.category_id]
      );
      
      let cujId;
      if (checkCujResult.rows.length === 0) {
        // Create the CUJ
        const cujResult = await client.query(
          `INSERT INTO cujs (category_id, name, description) 
           VALUES ($1, $2, $3) RETURNING id`,
          [cuj.category_id, cuj.name, cuj.description]
        );
        cujId = cujResult.rows[0].id;
        console.log(`Created new CUJ ${cuj.name} with ID: ${cujId}`);
      } else {
        cujId = checkCujResult.rows[0].id;
        console.log(`Using existing CUJ ${cuj.name} with ID: ${cujId}`);
      }
      
      cujIds[cuj.name] = cujId;
    }
    
    // Create Tasks if they don't exist
    const tasks = [
      {
        cuj_id: cujIds['Enter Destination'],
        name: 'Enter address using keyboard',
        pre_requisites: 'Navigation system is open',
        expected_outcome: 'Address is entered and route is calculated'
      },
      {
        cuj_id: cujIds['Enter Destination'],
        name: 'Enter address using voice',
        pre_requisites: 'Navigation system is open',
        expected_outcome: 'Address is entered and route is calculated'
      },
      {
        cuj_id: cujIds['Voice Commands'],
        name: 'Adjust temperature using voice',
        pre_requisites: 'System is ready for voice commands',
        expected_outcome: 'Temperature is adjusted as requested'
      },
      {
        cuj_id: cujIds['Voice Commands'],
        name: 'Call contact using voice',
        pre_requisites: 'Phone is connected via Bluetooth',
        expected_outcome: 'Call is initiated to the specified contact'
      },
      {
        cuj_id: cujIds['Music Playback'],
        name: 'Play a specific song',
        pre_requisites: 'Media app is open',
        expected_outcome: 'The requested song starts playing'
      },
      {
        cuj_id: cujIds['Music Playback'],
        name: 'Adjust volume',
        pre_requisites: 'Media is playing',
        expected_outcome: 'Volume is adjusted as requested'
      },
      {
        cuj_id: cujIds['Music Playback'],
        name: 'Skip to next track',
        pre_requisites: 'Media is playing',
        expected_outcome: 'Playback advances to the next track'
      },
      {
        cuj_id: cujIds['Enter Destination'],
        name: 'Select destination from recent',
        pre_requisites: 'Navigation system is open',
        expected_outcome: 'Recent destination is selected and route is calculated'
      },
      {
        cuj_id: cujIds['Enter Destination'],
        name: 'Search for POI',
        pre_requisites: 'Navigation system is open',
        expected_outcome: 'POI is found and can be selected as destination'
      },
      {
        cuj_id: cujIds['Voice Commands'],
        name: 'Ask for weather using voice',
        pre_requisites: 'System is ready for voice commands',
        expected_outcome: 'Weather information is displayed or announced'
      }
    ];
    
    const taskIds = {};
    let taskCounter = 1;
    
    for (const task of tasks) {
      // Check if task exists
      const checkTaskResult = await client.query(
        'SELECT * FROM tasks WHERE name = $1 AND cuj_id = $2',
        [task.name, task.cuj_id]
      );
      
      let taskId;
      if (checkTaskResult.rows.length === 0) {
        // Create the task
        const taskResult = await client.query(
          `INSERT INTO tasks (cuj_id, name, prerequisites, expected_outcome) 
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [task.cuj_id, task.name, task.pre_requisites, task.expected_outcome]
        );
        taskId = taskResult.rows[0].id;
        console.log(`Created new task ${task.name} with ID: ${taskId}`);
      } else {
        taskId = checkTaskResult.rows[0].id;
        console.log(`Using existing task ${task.name} with ID: ${taskId}`);
      }
      
      taskIds[taskCounter] = taskId;
      taskCounter++;
    }

    // Check if the Volvo EX90 car already exists
    const checkCarResult = await client.query(
      'SELECT * FROM cars WHERE make = $1 AND model = $2',
      ['Volvo', 'EX90']
    );

    let carId;
    if (checkCarResult.rows.length === 0) {
      // Create the Volvo EX90 car
      const carResult = await client.query(
        `INSERT INTO cars (make, model, year, android_version, build_fingerprint, location, image_url) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        ['Volvo', 'EX90', 2025, 'Android Automotive OS 13', 'volvo/ex90/flagship:13/TP1A.310000.0.0/2024032701:user/release-keys', 'Silicon Valley Test Center', '/volvo-ex90.jpg']
      );
      carId = carResult.rows[0].id;
      console.log(`Created new Volvo EX90 car with ID: ${carId}`);
    } else {
      carId = checkCarResult.rows[0].id;
      console.log(`Using existing Volvo EX90 car with ID: ${carId}`);
    }

    // Create a review for the car
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 14); // 2 weeks in the future

    const reviewResult = await client.query(
      `INSERT INTO reviews (car_id, reviewer_id, status, start_date, end_date, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [carId, reviewerId, 'in_progress', now, endDate, now, now]
    );
    const reviewId = reviewResult.rows[0].id;
    console.log(`Created new review with ID: ${reviewId}`);

    // Create task evaluations for each task we created
    for (let i = 1; i <= Object.keys(taskIds).length; i++) {
      const actualTaskId = taskIds[i];
      console.log(`Creating evaluation for task ID: ${actualTaskId}`);
      
      const usabilityScore = Math.floor(Math.random() * 3) + 2; // Random score between 2-4
      const visualsScore = Math.floor(Math.random() * 3) + 2; // Random score between 2-4
      const doable = Math.random() > 0.1; // 90% chance of being doable
      const media = JSON.stringify([]); // Empty media array
      
      await client.query(
        `INSERT INTO task_evaluations (review_id, task_id, doable, undoable_reason, usability_score, usability_feedback, visuals_score, visuals_feedback, media, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          reviewId, 
          actualTaskId, 
          doable,
          !doable ? 'The feature is not available in this vehicle model.' : null,
          usabilityScore, 
          usabilityScore <= 2 ? 'The interface could be improved with clearer controls and more consistent behavior.' : null,
          visualsScore,
          visualsScore <= 2 ? 'The visual elements need better contrast and clearer status indicators.' : null,
          media, // Empty media array
          now, 
          now
        ]
      );
    }
    console.log(`Added ${Object.keys(taskIds).length} task evaluations`);

    // Create category evaluations for our categories
    const categoriesToEvaluate = ['Navigation', 'Voice Control'];
    
    for (const categoryName of categoriesToEvaluate) {
      const actualCategoryId = categoryIds[categoryName];
      console.log(`Creating evaluation for category ID: ${actualCategoryId} (${categoryName})`);
      
      const responsivenessScore = Math.floor(Math.random() * 2) + 3; // Random score between 3-4
      const writingScore = Math.floor(Math.random() * 2) + 3; // Random score between 3-4
      const emotionalScore = Math.floor(Math.random() * 3) + 2; // Random score between 2-4
      const media = JSON.stringify([]); // Empty media array
      
      await client.query(
        `INSERT INTO category_evaluations (review_id, category_id, responsiveness_score, responsiveness_feedback, writing_score, writing_feedback, emotional_score, emotional_feedback, media, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          reviewId, 
          actualCategoryId, 
          responsivenessScore, 
          'System response time is generally good but could be faster in certain scenarios.',
          writingScore,
          'Text is clear and well-written, with a consistent tone.',
          emotionalScore,
          emotionalScore <= 2 ? 'The emotional experience feels somewhat sterile and could benefit from more warmth.' : 'Good emotional response, creates a pleasant user experience.',
          media, // Empty media array
          now, 
          now
        ]
      );
    }
    console.log(`Added ${categoriesToEvaluate.length} category evaluations`);

    // Create a report for the review
    const topIssues = JSON.stringify([
      { category: 'Navigation', description: 'Map zooming is inconsistent and sometimes difficult to control.' },
      { category: 'Voice Control', description: 'System occasionally fails to recognize complex commands in noisy conditions.' },
      { category: 'Responsiveness', description: 'Slight lag when switching between multiple applications quickly.' }
    ]);
    
    await client.query(
      `INSERT INTO reports (review_id, overall_score, top_likes, top_hates, benchmark_rank, benchmark_comparison, top_issues, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        reviewId,
        82.5, // overall score out of 100
        'Intuitive voice control system that understands natural language commands',
        'Climate controls are two levels deep in the menu system, making quick adjustments cumbersome',
        3, // benchmark rank
        'better', // benchmark comparison (better, worse)
        topIssues,
        now,
        now
      ]
    );
    console.log('Created report for the review');

    console.log('Successfully added Volvo EX90 with test evaluation data');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('Disconnected from PostgreSQL database');
  }
}

addVolvoEX90WithTestData();