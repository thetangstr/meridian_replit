import puppeteer, { Browser, Page } from 'puppeteer';

describe('Login E2E Tests', () => {
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
    await page.goto(`${baseUrl}/login`);
  });

  afterEach(async () => {
    await page.close();
  });

  it('should display login form', async () => {
    await page.waitForSelector('form');
    
    const usernameInput = await page.$('input[name="username"]');
    const passwordInput = await page.$('input[name="password"]');
    const submitButton = await page.$('button[type="submit"]');
    
    expect(usernameInput).not.toBeNull();
    expect(passwordInput).not.toBeNull();
    expect(submitButton).not.toBeNull();
  });

  it('should login as admin and redirect to admin dashboard', async () => {
    await page.type('input[name="username"]', 'admin');
    await page.type('input[name="password"]', 'password');
    
    // Click submit and wait for navigation
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation()
    ]);
    
    // Check we're on the admin dashboard
    const url = page.url();
    expect(url).toContain('/admin');
    
    // Check for admin dashboard elements
    await page.waitForSelector('h1');
    const heading = await page.$eval('h1', el => el.textContent);
    expect(heading).toContain('Admin Dashboard');
  });

  it('should login as reviewer and redirect to reviewer dashboard', async () => {
    await page.type('input[name="username"]', 'reviewer');
    await page.type('input[name="password"]', 'password');
    
    // Click submit and wait for navigation
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation()
    ]);
    
    // Check we're on the reviewer dashboard
    const url = page.url();
    expect(url).toContain('/reviewer');
    
    // Check for reviewer dashboard elements
    await page.waitForSelector('h1');
    const heading = await page.$eval('h1', el => el.textContent);
    expect(heading).toContain('Reviewer Dashboard');
  });

  it('should show error for invalid credentials', async () => {
    await page.type('input[name="username"]', 'admin');
    await page.type('input[name="password"]', 'wrongpassword');
    
    // Click submit (no navigation expected)
    await page.click('button[type="submit"]');
    
    // Wait for error message
    await page.waitForSelector('[role="alert"]');
    const errorMessage = await page.$eval('[role="alert"]', el => el.textContent);
    expect(errorMessage).toContain('Invalid credentials');
  });
});