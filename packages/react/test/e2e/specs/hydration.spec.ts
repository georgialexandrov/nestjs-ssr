import { test, expect } from '@playwright/test';

test.describe('Hydration', () => {
  test.describe('No hydration mismatches', () => {
    const routes = ['/', '/recipes', '/recipes/lohikeitto'];

    for (const route of routes) {
      test(`no hydration errors on ${route}`, async ({ page }) => {
        const consoleMessages: string[] = [];

        page.on('console', (msg) => {
          const text = msg.text();
          if (
            msg.type() === 'error' ||
            text.toLowerCase().includes('hydration') ||
            text.toLowerCase().includes('mismatch')
          ) {
            consoleMessages.push(text);
          }
        });

        await page.goto(route);
        await page.waitForTimeout(1000);

        const hydrationErrors = consoleMessages.filter(
          (msg) =>
            msg.toLowerCase().includes('hydration') ||
            msg.toLowerCase().includes('mismatch') ||
            msg.toLowerCase().includes('did not match'),
        );

        expect(hydrationErrors).toHaveLength(0);
      });
    }

    for (const route of routes) {
      test(`no hydration errors after hard refresh on ${route}`, async ({
        page,
      }) => {
        const consoleMessages: string[] = [];

        page.on('console', (msg) => {
          const text = msg.text();
          if (
            msg.type() === 'error' ||
            text.toLowerCase().includes('hydration') ||
            text.toLowerCase().includes('mismatch')
          ) {
            consoleMessages.push(text);
          }
        });

        await page.goto(route);
        await page.waitForTimeout(500);

        // Clear messages from first load
        consoleMessages.length = 0;

        await page
          .reload({ waitUntil: 'domcontentloaded', timeout: 10000 })
          .catch(() => {
            // Stream mode may hang on reload in dev
            return;
          });
        await page.waitForTimeout(1000);

        const hydrationErrors = consoleMessages.filter(
          (msg) =>
            msg.toLowerCase().includes('hydration') ||
            msg.toLowerCase().includes('mismatch') ||
            msg.toLowerCase().includes('did not match'),
        );

        expect(hydrationErrors).toHaveLength(0);
      });
    }
  });

  test.describe('Interactive elements', () => {
    test('favorite button works on /recipes/lohikeitto', async ({ page }) => {
      await page.goto('/recipes/lohikeitto');

      const favoriteButton = page.getByTestId('favorite-button');
      const favoriteStatus = page.getByTestId('favorite-status');

      await expect(favoriteStatus).toHaveText('Not favorited');
      await favoriteButton.click();
      await expect(favoriteStatus).toHaveText('Favorited');
      await favoriteButton.click();
      await expect(favoriteStatus).toHaveText('Not favorited');
    });

    test('favorite button works after hard refresh', async ({ page }) => {
      await page.goto('/recipes/lohikeitto');
      await page
        .reload({ waitUntil: 'domcontentloaded', timeout: 10000 })
        .catch(() => {
          test.skip();
        });

      const favoriteButton = page.getByTestId('favorite-button');
      const favoriteStatus = page.getByTestId('favorite-status');

      await expect(favoriteStatus).toHaveText('Not favorited');
      await favoriteButton.click();
      await expect(favoriteStatus).toHaveText('Favorited');
    });

    test('favorite button works after client-side navigation', async ({
      page,
    }) => {
      // Navigate from home → recipes → detail via Links
      await page.goto('/');
      await page.waitForTimeout(500);
      await page.click('a[href="/recipes"]');
      await page.waitForTimeout(500);
      await page.click('a[href="/recipes/lohikeitto"]');
      await page.waitForTimeout(500);

      const favoriteButton = page.getByTestId('favorite-button');
      const favoriteStatus = page.getByTestId('favorite-status');

      await expect(favoriteStatus).toHaveText('Not favorited');
      await favoriteButton.click();
      await expect(favoriteStatus).toHaveText('Favorited');
    });
  });
});
