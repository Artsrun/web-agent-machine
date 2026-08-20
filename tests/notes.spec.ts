import { test, expect } from '@playwright/test';

test.describe('Notes', () => {
  test('index lists all three posts', async ({ page }) => {
    await page.goto('./blog.html');

    await expect(page.locator('h1')).toHaveText('Notes');

    const links = page.locator('.post-list a');
    await expect(links).toHaveCount(3);

    await expect(links.nth(0)).toContainText('Mastering Terminal Commands');
    await expect(links.nth(1)).toContainText('The CLI Never Died');
    await expect(links.nth(2)).toContainText('Why Kaomoji Are Cheap');
  });

  test('terminal commands note loads', async ({ page }) => {
    await page.goto('./notes/terminal.html');

    await expect(page.locator('h1')).toContainText('Mastering Terminal Commands');
    await expect(page.locator('code').first()).toBeVisible();
  });

  test('cli history note loads', async ({ page }) => {
    await page.goto('./notes/cli.html');

    await expect(page.locator('h1')).toContainText('The CLI Never Died');
  });

  test('kaomoji note loads', async ({ page }) => {
    await page.goto('./notes/kaomoji.html');

    await expect(page.locator('h1')).toContainText('Why Kaomoji Are Cheap and Cool');
    await expect(page.locator('.face').first()).toBeVisible();
  });
});
