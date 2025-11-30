import { test, expect } from '@playwright/test';

test.describe('Users Page', () => {
  test('should display users list with SSR content', async ({ page }) => {
    await page.goto('/users');

    // Check that the page loaded with correct title
    await expect(page.locator('h1')).toContainText('Users');

    // Verify welcome message
    await expect(page.getByText('Welcome to the NestJS + React SSR prototype!')).toBeVisible();

    // Verify users are displayed (server-rendered)
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('Jane Smith')).toBeVisible();
    await expect(page.getByText('Bob Johnson')).toBeVisible();

    // Verify emails are shown
    await expect(page.getByText('john@example.com')).toBeVisible();
    await expect(page.getByText('jane@example.com')).toBeVisible();
  });

  test('should navigate to user profile when clicking on a user', async ({
    page,
  }) => {
    await page.goto('/users');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Click on John Doe's link
    await page.getByRole('link', { name: 'John Doe' }).click();

    // Wait for navigation to profile page
    await page.waitForURL('/users/1');

    // Verify we're on John's profile page
    await expect(page.locator('h1')).toContainText('John Doe');
    await expect(page.getByText('john@example.com')).toBeVisible();

    // Verify the back link is present
    await expect(page.getByRole('link', { name: '← Back to users list' })).toBeVisible();
  });

  test('should display user profile with correct information', async ({
    page,
  }) => {
    await page.goto('/users/1');

    // Check for profile information
    await expect(page.locator('h1')).toContainText('John Doe');
    await expect(page.getByText(/Email:.*john@example\.com/)).toBeVisible();

    // Verify the bio is shown
    await expect(page.getByText(/Full-stack developer/)).toBeVisible();

    // Verify the interactive like button is present
    await expect(page.getByRole('button', { name: /👍 Like/ })).toBeVisible();

    // Check for "Test Interactivity" section
    await expect(page.getByText('Test Interactivity')).toBeVisible();
  });

  test('should handle non-existent user gracefully', async ({ page }) => {
    const response = await page.goto('/users/999');

    // Should return a 404 status
    expect(response?.status()).toBe(404);
  });

  test('should have back navigation working', async ({ page }) => {
    await page.goto('/users/1');
    await page.waitForLoadState('networkidle');

    // Click the back link
    await page.getByRole('link', { name: '← Back to users list' }).click();

    // Wait for navigation
    await page.waitForURL('/users');

    // Should be back at users list
    await expect(page).toHaveURL('/users');
    await expect(page.locator('h1')).toContainText('Users');
  });
});

test.describe('Users Page - Client-side Interactions', () => {
  test('should have working like button on profile page', async ({ page }) => {
    await page.goto('/users/1');

    // Wait for hydration
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Find the like button
    const likeButton = page.getByRole('button', { name: /👍 Like/ });

    // Initial state should show (0)
    await expect(likeButton).toHaveText(/Like \(0\)/);

    // Click the like button
    await likeButton.click();
    await page.waitForTimeout(100);

    // Should now show (1)
    await expect(likeButton).toHaveText(/Like \(1\)/);

    // Click again
    await likeButton.click();
    await page.waitForTimeout(100);

    // Should now show (2)
    await expect(likeButton).toHaveText(/Like \(2\)/);
  });

  test('should have interactive user links', async ({ page }) => {
    await page.goto('/users');

    // Wait for hydration
    await page.waitForLoadState('networkidle');

    // Verify user links are present and clickable
    const johnLink = page.getByRole('link', { name: 'John Doe' });
    await expect(johnLink).toBeVisible();
    await expect(johnLink).toHaveAttribute('href', '/users/1');

    const janeLink = page.getByRole('link', { name: 'Jane Smith' });
    await expect(janeLink).toBeVisible();
    await expect(janeLink).toHaveAttribute('href', '/users/2');

    const bobLink = page.getByRole('link', { name: 'Bob Johnson' });
    await expect(bobLink).toBeVisible();
    await expect(bobLink).toHaveAttribute('href', '/users/3');
  });
});
