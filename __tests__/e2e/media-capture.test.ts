import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

describe('Media Capture E2E Tests', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream', // Mock camera/mic permissions
        '--use-fake-device-for-media-stream' // Use fake camera/mic
      ]
    });
    
    // Create a test video file for upload testing
    const testDir = path.join(__dirname, '..', 'test-data');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // A very simple MP4 file (just the header)
    const testVideoPath = path.join(testDir, 'test-video.mp4');
    if (!fs.existsSync(testVideoPath)) {
      // This is a minimal valid MP4 file header
      const videoHeader = Buffer.from([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6D, 0x70, 0x34, 0x32,
        0x00, 0x00, 0x00, 0x00, 0x6D, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6F, 0x6D,
        0x00, 0x00, 0x00, 0x08, 0x6D, 0x6F, 0x6F, 0x76
      ]);
      fs.writeFileSync(testVideoPath, videoHeader);
    }
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Grant camera and microphone permissions
    await page.evaluateOnNewDocument(() => {
      // @ts-ignore
      navigator.mediaDevices.getUserMedia = async () => {
        return {
          getTracks: () => [{
            stop: () => {}
          }]
        };
      };
    });
    
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

  it('should navigate to a task evaluation with media capture component', async () => {
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
    
    // Check if media capture component exists
    const mediaCapture = await page.$('.media-capture');
    expect(mediaCapture).not.toBeNull();
  });

  it('should upload a file using the file input', async () => {
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
    
    // Find the file input for uploading
    const fileInput = await page.$('input[type="file"]');
    expect(fileInput).not.toBeNull();
    
    if (fileInput) {
      // Upload the test video file
      const testVideoPath = path.join(__dirname, '..', 'test-data', 'test-video.mp4');
      await fileInput.uploadFile(testVideoPath);
      
      // Wait for upload to complete and media to be added to the list
      await page.waitForSelector('.media-preview');
      
      // Check if media preview exists
      const mediaPreview = await page.$('.media-preview');
      expect(mediaPreview).not.toBeNull();
    }
  });

  it('should fail validation for videos over 2 minutes', async () => {
    // This is a mock test since we can't easily create a real video over 2 minutes
    // We'll simulate this by mocking the file object
    
    // First navigate to a task evaluation
    await page.goto(`${baseUrl}/reviewer`);
    await page.waitForSelector('button:has-text("Create New Review")');
    await page.click('button:has-text("Create New Review")');
    await page.waitForSelector('select[name="carId"]');
    await page.select('select[name="carId"]', '1');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation()
    ]);
    await page.waitForSelector('.task-list');
    await page.click('.task-list .task-item:first-child');
    await page.waitForSelector('form.task-evaluation-form');
    
    // Check if media capture component exists
    const mediaCapture = await page.$('.media-capture');
    expect(mediaCapture).not.toBeNull();
    
    // Simulate a video that's over the duration limit
    await page.evaluate(() => {
      // Create a mock file input change event with a file that has metadata
      // indicating it's over 2 minutes
      const mockFileWithLongDuration = new File(
        [new ArrayBuffer(1000)],
        'long-video.mp4',
        { type: 'video/mp4' }
      );
      
      // @ts-ignore - Attach custom properties to mock metadata
      mockFileWithLongDuration.duration = 121; // 2 minutes + 1 second
      
      // Find the file input and manually trigger its validation
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        // Create a mock change event
        const event = new Event('change', { bubbles: true });
        // @ts-ignore - Add files property to event
        event.target = { files: [mockFileWithLongDuration] };
        fileInput.dispatchEvent(event);
      }
    });
    
    // Wait for error message about video duration
    await page.waitForSelector('.error-message');
    const errorMessage = await page.$eval('.error-message', el => el.textContent);
    expect(errorMessage).toContain('exceeds the maximum allowed duration');
  });
});