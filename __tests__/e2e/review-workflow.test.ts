import puppeteer, { Browser, Page } from 'puppeteer';

describe('Review Workflow E2E Tests', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Login as reviewer first
    await page.goto(`${baseUrl}/login`);
    await page.type('input[name="username"]', 'reviewer');
    await page.type('input[name="password"]', 'password');
    
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation()
    ]);
  });

  afterEach(async () => {
    await page.close();
  });

  it('should create a new review', async () => {
    // Navigate to reviewer dashboard
    await page.goto(`${baseUrl}/reviewer`);
    
    // Click 'Create New Review' button
    await page.waitForSelector('button:has-text("Create New Review")');
    await page.click('button:has-text("Create New Review")');
    
    // Fill out the new review form
    await page.waitForSelector('select[name="carId"]');
    await page.select('select[name="carId"]', '1'); // Select first car option
    
    // Submit the form
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation()
    ]);
    
    // Check we're redirected to the review detail page
    const url = page.url();
    expect(url).toContain('/reviewer/review/');
    
    // Check review details are displayed
    await page.waitForSelector('h1:has-text("Review")');
  });

  it('should complete a task evaluation', async () => {
    // First create a review
    await page.goto(`${baseUrl}/reviewer`);
    await page.waitForSelector('button:has-text("Create New Review")');
    await page.click('button:has-text("Create New Review")');
    await page.waitForSelector('select[name="carId"]');
    await page.select('select[name="carId"]', '1');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation()
    ]);
    
    // Wait for the task list to appear
    await page.waitForSelector('.task-list');
    
    // Click on the first task
    await page.click('.task-list .task-item:first-child');
    
    // Wait for task evaluation form
    await page.waitForSelector('form.task-evaluation-form');
    
    // Fill out the evaluation form
    await page.click('input[name="isDoable"][value="true"]');
    await page.waitForSelector('input[name="usabilityRating"]');
    
    // Set ratings using sliders (this will depend on your actual implementation)
    await page.evaluate(() => {
      const usabilitySlider = document.querySelector('input[name="usabilityRating"]') as HTMLInputElement;
      const interactionSlider = document.querySelector('input[name="interactionRating"]') as HTMLInputElement;
      const visualsSlider = document.querySelector('input[name="visualsRating"]') as HTMLInputElement;
      
      if (usabilitySlider) usabilitySlider.value = '80';
      if (interactionSlider) interactionSlider.value = '75';
      if (visualsSlider) visualsSlider.value = '90';
      
      // Trigger change events
      if (usabilitySlider) usabilitySlider.dispatchEvent(new Event('change', { bubbles: true }));
      if (interactionSlider) interactionSlider.dispatchEvent(new Event('change', { bubbles: true }));
      if (visualsSlider) visualsSlider.dispatchEvent(new Event('change', { bubbles: true }));
    });
    
    // Add notes
    await page.type('textarea[name="notes"]', 'This is a test evaluation note');
    
    // Add feedback item
    await page.type('input[name="feedbackItem"]', 'Test feedback item');
    await page.click('button:has-text("Add Feedback")');
    
    // Submit the evaluation
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation()
    ]);
    
    // Check we're back on the review detail page
    await page.waitForSelector('.task-list');
    
    // Check that the task is marked as completed
    const completedTask = await page.$('.task-list .task-item.completed:first-child');
    expect(completedTask).not.toBeNull();
  });

  it('should complete a category evaluation', async () => {
    // First create a review and complete a task
    await page.goto(`${baseUrl}/reviewer`);
    await page.waitForSelector('button:has-text("Create New Review")');
    await page.click('button:has-text("Create New Review")');
    await page.waitForSelector('select[name="carId"]');
    await page.select('select[name="carId"]', '1');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation()
    ]);
    
    // Navigate to category evaluation
    await page.waitForSelector('.category-list');
    await page.click('.category-list .category-item:first-child');
    
    // Wait for category evaluation form
    await page.waitForSelector('form.category-evaluation-form');
    
    // Fill out the evaluation form
    await page.evaluate(() => {
      const ratingSlider = document.querySelector('input[name="overallRating"]') as HTMLInputElement;
      if (ratingSlider) {
        ratingSlider.value = '85';
        ratingSlider.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // Add strengths
    await page.type('input[name="strengthItem"]', 'Test strength');
    await page.click('button:has-text("Add Strength")');
    
    // Add weaknesses
    await page.type('input[name="weaknessItem"]', 'Test weakness');
    await page.click('button:has-text("Add Weakness")');
    
    // Add opportunities
    await page.type('input[name="opportunityItem"]', 'Test opportunity');
    await page.click('button:has-text("Add Opportunity")');
    
    // Add notes
    await page.type('textarea[name="notes"]', 'This is a test category evaluation note');
    
    // Submit the evaluation
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation()
    ]);
    
    // Check we're back on the review detail page
    await page.waitForSelector('.category-list');
    
    // Check that the category is marked as completed
    const completedCategory = await page.$('.category-list .category-item.completed:first-child');
    expect(completedCategory).not.toBeNull();
  });

  it('should generate a report', async () => {
    // First create a review
    await page.goto(`${baseUrl}/reviewer`);
    await page.waitForSelector('button:has-text("Create New Review")');
    await page.click('button:has-text("Create New Review")');
    await page.waitForSelector('select[name="carId"]');
    await page.select('select[name="carId"]', '1');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation()
    ]);
    
    // Navigate to report page
    await page.waitForSelector('a:has-text("Generate Report")');
    await Promise.all([
      page.click('a:has-text("Generate Report")'),
      page.waitForNavigation()
    ]);
    
    // Wait for report form
    await page.waitForSelector('form.report-form');
    
    // Fill out the report form
    await page.type('textarea[name="summary"]', 'This is a test report summary');
    
    // Add recommendation
    await page.type('input[name="recommendationItem"]', 'Test recommendation');
    await page.click('button:has-text("Add Recommendation")');
    
    // Select export format
    await page.select('select[name="exportFormat"]', 'docx');
    
    // Generate the report
    const [downloadButton] = await Promise.all([
      page.waitForSelector('a:has-text("Download Report")'),
      page.click('button:has-text("Generate Report")')
    ]);
    
    // Check that download button appears
    expect(downloadButton).not.toBeNull();
  });
});