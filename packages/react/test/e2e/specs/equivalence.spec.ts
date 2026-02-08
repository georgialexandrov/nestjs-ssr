import { test, expect } from '@playwright/test';

/**
 * THE critical test: client-side navigation DOM must match hard refresh DOM.
 * This would have caught the layout hydration bug where controller-level
 * @Layout() decorators were lost on hard refresh.
 *
 * We compare: data-layout attributes, data-outlet attributes, title, and
 * data-testid content. We do NOT compare window.__LAYOUTS__ because that's
 * a server-render artifact that only updates on full page loads, not client-side nav.
 */

interface DOMSnapshot {
  dataLayouts: string[];
  dataOutlets: string[];
  title: string;
  testIds: Record<string, string>;
}

async function captureDOMSnapshot(
  page: import('@playwright/test').Page,
): Promise<DOMSnapshot> {
  return page.evaluate(() => ({
    dataLayouts: [...document.querySelectorAll('[data-layout]')].map(
      (el) => (el as HTMLElement).dataset.layout!,
    ),
    dataOutlets: [...document.querySelectorAll('[data-outlet]')].map(
      (el) => (el as HTMLElement).dataset.outlet!,
    ),
    title: document.title,
    testIds: Object.fromEntries(
      [...document.querySelectorAll('[data-testid]')].map((el) => [
        (el as HTMLElement).dataset.testid,
        el.textContent?.trim().substring(0, 200) || '',
      ]),
    ),
  }));
}

test.describe('Client-Side Navigation vs Hard Refresh Equivalence', () => {
  test('/ — home page', async ({ page }) => {
    // 1. Hard refresh (direct server render)
    await page.goto('/');
    await page.waitForTimeout(500);
    const hardRefreshSnapshot = await captureDOMSnapshot(page);

    // 2. Navigate away then back via Link click (client-side)
    await page.click('a[href="/recipes"]');
    await page.waitForTimeout(500);
    await page.click('a[href="/"]');
    await page.waitForTimeout(500);
    const clientNavSnapshot = await captureDOMSnapshot(page);

    // 3. Compare
    expect(clientNavSnapshot.dataLayouts).toEqual(
      hardRefreshSnapshot.dataLayouts,
    );
    expect(clientNavSnapshot.dataOutlets).toEqual(
      hardRefreshSnapshot.dataOutlets,
    );
    expect(clientNavSnapshot.title).toEqual(hardRefreshSnapshot.title);

    for (const key of Object.keys(hardRefreshSnapshot.testIds)) {
      expect(clientNavSnapshot.testIds[key]).toBeDefined();
    }
  });

  test('/recipes — recipe list', async ({ page }) => {
    // 1. Hard refresh on /recipes
    await page.goto('/recipes');
    await page.waitForTimeout(500);
    const hardRefreshSnapshot = await captureDOMSnapshot(page);

    // 2. Start at /, navigate to /recipes via Link (client-side)
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.click('a[href="/recipes"]');
    await page.waitForTimeout(500);
    const clientNavSnapshot = await captureDOMSnapshot(page);

    // 3. Compare — layout DOM attributes must match
    expect(clientNavSnapshot.dataLayouts).toEqual(
      hardRefreshSnapshot.dataLayouts,
    );
    expect(clientNavSnapshot.dataOutlets).toEqual(
      hardRefreshSnapshot.dataOutlets,
    );
    expect(clientNavSnapshot.title).toEqual(hardRefreshSnapshot.title);

    for (const key of Object.keys(hardRefreshSnapshot.testIds)) {
      expect(clientNavSnapshot.testIds[key]).toBeDefined();
    }
  });

  test('/recipes/lohikeitto — recipe detail', async ({ page }) => {
    // 1. Hard refresh on /recipes/lohikeitto
    await page.goto('/recipes/lohikeitto');
    await page.waitForTimeout(500);
    const hardRefreshSnapshot = await captureDOMSnapshot(page);

    // 2. Start at /, navigate to /recipes then /recipes/lohikeitto via Links
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.click('a[href="/recipes"]');
    await page.waitForTimeout(500);
    await page.click('a[href="/recipes/lohikeitto"]');
    await page.waitForTimeout(500);
    const clientNavSnapshot = await captureDOMSnapshot(page);

    // 3. Compare
    expect(clientNavSnapshot.dataLayouts).toEqual(
      hardRefreshSnapshot.dataLayouts,
    );
    expect(clientNavSnapshot.dataOutlets).toEqual(
      hardRefreshSnapshot.dataOutlets,
    );
    expect(clientNavSnapshot.title).toEqual(hardRefreshSnapshot.title);

    // Recipe content must match
    expect(clientNavSnapshot.testIds['recipe-name']).toEqual(
      hardRefreshSnapshot.testIds['recipe-name'],
    );
    expect(clientNavSnapshot.testIds['recipe-description']).toEqual(
      hardRefreshSnapshot.testIds['recipe-description'],
    );

    for (const key of Object.keys(hardRefreshSnapshot.testIds)) {
      expect(clientNavSnapshot.testIds[key]).toBeDefined();
    }
  });

  test('/recipes/tarator — different recipe detail', async ({ page }) => {
    // 1. Hard refresh
    await page.goto('/recipes/tarator');
    await page.waitForTimeout(500);
    const hardRefreshSnapshot = await captureDOMSnapshot(page);

    // 2. Client-side navigation from recipe list
    await page.goto('/recipes');
    await page.waitForTimeout(500);
    await page.click('a[href="/recipes/tarator"]');
    await page.waitForTimeout(500);
    const clientNavSnapshot = await captureDOMSnapshot(page);

    // 3. Compare
    expect(clientNavSnapshot.dataLayouts).toEqual(
      hardRefreshSnapshot.dataLayouts,
    );
    expect(clientNavSnapshot.dataOutlets).toEqual(
      hardRefreshSnapshot.dataOutlets,
    );
    expect(clientNavSnapshot.title).toEqual(hardRefreshSnapshot.title);
    expect(clientNavSnapshot.testIds['recipe-name']).toEqual(
      hardRefreshSnapshot.testIds['recipe-name'],
    );
  });

  test('navigating between recipes preserves layout structure', async ({
    page,
  }) => {
    // Navigate to lohikeitto first
    await page.goto('/recipes/lohikeitto');
    await page.waitForTimeout(500);
    const firstSnapshot = await captureDOMSnapshot(page);

    // Click "Back to Recipes" link
    await page.click('a[href="/recipes"]');
    await page.waitForTimeout(500);

    // Click on carbonara
    await page.click('a[href="/recipes/carbonara"]');
    await page.waitForTimeout(500);
    const secondSnapshot = await captureDOMSnapshot(page);

    // Layout structure must be identical (only page content differs)
    expect(secondSnapshot.dataLayouts).toEqual(firstSnapshot.dataLayouts);
    expect(secondSnapshot.dataOutlets).toEqual(firstSnapshot.dataOutlets);

    // But content differs
    expect(secondSnapshot.testIds['recipe-name']).not.toEqual(
      firstSnapshot.testIds['recipe-name'],
    );
  });
});
