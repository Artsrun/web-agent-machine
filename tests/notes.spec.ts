import { test, expect } from '@playwright/test';

test.describe('Notes', () => {
  test('index lists all notes posts', async ({ page }) => {
    await page.goto('./blog.html');

    await expect(page.locator('h1')).toHaveText('Notes');

    const links = page.locator('.post-list a');
    await expect(links).toHaveCount(7);

    await expect(links.nth(0)).toContainText('Scan-Line to Splat');
    await expect(links.nth(1)).toContainText('Context Rot Mechanisms');
    await expect(links.nth(2)).toContainText('BKT Simulator v2: A Gamified Mastery Lab');
    await expect(links.nth(3)).toContainText('The Agent Loop Hidden in Plain Sight');
    await expect(links.nth(4)).toContainText('Mastering Terminal Commands');
    await expect(links.nth(5)).toContainText('The CLI Never Died');
    await expect(links.nth(6)).toContainText('Why Kaomoji Are Cheap');
  });

  test('context rot note loads', async ({ page }) => {
    await page.goto('./notes/context-rot.html');

    await expect(page.locator('h1')).toContainText('Context Rot Mechanisms');
    await expect(page.locator('pre').first()).toBeVisible();
  });

  test('scan-line to splat note loads', async ({ page }) => {
    await page.goto('./notes/scanline-to-web.html');

    await expect(page.locator('h1')).toContainText('Scan-Line to Splat');
    await expect(page.locator('#y1967')).toBeVisible();
    await expect(page.locator('pre').first()).toBeVisible();
  });

  test('bkt simulator note loads and tracks history', async ({ page }) => {
    await page.goto('./notes/bkt-simulator.html');

    await expect(page.locator('h1')).toContainText('Bayesian Knowledge Tracing Simulator');
    await expect(page.locator('#mastery')).toHaveText('0.1000');
    await expect(page.locator('#attempts')).toHaveText('0');

    await page.locator('#btn-correct').click();
    await page.locator('#btn-incorrect').click();

    await expect(page.locator('#attempts')).toHaveText('2');
    await expect(page.locator('#timeline li')).toHaveCount(2);
    await expect(page.locator('#timeline li').first()).toContainText('#1 CORRECT');
    await expect(page.locator('#timeline li').nth(1)).toContainText('#2 INCORRECT');
    await expect(page.locator('#step-math')).toContainText('step');
    await expect(page.locator('#step-math')).toContainText('2');

    await page.locator('#p_l0').fill('0.50');
    await page.locator('#btn-reset').click();
    await expect(page.locator('#attempts')).toHaveText('0');
    await expect(page.locator('#mastery')).toHaveText('0.5000');
    await expect(page.locator('#timeline li')).toHaveCount(0);
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

  test('bkt simulator note loads with controls', async ({ page }) => {
    await page.goto('./notes/bkt-simulator.html');

    await expect(page.locator('h1')).toContainText('Bayesian Knowledge Tracing Simulator');
    await expect(page.locator('#btn-correct')).toBeVisible();
    await expect(page.locator('#btn-incorrect')).toBeVisible();
    await expect(page.locator('#trajectory')).toBeVisible();
    await expect(page.locator('#attempts')).toHaveText('0');

    await page.locator('#btn-correct').click();
    await expect(page.locator('#attempts')).toHaveText('1');
    await expect(page.locator('#mastery')).not.toHaveText('0.1000');
    await expect(page.locator('#timeline li')).toHaveCount(1);
    await expect(page.locator('#step-math')).toContainText('P(correct)');
  });
});
