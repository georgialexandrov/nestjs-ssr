import { test, expect } from '@playwright/test';

test.describe('SEO Tags', () => {
  test.describe('Home Page /', () => {
    test('has correct title', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveTitle('NestRecipes');
    });

    test('has meta description', async ({ page }) => {
      await page.goto('/');
      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveAttribute(
        'content',
        'A recipe collection built with NestJS SSR.',
      );
    });

    test('title persists after hard refresh', async ({ page }) => {
      await page.goto('/');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page).toHaveTitle('NestRecipes');
    });
  });

  test.describe('Recipe List /recipes', () => {
    test('has correct title', async ({ page }) => {
      await page.goto('/recipes');
      await expect(page).toHaveTitle(/All Recipes/);
    });

    test('title persists after hard refresh', async ({ page }) => {
      await page.goto('/recipes');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page).toHaveTitle(/All Recipes/);
    });

    test('title updates after client-side navigation from home', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(page).toHaveTitle('NestRecipes');

      await page.click('a[href="/recipes"]');
      await page.waitForTimeout(500);
      await expect(page).toHaveTitle(/All Recipes/);
    });
  });

  test.describe('Recipe Detail /recipes/lohikeitto', () => {
    test('has correct title', async ({ page }) => {
      await page.goto('/recipes/lohikeitto');
      await expect(page).toHaveTitle(/Lohikeitto/);
    });

    test('has meta description', async ({ page }) => {
      await page.goto('/recipes/lohikeitto');
      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveAttribute(
        'content',
        'A classic Finnish salmon soup with potatoes and dill.',
      );
    });

    test('title persists after hard refresh', async ({ page }) => {
      await page.goto('/recipes/lohikeitto');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page).toHaveTitle(/Lohikeitto/);
    });

    test('title updates after client-side navigation from list', async ({
      page,
    }) => {
      await page.goto('/recipes');
      await expect(page).toHaveTitle(/All Recipes/);

      await page.click('a[href="/recipes/lohikeitto"]');
      await page.waitForTimeout(500);
      await expect(page).toHaveTitle(/Lohikeitto/);
    });
  });

  test.describe('Different recipes have different SEO', () => {
    test('tarator has its own title and description', async ({ page }) => {
      await page.goto('/recipes/tarator');
      await expect(page).toHaveTitle(/Tarator/);

      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveAttribute(
        'content',
        'A cold Bulgarian yogurt soup with cucumbers and walnuts.',
      );
    });

    test('carbonara has its own title', async ({ page }) => {
      await page.goto('/recipes/carbonara');
      await expect(page).toHaveTitle(/Carbonara/);
    });
  });
});
