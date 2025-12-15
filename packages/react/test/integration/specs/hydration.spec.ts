import { test, expect } from '@playwright/test';

test.describe('SSR Hydration', () => {
  test('renders root layout wrapping page content', async ({ page }) => {
    await page.goto('/');

    // Check that the root layout is rendered
    const rootLayout = page.getByTestId('root-layout');
    await expect(rootLayout).toBeVisible();

    // Check layout header
    const layoutHeader = page.getByTestId('layout-header');
    await expect(layoutHeader).toBeVisible();

    // Check layout footer
    const layoutFooter = page.getByTestId('layout-footer');
    await expect(layoutFooter).toBeVisible();

    // Verify page content is inside the layout
    const counterApp = page.getByTestId('counter-app');
    await expect(counterApp).toBeVisible();
  });

  test('renders server message from controller', async ({ page }) => {
    await page.goto('/');

    // Check that the message from controller is rendered
    const message = page.getByTestId('message');
    await expect(message).toBeVisible();
    await expect(message).toHaveText('Hello World!');
  });

  test('hydration enables button clicks', async ({ page }) => {
    await page.goto('/');

    const countDisplay = page.getByTestId('count');
    const incrementBtn = page.getByTestId('increment');
    const decrementBtn = page.getByTestId('decrement');

    // Initial state (from server render)
    await expect(countDisplay).toHaveText('0');

    // Click increment - proves hydration worked (useState is functional)
    await incrementBtn.click();
    await expect(countDisplay).toHaveText('1');

    // Click again
    await incrementBtn.click();
    await expect(countDisplay).toHaveText('2');

    // Click decrement
    await decrementBtn.click();
    await expect(countDisplay).toHaveText('1');
  });

  test('no hydration mismatch warnings', async ({ page }) => {
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

    await page.goto('/');

    // Wait for hydration to complete
    await page.waitForTimeout(1000);

    // Check for hydration errors
    const hydrationErrors = consoleMessages.filter(
      (msg) =>
        msg.toLowerCase().includes('hydration') ||
        msg.toLowerCase().includes('mismatch') ||
        msg.toLowerCase().includes('did not match'),
    );

    expect(hydrationErrors).toHaveLength(0);
  });
});
