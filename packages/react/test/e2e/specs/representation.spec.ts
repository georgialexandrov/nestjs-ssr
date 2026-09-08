import { test, expect } from '@playwright/test';

/**
 * Browser-level coverage for content negotiation, response policy, and the
 * hardened segment path. These run against both the Express and Fastify
 * fixtures, so every expectation here is also an adapter-parity assertion.
 */

test.describe('content negotiation', () => {
  test('serves HTML to a browser', async ({ page }) => {
    const response = await page.goto('/recipes');
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('text/html');
  });

  test('serves JSON when the client asks for it', async ({ request }) => {
    const response = await request.get('/recipes/lohikeitto', {
      headers: { Accept: 'application/json' },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toMatchObject({
      slug: 'lohikeitto',
      representation: 'api',
    });
  });

  test('ranks explicit representations by quality', async ({ request }) => {
    const response = await request.get('/recipes/lohikeitto', {
      headers: { Accept: 'text/html, application/json;q=0.5' },
    });

    expect(response.headers()['content-type']).toContain('text/html');
  });

  test('refuses an Accept header explicit representations cannot satisfy', async ({
    request,
  }) => {
    const response = await request.get('/recipes/lohikeitto', {
      headers: { Accept: 'image/png' },
    });

    expect(response.status()).toBe(406);
    expect(await response.json()).toMatchObject({
      acceptable: ['text/html', 'application/json'],
    });
  });

  test('honours an explicit JSON exclusion', async ({ request }) => {
    const response = await request.get('/recipes/lohikeitto', {
      headers: { Accept: 'application/json;q=0, text/html;q=0.8' },
    });

    expect(response.headers()['content-type']).toContain('text/html');
  });

  test('answers 406 when the route offers no acceptable representation', async ({
    request,
  }) => {
    const response = await request.get('/recipes/private/dashboard', {
      headers: { Accept: 'application/json' },
    });

    expect(response.status()).toBe(406);
    const body = await response.json();
    expect(body.error).toBe('Not Acceptable');
    // The refusal never carries controller data.
    expect(JSON.stringify(body)).not.toContain('lohikeitto');
  });

  test('matches a structured JSON suffix', async ({ request }) => {
    const response = await request.get('/recipes/lohikeitto', {
      headers: { Accept: 'application/*+json' },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('keeps legacy q=0 substring behavior for existing controller shapes', async ({
    request,
  }) => {
    const response = await request.get('/recipes', {
      headers: { Accept: 'application/json;q=0' },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('keeps legacy HTML fallback for unrelated Accept types', async ({
    request,
  }) => {
    const response = await request.get('/recipes', {
      headers: { Accept: 'image/png' },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
  });
});

test.describe('response policy', () => {
  test('applies the configured response policy', async ({ request }) => {
    // The fixture configures securityHeaders, which turns the stage on.
    const response = await request.get('/recipes');
    const headers = response.headers();

    expect(headers['cache-control']).toBe('private, no-store');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('negotiated responses vary on the headers that select them', async ({
    request,
  }) => {
    const vary = (await request.get('/recipes')).headers()['vary'] ?? '';

    expect(vary.toLowerCase()).toContain('accept');
    expect(vary.toLowerCase()).toContain('x-current-layouts');
  });

  test('JSON responses carry the same policy as HTML ones', async ({
    request,
  }) => {
    const response = await request.get('/recipes/lohikeitto', {
      headers: { Accept: 'application/json' },
    });

    expect(response.headers()['cache-control']).toBe('private, no-store');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
  });
});

test.describe('segment protocol', () => {
  test('a valid segment request wins over Accept: application/json', async ({
    request,
  }) => {
    const response = await request.get('/recipes/lohikeitto', {
      headers: {
        Accept: 'application/json',
        'X-Current-Layouts': 'RootLayout,RecipesLayout',
      },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body.v).toBe(1);
    // The segment derives from the HTML representation, not the API DTO.
    expect(body).not.toHaveProperty('representation');
    expect(body.props).toHaveProperty('recipe');
  });

  test('an invalid layout header falls back to normal negotiation', async ({
    request,
  }) => {
    const response = await request.get('/recipes/lohikeitto', {
      headers: {
        Accept: 'application/json',
        'X-Current-Layouts': 'Root,<script>alert(1)</script>',
      },
    });

    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toMatchObject({ representation: 'api' });
  });

  test('an over-long layout header falls back to normal negotiation', async ({
    request,
  }) => {
    const tooMany = Array.from({ length: 40 }, (_, i) => `L${i}`).join(',');
    const response = await request.get('/recipes/lohikeitto', {
      headers: { Accept: 'text/html', 'X-Current-Layouts': tooMany },
    });

    expect(response.headers()['content-type']).toContain('text/html');
  });
});

test.describe('client-side segment handling', () => {
  test('navigates within the app and updates the DOM', async ({ page }) => {
    await page.goto('/recipes');
    await page.getByTestId('recipe-card-lohikeitto').click();

    await page.waitForURL('**/recipes/lohikeitto');
    await expect(page.getByTestId('recipe-name')).toBeVisible();
  });

  test('falls back to a full navigation when the segment is malformed', async ({
    page,
  }) => {
    await page.goto('/recipes');

    // Corrupt the segment response the client is about to apply. The schema
    // check must reject it and let the browser do a real navigation instead
    // of writing an unverified fragment into the document.
    await page.route('**/recipes/lohikeitto', async (route) => {
      if (route.request().headers()['x-current-layouts']) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            v: 1,
            html: '<p>injected</p>',
            swapTarget: 'GhostLayout',
            componentName: 'RecipeDetail',
            props: {},
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.getByTestId('recipe-card-lohikeitto').click();
    await page.waitForURL('**/recipes/lohikeitto');

    // The full navigation produced the real page, not the injected fragment.
    await expect(page.getByTestId('recipe-name')).toBeVisible();
    expect(await page.content()).not.toContain('injected');
  });

  test('falls back when the segment schema version is unknown', async ({
    page,
  }) => {
    await page.goto('/recipes');

    await page.route('**/recipes/lohikeitto', async (route) => {
      if (route.request().headers()['x-current-layouts']) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ v: 99, swapTarget: 'RecipesLayout' }),
        });
        return;
      }
      await route.continue();
    });

    await page.getByTestId('recipe-card-lohikeitto').click();
    await page.waitForURL('**/recipes/lohikeitto');

    await expect(page.getByTestId('recipe-name')).toBeVisible();
  });

  test('writes segment markup through the Trusted Types policy', async ({
    page,
  }) => {
    // Wrap the Trusted Types factory before any application script runs, so
    // every policy creation and every createHTML call is observable. The real
    // factory is used when the browser provides one.
    await page.addInitScript(() => {
      const calls: string[] = [];
      (window as unknown as { __ttCalls: string[] }).__ttCalls = calls;

      const wrap = (
        createPolicy: (
          name: string,
          rules: { createHTML(value: string): string },
        ) => { createHTML(value: string): unknown },
      ) => ({
        createPolicy(
          name: string,
          rules: { createHTML(value: string): string },
        ) {
          calls.push(`policy:${name}`);
          const policy = createPolicy(name, rules);
          return {
            createHTML(value: string) {
              calls.push('createHTML');
              return policy.createHTML(value);
            },
          };
        },
      });

      const existing = (window as unknown as { trustedTypes?: unknown })
        .trustedTypes as
        | {
            createPolicy(
              name: string,
              rules: { createHTML(value: string): string },
            ): { createHTML(value: string): unknown };
          }
        | undefined;

      const factory = existing?.createPolicy
        ? wrap(existing.createPolicy.bind(existing))
        : wrap((_name, rules) => ({
            createHTML: (value: string) => rules.createHTML(value),
          }));

      Object.defineProperty(window, 'trustedTypes', {
        configurable: true,
        value: factory,
      });
    });

    await page.goto('/recipes');
    await page.getByTestId('recipe-card-lohikeitto').click();
    await expect(page.getByTestId('recipe-name')).toBeVisible();

    const calls = await page.evaluate(
      () => (window as unknown as { __ttCalls: string[] }).__ttCalls,
    );
    expect(calls).toContain('policy:nestjs-ssr-segment');
    expect(calls).toContain('createHTML');
  });
});
