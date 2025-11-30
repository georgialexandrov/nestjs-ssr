import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('SSR Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Home Page SSR', () => {
    it('should render the home page with SSR', async () => {
      const response = await request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Content-Type', /html/);

      // Verify that the HTML contains server-rendered content
      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('<div id="root">');

      // Check for expected content
      expect(response.text).toContain('Hello World!');
      expect(response.text).toContain('NestJS + React SSR Prototype');
    });

    it('should include client hydration scripts', async () => {
      const response = await request(app.getHttpServer()).get('/').expect(200);

      // Check for hydration data
      expect(response.text).toContain('window.__INITIAL_STATE__');
      expect(response.text).toContain('window.__CONTEXT__');
      expect(response.text).toContain('window.__COMPONENT_PATH__');

      // Check for client script tag
      expect(response.text).toContain('<script type="module"');
    });

    it('should include initial state in the rendered HTML', async () => {
      const response = await request(app.getHttpServer()).get('/').expect(200);

      // Parse the initial state from the HTML
      const stateMatch = response.text.match(
        /window\.__INITIAL_STATE__\s*=\s*({.*?});/s,
      );
      expect(stateMatch).toBeTruthy();

      if (stateMatch) {
        const initialState = JSON.parse(stateMatch[1]);
        expect(initialState).toHaveProperty('message');
        expect(initialState.message).toBe('Hello World!');
      }
    });
  });

  describe('Users List Page SSR', () => {
    it('should render the users list page with SSR', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .expect(200)
        .expect('Content-Type', /html/);

      // Verify server-rendered content
      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('<div id="root">');

      // Check for user-related content
      expect(response.text).toContain('Alice Johnson');
      expect(response.text).toContain('Bob Smith');
    });

    it('should include user data in initial state', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .expect(200);

      const stateMatch = response.text.match(
        /window\.__INITIAL_STATE__\s*=\s*({.*?});/s,
      );
      expect(stateMatch).toBeTruthy();

      if (stateMatch) {
        const initialState = JSON.parse(stateMatch[1]);
        expect(initialState).toHaveProperty('users');
        expect(Array.isArray(initialState.users)).toBe(true);
        expect(initialState.users.length).toBeGreaterThan(0);
      }
    });
  });

  describe('User Profile Page SSR', () => {
    it('should render a user profile with SSR', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/1')
        .expect(200)
        .expect('Content-Type', /html/);

      // Check for profile content
      expect(response.text).toContain('Alice Johnson');
      expect(response.text).toContain('alice@example.com');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/999')
        .expect(404);

      // NestJS returns JSON for 404 errors by default
      expect(response.body.message).toContain('User with ID 999 not found');
    });

    it('should include correct component path in context', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/1')
        .expect(200);

      const componentMatch = response.text.match(
        /window\.__COMPONENT_PATH__\s*=\s*"([^"]+)"/,
      );
      expect(componentMatch).toBeTruthy();

      if (componentMatch) {
        expect(componentMatch[1]).toBe('users/views/user-profile');
      }
    });
  });

  describe('Request Context', () => {
    it('should include request context in rendered HTML', async () => {
      const response = await request(app.getHttpServer()).get('/').expect(200);

      const contextMatch = response.text.match(
        /window\.__CONTEXT__\s*=\s*({.*?});/s,
      );
      expect(contextMatch).toBeTruthy();

      if (contextMatch) {
        const context = JSON.parse(contextMatch[1]);
        expect(context).toHaveProperty('url');
        expect(context).toHaveProperty('path');
        expect(context.path).toBe('/');
      }
    });
  });

  describe('Meta Tags and SEO', () => {
    it('should include proper meta tags', async () => {
      const response = await request(app.getHttpServer()).get('/').expect(200);

      // Check for essential meta tags
      expect(response.text).toContain('<meta charset="UTF-8"');
      expect(response.text).toContain(
        '<meta name="viewport" content="width=device-width, initial-scale=1.0"',
      );
      expect(response.text).toContain('<title>');
    });
  });
});
