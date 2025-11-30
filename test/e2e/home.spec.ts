import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load and display the home page', async ({ page }) => {
    await page.goto('/');

    // Check that the page loaded
    await expect(page).toHaveTitle(/NestJS React SSR/);

    // Verify server-rendered content is visible
    await expect(page.locator('h1')).toContainText('Hello World!');
    await expect(page.locator('h2')).toContainText(
      'NestJS + React SSR Prototype',
    );
  });

  test('should have working client-side hydration', async ({ page }) => {
    await page.goto('/');

    // Wait for hydration - check that React is loaded
    await page.waitForLoadState('networkidle');

    // Verify counter component is visible
    await expect(page.getByText('Interactive Counter Demo')).toBeVisible();

    // Verify counter buttons are present (proves hydration)
    await expect(page.getByRole('button', { name: '+' })).toBeVisible();
    await expect(page.getByRole('button', { name: '-' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  });

  test('should have interactive counter after hydration', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to be fully loaded and hydrated
    await page.waitForLoadState('networkidle');

    // Get buttons using more reliable selectors
    const incrementButton = page.getByRole('button', { name: '+' });
    const decrementButton = page.getByRole('button', { name: '-' });
    const resetButton = page.getByRole('button', { name: 'Reset' });

    // Helper to get the counter value (the large number displayed)
    // The counter displays in a div with fontSize: '48px'
    const getCounterValue = async () => {
      // Find the counter section and get its text
      const counterSection = page.locator('text=Interactive Counter Demo').locator('..');
      const counterDisplay = counterSection.locator('div').filter({
        hasText: /^-?\d+$/
      }).first();
      return await counterDisplay.textContent();
    };

    // Wait a bit for hydration to complete
    await page.waitForTimeout(500);

    // Initial count should be 0
    expect(await getCounterValue()).toBe('0');

    // Click increment button
    await incrementButton.click();
    await page.waitForTimeout(100);
    expect(await getCounterValue()).toBe('1');

    // Click increment again
    await incrementButton.click();
    await page.waitForTimeout(100);
    expect(await getCounterValue()).toBe('2');

    // Click decrement button
    await decrementButton.click();
    await page.waitForTimeout(100);
    expect(await getCounterValue()).toBe('1');

    // Click reset button
    await resetButton.click();
    await page.waitForTimeout(100);
    expect(await getCounterValue()).toBe('0');
  });

  test('should have working navigation to users page', async ({ page }) => {
    await page.goto('/');

    // Find and click the users link
    const usersLink = page.locator('a[href="/users"]');
    await usersLink.click();

    // Wait for navigation
    await page.waitForURL('/users');

    // Verify we're on the users page
    await expect(page).toHaveURL('/users');
  });

  test('should display request context information', async ({ page }) => {
    await page.goto('/');

    // Check for request context display
    await expect(page.locator('text=Request Context Demo')).toBeVisible();
    await expect(page.locator('text=Path:')).toBeVisible();
    await expect(page.locator('text=URL:')).toBeVisible();
  });
});
