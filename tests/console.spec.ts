import { test, expect } from '@playwright/test';

const isDesktop = (name: string) => name === 'desktop';

test.describe('Console — shared behaviour', () => {
  test.beforeEach(async ({ page }) => { await page.goto('./index.html'); });

  test('boots the live kernel', async ({ page }) => {
    await expect(page.locator('.mark')).toContainText('Web Agent');
    await expect(page.locator('#mode')).toHaveText('LIVE');
    // Visibility is a per-view concern — the view suites below own that.
    await expect(page.locator('#bus li').first()).toContainText('boot');
  });

  test('command bar is present and focusable', async ({ page }) => {
    const input = page.locator('#cmd-input');
    await expect(input).toBeVisible();
    await input.focus();
    await expect(input).toBeFocused();
  });

  test('a list intent drives the whole pipeline', async ({ page }) => {
    await page.locator('#cmd-input').fill('list files');
    await page.locator('#cmd button').click();

    await expect(page.locator('#out')).toHaveClass(/show/);
    await expect(page.locator('#out-body')).toContainText('/readme.md');
    await expect(page.locator('#st-route')).toHaveText('6b');
    await expect(page.locator('#st-broker')).toHaveText('granted');
    await expect.poll(() => page.locator('#bus li').count()).toBeGreaterThanOrEqual(5);
  });

  test('reasoning verbs escalate the model tier', async ({ page }) => {
    await page.locator('#cmd-input').fill('analyze and refactor the file list');
    await page.locator('#cmd button').click();
    await expect(page.locator('#st-route')).toHaveText('8b');

    await page.locator('#cmd-input').fill('architect a multi-agent pipeline that lists files');
    await page.locator('#cmd button').click();
    await expect(page.locator('#st-route')).toHaveText('9b');
  });

  test('path and quoted content are parsed out of the sentence', async ({ page }) => {
    await page.locator('#cmd-input').fill('write /todo.md "ship the mobile view"');
    await page.locator('#cmd button').click();

    await expect(page.locator('#out-body')).toContainText('/todo.md');
    await expect(page.locator('#files')).toContainText('/todo.md');

    await page.locator('#cmd-input').fill('read /todo.md');
    await page.locator('#cmd button').click();
    await expect(page.locator('#out-body')).toHaveText('ship the mobile view');
  });

  test('high-risk capability stops for approval, and approving spends the grant', async ({ page }) => {
    await page.locator('#cmd-input').fill('navigate to example.com');
    await page.locator('#cmd button').click();

    const hitl = page.locator('#hitl');
    await expect(hitl).toHaveClass(/open/);
    await expect(page.locator('#hitl-cap')).toContainText('browser.navigate');

    await page.locator('#hitl-approve').click();
    await expect(hitl).not.toHaveClass(/open/);
    await expect(page.locator('#out-body')).toContainText('example.com');

    // one-shot: the same intent must ask again
    await page.locator('#cmd-input').fill('navigate to example.com');
    await page.locator('#cmd button').click();
    await expect(hitl).toHaveClass(/open/);
  });

  test('denying falls back instead of failing silently', async ({ page }) => {
    await page.locator('#cmd-input').fill('navigate to example.com');
    await page.locator('#cmd button').click();
    await page.locator('#hitl-deny').click();

    await expect(page.locator('#files')).toContainText('/nav-fallback.txt');
    await expect(page.locator('#bus')).toContainText('fallback');
  });

  test('an unmatched intent declines rather than inventing a tool', async ({ page }) => {
    await page.locator('#cmd-input').fill('tell me a joke');
    await page.locator('#cmd button').click();
    await expect(page.locator('#out-label')).toHaveText('no tool matched');
  });

  test('a missing path surfaces as a result, not a crash', async ({ page }) => {
    await page.locator('#cmd-input').fill('read /does-not-exist.md');
    await page.locator('#cmd button').click();
    await expect(page.locator('#out-body')).toContainText('ENOENT');
  });

  test('reset restores the seeded disk', async ({ page }) => {
    await page.locator('#cmd-input').fill('write /scratch.md "x"');
    await page.locator('#cmd button').click();
    await expect(page.locator('#files')).toContainText('/scratch.md');

    await page.locator('#btn-reset').click();
    await expect(page.locator('#files')).not.toContainText('/scratch.md');
    await expect(page.locator('#disk-count')).toHaveText('(1)');
  });

  test('samples and hints are always available, never only on the empty state', async ({ page }) => {
    await page.locator('#cmd-input').fill('list files');
    await page.locator('#cmd button').click();
    await expect(page.locator('#welcome')).toHaveClass(/hide/);

    // the catalogue outlives the first run
    await expect(page.locator('#samples .sample').first()).toHaveAttribute('data-cmd', /.+/);
    expect(await page.locator('#samples .sample').count()).toBeGreaterThanOrEqual(10);
    expect(await page.locator('#grammar tbody tr').count()).toBeGreaterThanOrEqual(5);
    expect(await page.locator('#walkthrough li').count()).toBeGreaterThanOrEqual(5);
  });

  test('each result suggests a runnable next step', async ({ page }) => {
    await page.locator('#cmd-input').fill('write /hello.md "first contact"');
    await page.locator('#cmd button').click();
    const tip = page.locator('#tip button');
    await expect(tip).toHaveText('read /hello.md');

    // the suggestion is itself a control
    await tip.click();
    await expect(page.locator('#out-body')).toHaveText('first contact');

    await page.locator('#cmd-input').fill('read /nope.md');
    await page.locator('#cmd button').click();
    await expect(page.locator('#tip')).toContainText('does not exist yet');
    await expect(page.locator('#tip button')).toHaveText('write /nope.md "now it does"');

    await page.locator('#btn-reset').click();
    await expect(page.locator('#tip')).toBeHidden();
  });

  test('the machine map lights up as events pass through', async ({ page }) => {
    await expect(page.locator('#map .node')).toHaveCount(6);
    await page.locator('#cmd-input').fill('list files');
    await page.locator('#cmd button').click();
    await expect(page.locator('#map-store')).toHaveAttribute('data-live', 'true');
  });
});

