import { test, expect } from '@playwright/test';

const isDesktop = (name: string) => name === 'desktop';

test.describe('Console — shared behaviour', () => {
  test.beforeEach(async ({ page }) => { await page.goto('./index.html'); });

  test('boots the live kernel', async ({ page }) => {
    await expect(page.locator('.mark')).toContainText('Web Agent');
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
    await expect(page.locator('#st-broker')).toHaveText('granted');
    await expect.poll(() => page.locator('#bus li').count()).toBeGreaterThanOrEqual(5);
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
    await expect(hitl).toHaveAttribute('open', '');
    await expect(page.locator('#hitl-cap')).toContainText('browser.navigate');
    // modal by construction: nothing behind it can be reached mid-decision
    await expect(page.locator('#cmd-input')).not.toBeFocused();

    // nothing is committed to the frame while the broker is still waiting
    await expect(page.locator('#frame-wrap')).toBeHidden();

    await page.locator('#hitl-approve').click();
    await expect(hitl).not.toHaveAttribute('open', '');
    await expect(page.locator('#out-body')).toContainText('example.com');
    await expect(page.locator('#frame-wrap')).toBeVisible();
    await expect(page.locator('#frame')).toHaveAttribute('src', 'https://example.com/');

    // one-shot: the same intent must ask again
    await page.locator('#cmd-input').fill('navigate to example.com');
    await page.locator('#cmd button').click();
    await expect(hitl).toHaveAttribute('open', '');
  });

  test('dismissing the approval counts as denying it', async ({ page }) => {
    await page.locator('#cmd-input').fill('navigate to example.com');
    await page.locator('#cmd button').click();
    await expect(page.locator('#hitl')).toHaveAttribute('open', '');

    // a security prompt defaults to no, so Esc is not an escape hatch
    await page.keyboard.press('Escape');
    await expect(page.locator('#out-label')).toHaveText('denied');
    await expect(page.locator('#frame-wrap')).toBeHidden();
  });

  test('denying is terminal — nothing runs, nothing is written in its place', async ({ page }) => {
    const before = await page.locator('#disk-count').textContent();

    await page.locator('#cmd-input').fill('navigate to example.com');
    await page.locator('#cmd button').click();
    await page.locator('#hitl-deny').click();

    await expect(page.locator('#out-label')).toHaveText('denied');
    await expect(page.locator('#bus li').first()).toContainText('denied');
    // the whole point of the gate: denying means the page never loads
    await expect(page.locator('#frame-wrap')).toBeHidden();
    // no consolation write: a denial that still touches the disk is not a denial
    await expect(page.locator('#disk-count')).toHaveText(before!);
    await expect(page.locator('#files')).not.toContainText('fallback');
  });

  test('the agent refuses a scheme it may not use, before the broker is asked', async ({ page }) => {
    await page.locator('#cmd-input').fill('navigate to ftp://example.com/x');
    await page.locator('#cmd button').click();

    await page.locator('#hitl-approve').click();
    await expect(page.locator('#out-body')).toContainText('refused scheme ftp:');
    await expect(page.locator('#frame-wrap')).toBeHidden();
  });

  test('the disk survives a reload', async ({ page }) => {
    await page.locator('#cmd-input').fill('write /persisted.md "still here"');
    await page.locator('#cmd button').click();
    await expect(page.locator('#files')).toContainText('/persisted.md');

    await page.reload();
    await expect(page.locator('#files')).toContainText('/persisted.md');
    await expect(page.locator('#bus li').last()).toContainText('disk restored');

    // reset is the only way out, and it is durable too
    await page.locator('#btn-reset').click();
    await expect(page.locator('#bus li').first()).toContainText('reset');
    await page.reload();
    await expect(page.locator('#files')).not.toContainText('/persisted.md');
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

  test('the sample rail outlives the first run', async ({ page }) => {
    const chips = page.locator('#rail .chip');
    const before = await chips.count();
    expect(before).toBeGreaterThanOrEqual(3);

    await page.locator('#cmd-input').fill('list files');
    await page.locator('#cmd button').click();
    await expect(page.locator('#welcome')).toHaveClass(/hide/);
    await expect(chips).toHaveCount(before);
  });

  test('the console explains nothing — that is the explainer\'s job', async ({ page }) => {
    // one surface, one job: no catalogue, no grammar table, no walkthrough
    await expect(page.locator('#samples')).toHaveCount(0);
    await expect(page.locator('#grammar')).toHaveCount(0);
    await expect(page.locator('#walkthrough')).toHaveCount(0);
    await expect(page.locator('a[href="./explain.html"]').first()).toBeVisible();
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
    await expect(page.locator('#map .node')).toHaveCount(5);
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
    await expect(page.locator('[data-pane="run"]')).toBeVisible();
    await expect(page.locator('[data-pane="inspect"]')).toBeVisible();
    await expect(page.locator('#tabbar')).toBeHidden();
    await expect(page.locator('.keys')).toBeVisible();
    await expect(page.locator('#rail')).toBeHidden();
  });

  test('keyboard: focus, history and approve', async ({ page }) => {
    // the keyboard surface must be live as soon as the page is, not once
    // IndexedDB has answered
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
    await expect(page.locator('#hitl')).toHaveAttribute('open', '');
    // the dialog focuses APPROVE, so Y works without first blurring anything
    await page.keyboard.press('y');
    await expect(page.locator('#hitl')).not.toHaveAttribute('open', '');
    await expect(page.locator('#out-body')).toContainText('example.com');
  });
});

test.describe('Mobile view', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(isDesktop(info.project.name), 'mobile only');
    await page.goto('./index.html');
  });

  test('two tabs, one pane at a time', async ({ page }) => {
    await expect(page.locator('body')).toHaveAttribute('data-view', 'mobile');
    await expect(page.locator('#tabbar button')).toHaveCount(2);
    await expect(page.locator('[data-pane="run"]')).toBeVisible();
    await expect(page.locator('[data-pane="inspect"]')).toBeHidden();

    await page.locator('#tabbar button[data-tab="inspect"]').click();
    await expect(page.locator('[data-pane="inspect"]')).toBeVisible();
    await expect(page.locator('[data-pane="run"]')).toBeHidden();
    await expect(page.locator('#tabbar button[data-tab="inspect"]')).toHaveAttribute('aria-selected', 'true');
    // disk and bus are one surface now, not two tabs
    await expect(page.locator('#files')).toBeVisible();
    await expect(page.locator('#bus')).toBeVisible();
  });

  test('the tab bar uses words, not glyphs', async ({ page }) => {
    await expect(page.locator('#tabbar')).toContainText('Run');
    await expect(page.locator('#tabbar')).toContainText('Inspect');
    await expect(page.locator('#tabbar svg')).toHaveCount(0);
  });

  test('the page is the only scroller', async ({ page }) => {
    // three nested scrollers meant no gesture had an obvious target
    const nested = await page.evaluate(() => [...document.querySelectorAll('.pane, .run-body')]
      .filter((n) => getComputedStyle(n).overflowY === 'auto' || getComputedStyle(n).overflowY === 'scroll').length);
    expect(nested).toBe(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  });

  test('the dock stays put while the page scrolls', async ({ page }) => {
    await expect(page.locator('#cmd-input')).toBeVisible();
    await page.locator('#tabbar button[data-tab="inspect"]').click();
    await page.mouse.wheel(0, 1200);
    await expect(page.locator('#cmd-input')).toBeVisible();
    await expect(page.locator('#tabbar')).toBeVisible();
  });

  test('the rail shows every chip it has — nothing behind a fade', async ({ page }) => {
    const chips = page.locator('#rail .chip');
    await expect(chips).toHaveCount(3);
    for (let i = 0; i < 3; i++) await expect(chips.nth(i)).toBeInViewport();

    await page.locator('#tabbar button[data-tab="inspect"]').click();
    await expect(chips.first()).toBeVisible();
    await expect(page.locator('#cmd-input')).toBeVisible();
  });

  test('running from the other tab jumps back to the result', async ({ page }) => {
    await page.locator('#tabbar button[data-tab="inspect"]').click();
    await page.locator('#rail .chip').first().click();
    await expect(page.locator('body')).toHaveAttribute('data-tab', 'run');
    await expect(page.locator('#out')).toHaveClass(/show/);
  });

  test('the bus shows twelve rows until asked for the rest', async ({ page }) => {
    for (const intent of ['list files', 'write /a.md "a"', 'write /b.md "b"', 'read /a.md']) {
      await page.locator('#cmd-input').fill(intent);
      await page.locator('#cmd button').click();
      await expect(page.locator('#cmd button')).toBeEnabled();
    }
    await page.locator('#tabbar button[data-tab="inspect"]').click();

    const rows = page.locator('#bus li');
    expect(await rows.count()).toBeGreaterThan(12);
    expect(await rows.evaluateAll((ns) => ns.filter((n) => n.checkVisibility()).length)).toBe(12);

    await page.locator('#btn-bus-all').click();
    expect(await rows.evaluateAll((ns) => ns.filter((n) => n.checkVisibility()).length)).toBe(await rows.count());
  });

  test('the inspect tab flags unread activity', async ({ page }) => {
    await page.locator('#rail .chip').first().click();
    await expect(page.locator('#tabbar button[data-tab="inspect"]')).toHaveAttribute('data-unread', 'true');
    await page.locator('#tabbar button[data-tab="inspect"]').click();
    await expect(page.locator('#tabbar button[data-tab="inspect"]')).toHaveAttribute('data-unread', 'false');
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
