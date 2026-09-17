import { test, expect } from '@playwright/test';

test.describe('Explainer', () => {
  test.beforeEach(async ({ page }) => { await page.goto('./explain.html'); });

  test('carries everything the console no longer does', async ({ page }) => {
    await expect(page.locator('#map .item')).toHaveCount(5);
    expect(await page.locator('#grammar tbody tr').count()).toBeGreaterThanOrEqual(4);
    expect(await page.locator('#walkthrough li').count()).toBeGreaterThanOrEqual(5);
    expect(await page.locator('#samples .run-link').count()).toBeGreaterThanOrEqual(8);
    expect(await page.locator('#limits dt').count()).toBeGreaterThanOrEqual(4);
  });

  test('states the limits it would be easiest to leave out', async ({ page }) => {
    await expect(page.locator('#limits')).toContainText('There is no model');
  });

  test('runs nothing itself — every sample is a deep link into the console', async ({ page }) => {
    await expect(page.locator('button')).toHaveCount(0);
    const first = page.locator('#samples .run-link').first();
    await expect(first).toHaveAttribute('href', /^\.\/index\.html#run=/);
  });

  test('a deep link lands the intent in the console, primed but not fired', async ({ page }) => {
    await page.locator('#samples .run-link').first().click();
    await expect(page).toHaveURL(/index\.html$/);
    await expect(page.locator('#cmd-input')).toHaveValue('list files');
    // primed, not fired: reading about a thing is not running it
    await expect(page.locator('#out')).not.toHaveClass(/show/);
  });

  test('no horizontal scroll on a phone', async ({ page }) => {
    const { sw, cw } = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    }));
    expect(sw).toBeLessThanOrEqual(cw + 1);
  });
});
