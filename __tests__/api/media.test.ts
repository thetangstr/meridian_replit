import supertest from 'supertest';
import { createServer } from '../../server/index';
import { Express } from 'express';
import * as fs from 'fs';
import * as path from 'path';

describe('Media API Tests', () => {
  let server: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let authCookie: string[];
  let uploadedMediaId: string;

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
    
    // Create a test image file if it doesn't exist
    const testDir = path.join(__dirname, '..', 'test-data');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    const testImagePath = path.join(testDir, 'test-image.png');
    if (!fs.existsSync(testImagePath)) {
      // Create a simple 1x1 pixel PNG file for testing
      const simpleImageBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      fs.writeFileSync(testImagePath, simpleImageBuffer);
    }
  });

  describe('Media Upload', () => {
    it('should upload an image file', async () => {
      const testImagePath = path.join(__dirname, '..', 'test-data', 'test-image.png');
      
      const response = await request
        .post('/api/media/upload')
        .set('Cookie', authCookie)
        .attach('file', testImagePath)
        .field('type', 'image')
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('type', 'image');
      
      // Save the media ID for later tests
      uploadedMediaId = response.body.id;
    });
  });

  describe('Media Retrieval', () => {
    it('should get a media item by ID', async () => {
      // Skip test if no media was uploaded
      if (!uploadedMediaId) {
        console.warn('Skipping media retrieval test because no media was uploaded');
        return;
      }

      const response = await request
        .get(`/api/media/${uploadedMediaId}`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body).toHaveProperty('id', uploadedMediaId);
      expect(response.body).toHaveProperty('type', 'image');
      expect(response.body).toHaveProperty('url');
    });
  });

  describe('Media Deletion', () => {
    it('should delete a media item', async () => {
      // Skip test if no media was uploaded
      if (!uploadedMediaId) {
        console.warn('Skipping media deletion test because no media was uploaded');
        return;
      }

      await request
        .delete(`/api/media/${uploadedMediaId}`)
        .set('Cookie', authCookie)
        .expect(200);

      // Verify it's deleted by trying to get it again
      await request
        .get(`/api/media/${uploadedMediaId}`)
        .set('Cookie', authCookie)
        .expect(404);
    });
  });
});