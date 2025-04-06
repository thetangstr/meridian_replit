import supertest from 'supertest';
import { createServer } from '../../server/index';
import { Express } from 'express';

describe('CUJ Synchronization Tests', () => {
  let server: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let adminCookie: string[];
  let cujVersionId: number;

  beforeAll(async () => {
    server = await createServer();
    request = supertest(server);

    // Login as admin to get auth cookie
    const loginResponse = await request
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'password',
      });

    adminCookie = loginResponse.headers['set-cookie'];
  });

  describe('CUJ Categories', () => {
    it('should get all CUJ categories', async () => {
      const response = await request
        .get('/api/cuj-categories')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(Array.isArray(response.body)).toBeTruthy();
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('CUJs', () => {
    it('should get CUJs for a category', async () => {
      // Get the first category ID
      const categoriesResponse = await request
        .get('/api/cuj-categories')
        .set('Cookie', adminCookie);
      
      const categoryId = categoriesResponse.body[0].id;
      
      const response = await request
        .get(`/api/cuj-categories/${categoryId}/cujs`)
        .set('Cookie', adminCookie)
        .expect(200);

      expect(Array.isArray(response.body)).toBeTruthy();
    });
  });

  describe('Tasks', () => {
    it('should get tasks for a CUJ', async () => {
      // Get the first category ID
      const categoriesResponse = await request
        .get('/api/cuj-categories')
        .set('Cookie', adminCookie);
      
      const categoryId = categoriesResponse.body[0].id;
      
      // Get the first CUJ for that category
      const cujsResponse = await request
        .get(`/api/cuj-categories/${categoryId}/cujs`)
        .set('Cookie', adminCookie);
      
      if (cujsResponse.body.length > 0) {
        const cujId = cujsResponse.body[0].id;
        
        const response = await request
          .get(`/api/cujs/${cujId}/tasks`)
          .set('Cookie', adminCookie)
          .expect(200);

        expect(Array.isArray(response.body)).toBeTruthy();
      } else {
        console.warn(`No CUJs found for category ${categoryId}, skipping task test`);
      }
    });
  });

  describe('CUJ Database Versions', () => {
    it('should create a new CUJ database version', async () => {
      const response = await request
        .post('/api/cuj-database-versions')
        .set('Cookie', adminCookie)
        .send({
          name: 'Test Version',
          description: 'Test version created by API tests',
          isActive: false,
          createdById: 1 // Admin user ID
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', 'Test Version');
      expect(response.body).toHaveProperty('isActive', false);
      
      // Save the version ID for later tests
      cujVersionId = response.body.id;
    });

    it('should get all CUJ database versions', async () => {
      const response = await request
        .get('/api/cuj-database-versions')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(Array.isArray(response.body)).toBeTruthy();
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should activate a CUJ database version', async () => {
      // Skip test if no version was created
      if (!cujVersionId) {
        console.warn('Skipping version activation test because no version was created');
        return;
      }

      const response = await request
        .post(`/api/cuj-database-versions/${cujVersionId}/activate`)
        .set('Cookie', adminCookie)
        .expect(200);

      expect(response.body).toHaveProperty('id', cujVersionId);
      expect(response.body).toHaveProperty('isActive', true);
    });

    it('should get the active CUJ database version', async () => {
      const response = await request
        .get('/api/cuj-database-versions/active')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(response.body).toHaveProperty('isActive', true);
    });
  });

  describe('CUJ Data Sync', () => {
    it('should get CUJ sync status', async () => {
      const response = await request
        .get('/api/cuj-sync/status')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(response.body).toHaveProperty('lastSync');
      expect(response.body).toHaveProperty('status');
    });

    // Note: Testing the actual sync requires a spreadsheet data source
    // which we can't easily mock in this test
  });
});