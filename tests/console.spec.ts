import { test, expect } from '@playwright/test';

test.describe('Console', () => {
  test('boots and shows LIVE mode', async ({ page }) => {
    await page.goto('./index.html');

    await expect(page.locator('.mark')).toContainText('Web Agent');
    await expect(page.locator('#mode')).toHaveText('LIVE');
    await expect(page.locator('#bus')).toBeVisible();
  });

  test('command bar is present and focusable', async ({ page }) => {
    await page.goto('./index.html');

    const input = page.locator('#cmd-input');
    await expect(input).toBeVisible();
    await input.focus();
    await expect(input).toBeFocused();
  });

  test('submitting a list intent produces bus events', async ({ page }) => {
    await page.goto('./index.html');

    const input = page.locator('#cmd-input');
    await input.fill('list files');
    await page.locator('#cmd button').click();

    // Wait for at least one new bus entry after boot
    await expect.poll(() => page.locator('#bus li').count(), { timeout: 5000 }).toBeGreaterThanOrEqual(2);
  });
});
