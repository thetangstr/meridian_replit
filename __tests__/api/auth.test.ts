import supertest from 'supertest';
import { createServer } from '../../server/index';
import { Express } from 'express';

describe('Authentication API Tests', () => {
  let server: Express;
  let request: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    server = await createServer();
    request = supertest(server);
  });

  describe('User Login', () => {
    it('should allow admin login with correct credentials', async () => {
      const response = await request
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('username', 'admin');
      expect(response.body).toHaveProperty('role', 'admin');
    });

    it('should allow reviewer login with correct credentials', async () => {
      const response = await request
        .post('/api/auth/login')
        .send({
          username: 'reviewer',
          password: 'password',
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('username', 'reviewer');
      expect(response.body).toHaveProperty('role', 'reviewer');
    });

    it('should reject login with incorrect credentials', async () => {
      await request
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('Authentication Check', () => {
    it('should return 401 for unauthorized access', async () => {
      await request
        .get('/api/auth/me')
        .expect(401);
    });

    it('should return user details for authenticated requests', async () => {
      // First login to get session cookie
      const loginResponse = await request
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        });

      const cookie = loginResponse.headers['set-cookie'];

      // Use cookie for authentication check
      const response = await request
        .get('/api/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('username', 'admin');
      expect(response.body).toHaveProperty('role', 'admin');
    });
  });
});