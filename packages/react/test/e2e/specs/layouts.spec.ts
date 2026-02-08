import { test, expect } from '@playwright/test';

test.describe('Layout System', () => {
  test.describe('DOM Layout Attributes', () => {
    test('/ has only RootLayout data-layout', async ({ page }) => {
      await page.goto('/');

      await expect(page.locator('[data-layout="RootLayout"]')).toHaveCount(1);

      // No RecipesLayout on home
      await expect(page.locator('[data-layout="RecipesLayout"]')).toHaveCount(
        0,
      );
    });

    test('/recipes has RootLayout + RecipesLayout', async ({ page }) => {
      await page.goto('/recipes');

      await expect(page.locator('[data-layout="RootLayout"]')).toHaveCount(1);
      await expect(page.locator('[data-layout="RecipesLayout"]')).toHaveCount(
        1,
      );
    });

    test('/recipes/:slug has RootLayout + RecipesLayout', async ({ page }) => {
      await page.goto('/recipes/lohikeitto');

      await expect(page.locator('[data-layout="RootLayout"]')).toHaveCount(1);
      await expect(page.locator('[data-layout="RecipesLayout"]')).toHaveCount(
        1,
      );
    });

    test('data-outlet attributes match data-layout', async ({ page }) => {
      await page.goto('/recipes/lohikeitto');

      await expect(page.locator('[data-outlet="RootLayout"]')).toHaveCount(1);
      await expect(page.locator('[data-outlet="RecipesLayout"]')).toHaveCount(
        1,
      );
    });
  });

  test.describe('Hard Refresh Preserves Layouts', () => {
    test('data-layout attributes survive hard refresh on /recipes', async ({
      page,
    }) => {
      await page.goto('/recipes');
      await page.reload({ waitUntil: 'domcontentloaded' });

      await expect(page.locator('[data-layout="RootLayout"]')).toHaveCount(1);
      await expect(page.locator('[data-layout="RecipesLayout"]')).toHaveCount(
        1,
      );
      await expect(page.locator('[data-outlet="RootLayout"]')).toHaveCount(1);
      await expect(page.locator('[data-outlet="RecipesLayout"]')).toHaveCount(
        1,
      );
    });

    test('data-layout attributes survive hard refresh on /recipes/:slug', async ({
      page,
    }) => {
      await page.goto('/recipes/lohikeitto');
      await page.reload({ waitUntil: 'domcontentloaded' });

      await expect(page.locator('[data-layout="RootLayout"]')).toHaveCount(1);
      await expect(page.locator('[data-layout="RecipesLayout"]')).toHaveCount(
        1,
      );
    });

    test('controller layout is rendered after hard refresh on /recipes', async ({
      page,
    }) => {
      await page.goto('/recipes');
      await page.reload({ waitUntil: 'domcontentloaded' });

      // RecipesLayout testid must be visible
      await expect(page.getByTestId('recipes-layout')).toBeVisible();
      await expect(page.getByTestId('recipes-sidebar')).toBeVisible();

      // Page content inside the layout
      await expect(page.getByTestId('recipe-list')).toBeVisible();
    });

    test('controller layout is rendered after hard refresh on /recipes/:slug', async ({
      page,
    }) => {
      await page.goto('/recipes/lohikeitto');
      await page.reload({ waitUntil: 'domcontentloaded' });

      await expect(page.getByTestId('recipes-layout')).toBeVisible();
      await expect(page.getByTestId('recipes-sidebar')).toBeVisible();
      await expect(page.getByTestId('recipe-name')).toHaveText('Lohikeitto');
    });
  });

  test.describe('window.__LAYOUTS__ Serialization', () => {
    test('/ has only RootLayout in __LAYOUTS__', async ({ page }) => {
      await page.goto('/');

      const layouts = await page.evaluate(() => (window as any).__LAYOUTS__);
      expect(layouts).toBeDefined();
      expect(Array.isArray(layouts)).toBe(true);

      const names = layouts.map((l: { name: string }) => l.name);
      expect(names).toContain('RootLayout');
      expect(names).not.toContain('RecipesLayout');
    });

    test('/recipes has RootLayout + RecipesLayout in __LAYOUTS__', async ({
      page,
    }) => {
      await page.goto('/recipes');

      const layouts = await page.evaluate(() => (window as any).__LAYOUTS__);
      const names = layouts.map((l: { name: string }) => l.name);
      expect(names).toContain('RootLayout');
      expect(names).toContain('RecipesLayout');
    });

    test('/recipes/:slug has RootLayout + RecipesLayout in __LAYOUTS__', async ({
      page,
    }) => {
      await page.goto('/recipes/tarator');

      const layouts = await page.evaluate(() => (window as any).__LAYOUTS__);
      const names = layouts.map((l: { name: string }) => l.name);
      expect(names).toContain('RootLayout');
      expect(names).toContain('RecipesLayout');
    });

    test('__LAYOUTS__ survives hard refresh', async ({ page }) => {
      await page.goto('/recipes/lohikeitto');
      await page.reload({ waitUntil: 'domcontentloaded' });

      const layouts = await page.evaluate(() => (window as any).__LAYOUTS__);
      expect(layouts).toBeDefined();
      const names = layouts.map((l: { name: string }) => l.name);
      expect(names).toContain('RootLayout');
      expect(names).toContain('RecipesLayout');
    });
  });

  test.describe('Initial Load', () => {
    test('renders root layout on /', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByTestId('root-layout')).toBeVisible();
      await expect(page.getByTestId('layout-header')).toBeVisible();
      await expect(page.getByTestId('layout-nav')).toBeVisible();
      await expect(page.getByTestId('home-page')).toBeVisible();
    });

    test('renders controller layout on /recipes', async ({ page }) => {
      await page.goto('/recipes');

      await expect(page.getByTestId('root-layout')).toBeVisible();
      await expect(page.getByTestId('recipes-layout')).toBeVisible();
      await expect(page.getByTestId('recipes-sidebar')).toBeVisible();
      await expect(page.getByTestId('recipe-list')).toBeVisible();
    });

    test('renders controller layout on /recipes/:slug', async ({ page }) => {
      await page.goto('/recipes/carbonara');

      await expect(page.getByTestId('root-layout')).toBeVisible();
      await expect(page.getByTestId('recipes-layout')).toBeVisible();
      await expect(page.getByTestId('recipe-detail')).toBeVisible();
      await expect(page.getByTestId('recipe-name')).toHaveText(
        'Spaghetti Carbonara',
      );
    });

    test('/ does NOT have recipes layout', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByTestId('root-layout')).toBeVisible();
      await expect(page.locator('[data-testid="recipes-layout"]')).toHaveCount(
        0,
      );
    });
  });
});
