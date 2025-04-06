import supertest from 'supertest';
import { createServer } from '../../server/index';
import { Express } from 'express';

describe('Reviews API Tests', () => {
  let server: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let authCookie: string[];
  let reviewId: number;

  beforeAll(async () => {
    server = await createServer();
    request = supertest(server);

    // Login as reviewer to get auth cookie
    const loginResponse = await request
      .post('/api/auth/login')
      .send({
        username: 'reviewer',
        password: 'password',
      });

    authCookie = loginResponse.headers['set-cookie'];
  });

  describe('Review Creation', () => {
    it('should create a new review', async () => {
      const response = await request
        .post('/api/reviews')
        .set('Cookie', authCookie)
        .send({
          carId: 1,
          reviewerId: 2, // Reviewer user ID
          status: 'draft',
          isPublished: false
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('carId', 1);
      expect(response.body).toHaveProperty('reviewerId', 2);
      expect(response.body).toHaveProperty('status', 'draft');
      expect(response.body).toHaveProperty('isPublished', false);
      
      // Save the review ID for later tests
      reviewId = response.body.id;
    });
  });

  describe('Review Retrieval', () => {
    it('should get all reviews', async () => {
      const response = await request
        .get('/api/reviews')
        .set('Cookie', authCookie)
        .expect(200);

      expect(Array.isArray(response.body)).toBeTruthy();
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should get a specific review by ID', async () => {
      const response = await request
        .get(`/api/reviews/${reviewId}`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body).toHaveProperty('id', reviewId);
      expect(response.body).toHaveProperty('carId', 1);
      expect(response.body).toHaveProperty('reviewerId', 2);
    });
  });

  describe('Review Update', () => {
    it('should update review status', async () => {
      const response = await request
        .patch(`/api/reviews/${reviewId}/status`)
        .set('Cookie', authCookie)
        .send({
          status: 'in_progress'
        })
        .expect(200);

      expect(response.body).toHaveProperty('id', reviewId);
      expect(response.body).toHaveProperty('status', 'in_progress');
    });

    it('should publish a review', async () => {
      const response = await request
        .patch(`/api/reviews/${reviewId}`)
        .set('Cookie', authCookie)
        .send({
          isPublished: true,
          lastModifiedById: 2 // Reviewer user ID
        })
        .expect(200);

      expect(response.body).toHaveProperty('id', reviewId);
      expect(response.body).toHaveProperty('isPublished', true);
    });
  });

  describe('Task Evaluations', () => {
    it('should create a task evaluation for a review', async () => {
      const response = await request
        .post('/api/task-evaluations')
        .set('Cookie', authCookie)
        .send({
          reviewId: reviewId,
          taskId: 1,
          isDoable: true,
          usabilityRating: 80,
          interactionRating: 75,
          visualsRating: 90,
          notes: 'Test task evaluation notes',
          mediaIds: [],
          feedbackItems: ['Test feedback item']
        })
        .expect(200);

      expect(response.body).toHaveProperty('reviewId', reviewId);
      expect(response.body).toHaveProperty('taskId', 1);
      expect(response.body).toHaveProperty('isDoable', true);
      expect(response.body).toHaveProperty('usabilityRating', 80);
      expect(response.body).toHaveProperty('interactionRating', 75);
      expect(response.body).toHaveProperty('visualsRating', 90);
    });

    it('should get task evaluations for a review', async () => {
      const response = await request
        .get(`/api/reviews/${reviewId}/task-evaluations`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(Array.isArray(response.body)).toBeTruthy();
      expect(response.body.length).toBeGreaterThan(0);
      
      const evaluation = response.body[0];
      expect(evaluation).toHaveProperty('reviewId', reviewId);
      expect(evaluation).toHaveProperty('taskId', 1);
    });
  });

  describe('Category Evaluations', () => {
    it('should create a category evaluation for a review', async () => {
      const response = await request
        .post('/api/category-evaluations')
        .set('Cookie', authCookie)
        .send({
          reviewId: reviewId,
          categoryId: 1,
          strengths: ['Test strength 1', 'Test strength 2'],
          weaknesses: ['Test weakness 1'],
          opportunities: ['Test opportunity 1'],
          overallRating: 85,
          notes: 'Test category evaluation notes'
        })
        .expect(200);

      expect(response.body).toHaveProperty('reviewId', reviewId);
      expect(response.body).toHaveProperty('categoryId', 1);
      expect(response.body).toHaveProperty('overallRating', 85);
    });

    it('should get category evaluations for a review', async () => {
      const response = await request
        .get(`/api/reviews/${reviewId}/category-evaluations`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(Array.isArray(response.body)).toBeTruthy();
      expect(response.body.length).toBeGreaterThan(0);
      
      const evaluation = response.body[0];
      expect(evaluation).toHaveProperty('reviewId', reviewId);
      expect(evaluation).toHaveProperty('categoryId', 1);
    });
  });

  describe('Report Creation', () => {
    it('should create a report for a review', async () => {
      const response = await request
        .post('/api/reports')
        .set('Cookie', authCookie)
        .send({
          reviewId: reviewId,
          summary: 'Test report summary',
          recommendations: ['Test recommendation 1', 'Test recommendation 2'],
          overallScore: 80,
          categoryScores: [{ categoryId: 1, score: 85 }],
          exportFormat: 'docx',
          createdById: 2 // Reviewer user ID
        })
        .expect(200);

      expect(response.body).toHaveProperty('reviewId', reviewId);
      expect(response.body).toHaveProperty('summary', 'Test report summary');
      expect(response.body).toHaveProperty('overallScore', 80);
    });

    it('should get a report for a review', async () => {
      const response = await request
        .get(`/api/reviews/${reviewId}/report`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body).toHaveProperty('reviewId', reviewId);
      expect(response.body).toHaveProperty('summary', 'Test report summary');
      expect(response.body).toHaveProperty('overallScore', 80);
    });
  });
});