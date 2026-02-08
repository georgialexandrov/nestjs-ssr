import { test, expect } from '@playwright/test';

test.describe('Client-Side Navigation', () => {
  test.describe('Segment loading', () => {
    test('clicking Link from / to /recipes does not trigger full page reload', async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForTimeout(500);

      // Intercept navigation requests
      const requests: { url: string; resourceType: string }[] = [];
      page.on('request', (req) => {
        requests.push({
          url: req.url(),
          resourceType: req.resourceType(),
        });
      });

      // Click the Recipes link
      await page.click('a[href="/recipes"]');
      await page.waitForTimeout(500);

      // Should have navigated to /recipes
      await expect(page.getByTestId('recipe-list')).toBeVisible();

      // Should NOT have a document-type request (full page load)
      // Instead, should have a fetch/xhr request
      const documentRequests = requests.filter(
        (r) => r.resourceType === 'document' && r.url.includes('/recipes'),
      );
      expect(documentRequests).toHaveLength(0);

      // Should have a fetch request to /recipes
      const fetchRequests = requests.filter(
        (r) =>
          (r.resourceType === 'fetch' || r.resourceType === 'xhr') &&
          r.url.includes('/recipes'),
      );
      expect(fetchRequests.length).toBeGreaterThan(0);
    });

    test('client-side request sends X-Current-Layouts header', async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForTimeout(500);

      // Intercept the fetch request to capture headers
      const [request] = await Promise.all([
        page.waitForRequest(
          (req) =>
            req.url().includes('/recipes') &&
            (req.resourceType() === 'fetch' || req.resourceType() === 'xhr'),
        ),
        page.click('a[href="/recipes"]'),
      ]);

      const headers = request.headers();
      expect(headers['x-current-layouts']).toBeDefined();
    });

    test('segment response contains expected data', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(500);

      // Intercept the response
      const [response] = await Promise.all([
        page.waitForResponse(
          (res) =>
            res.url().includes('/recipes') &&
            res.request().resourceType() === 'fetch',
        ),
        page.click('a[href="/recipes"]'),
      ]);

      const json = await response.json();
      expect(json).toHaveProperty('html');
      expect(json).toHaveProperty('swapTarget');
      expect(json).toHaveProperty('componentName');
      expect(json).toHaveProperty('layouts');
    });
  });

  test.describe('Segment swap within layout', () => {
    test('navigating from /recipes to /recipes/:slug preserves RecipesLayout', async ({
      page,
    }) => {
      await page.goto('/recipes');
      await page.waitForTimeout(500);

      // RecipesLayout must be present
      await expect(page.getByTestId('recipes-layout')).toBeVisible();
      await expect(page.getByTestId('recipes-sidebar')).toBeVisible();

      // Navigate to a recipe detail
      await page.click('a[href="/recipes/lohikeitto"]');
      await page.waitForTimeout(500);

      // RecipesLayout must STILL be present (only inner content swapped)
      await expect(page.getByTestId('recipes-layout')).toBeVisible();
      await expect(page.getByTestId('recipes-sidebar')).toBeVisible();

      // Recipe detail content must be present
      await expect(page.getByTestId('recipe-detail')).toBeVisible();
      await expect(page.getByTestId('recipe-name')).toHaveText('Lohikeitto');
    });

    test('navigating between recipes only swaps page content', async ({
      page,
    }) => {
      await page.goto('/recipes/lohikeitto');
      await page.waitForTimeout(500);

      await expect(page.getByTestId('recipe-name')).toHaveText('Lohikeitto');

      // Navigate to another recipe via back → click
      await page.click('a[href="/recipes"]');
      await page.waitForTimeout(500);
      await page.click('a[href="/recipes/carbonara"]');
      await page.waitForTimeout(500);

      // Layout preserved, content changed
      await expect(page.getByTestId('recipes-layout')).toBeVisible();
      await expect(page.getByTestId('recipe-name')).toHaveText(
        'Spaghetti Carbonara',
      );
    });
  });

  test.describe('Browser history', () => {
    test('back button navigates without full page reload', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(500);

      // Navigate to /recipes via Link
      await page.click('a[href="/recipes"]');
      await page.waitForTimeout(500);
      await expect(page.getByTestId('recipe-list')).toBeVisible();

      // Track requests during back navigation
      const documentRequests: string[] = [];
      page.on('request', (req) => {
        if (req.resourceType() === 'document') {
          documentRequests.push(req.url());
        }
      });

      // Go back
      await page.goBack();
      await page.waitForTimeout(500);

      // Should be back on home
      await expect(page.getByTestId('home-page')).toBeVisible();

      // Should not have triggered a full document load
      expect(documentRequests).toHaveLength(0);
    });
  });
});