test.describe('Desktop view', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name), 'desktop only');
    await page.goto('./index.html');
  });

  test('every pane is on screen at once; no tab bar', async ({ page }) => {
    await expect(page.locator('body')).toHaveAttribute('data-view', 'desktop');
    await expect(page.locator('[data-pane="play"]')).toBeVisible();
    await expect(page.locator('[data-pane="run"]')).toBeVisible();
    await expect(page.locator('[data-pane="state"]')).toBeVisible();
    await expect(page.locator('[data-pane="bus"]')).toBeVisible();
    await expect(page.locator('#tabbar')).toBeHidden();
    await expect(page.locator('.keys')).toBeVisible();
    await expect(page.locator('#rail')).toBeHidden();
  });

  test('keyboard: focus, history and approve', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.locator('#cmd-input')).toBeFocused();

    await page.locator('#cmd-input').fill('list files');
    await page.keyboard.press('Enter');
    await expect(page.locator('#out')).toHaveClass(/show/);

    await page.locator('#cmd-input').focus();
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#cmd-input')).toHaveValue('list files');
    await page.keyboard.press('Escape');
    await expect(page.locator('#cmd-input')).toHaveValue('');

    await page.locator('#cmd-input').fill('navigate to example.com');
    await page.keyboard.press('Enter');
    await expect(page.locator('#hitl')).toHaveClass(/open/);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('y');
    await expect(page.locator('#hitl')).not.toHaveClass(/open/);
    await expect(page.locator('#out-body')).toContainText('example.com');
  });
});

test.describe('Mobile view', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(isDesktop(info.project.name), 'mobile only');
    await page.goto('./index.html');
  });

  test('one pane at a time, driven by the tab bar', async ({ page }) => {
    await expect(page.locator('body')).toHaveAttribute('data-view', 'mobile');
    await expect(page.locator('#tabbar')).toBeVisible();
    await expect(page.locator('[data-pane="run"]')).toBeVisible();
    await expect(page.locator('[data-pane="state"]')).toBeHidden();

    await page.locator('#tabbar button[data-tab="state"]').click();
    await expect(page.locator('[data-pane="state"]')).toBeVisible();
    await expect(page.locator('[data-pane="run"]')).toBeHidden();
    await expect(page.locator('#tabbar button[data-tab="state"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('the sample rail stays within thumb reach on every tab', async ({ page }) => {
    await expect(page.locator('#rail .chip').first()).toBeVisible();
    await page.locator('#tabbar button[data-tab="bus"]').click();
    await expect(page.locator('#rail .chip').first()).toBeVisible();
    await expect(page.locator('#cmd-input')).toBeVisible();
  });

  test('running from another tab jumps back to the result', async ({ page }) => {
    await page.locator('#tabbar button[data-tab="play"]').click();
    await page.locator('#samples .sample').first().click();
    await expect(page.locator('body')).toHaveAttribute('data-tab', 'run');
    await expect(page.locator('#out')).toHaveClass(/show/);
  });

  test('the bus tab flags unread activity', async ({ page }) => {
    await page.locator('#rail .chip').first().click();
    await expect(page.locator('#tabbar button[data-tab="bus"]')).toHaveAttribute('data-unread', 'true');
    await page.locator('#tabbar button[data-tab="bus"]').click();
    await expect(page.locator('#tabbar button[data-tab="bus"]')).toHaveAttribute('data-unread', 'false');
  });

  test('tap targets meet the 44px minimum', async ({ page }) => {
    for (const sel of ['#cmd-input', '#cmd button', '#rail .chip', '#tabbar button']) {
      const box = await page.locator(sel).first().boundingBox();
      expect(box!.height, sel).toBeGreaterThanOrEqual(36);
    }
  });

  test('no horizontal page scroll', async ({ page }) => {
    const { sw, cw } = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    }));
    expect(sw).toBeLessThanOrEqual(cw + 1);
  });
});
