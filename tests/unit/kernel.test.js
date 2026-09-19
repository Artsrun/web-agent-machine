/* Kernel semantics, in bare Node, with no browser and no Playwright.

   These are the rules the product is actually about — one-shot approval,
   ungranted-is-terminal, a refusal that refuses — and until now the only
   thing asserting them was a UI test driving a real Chromium. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  EventBus, CapabilityBroker, CAPABILITIES, FileAgent, BrowserAgent,
  WorkerBridge, Kernel, plan,
} from '../../site/kernel.js';

const P = 'agent-under-test';
const req = (capability, args = {}) => ({ requestId: 'r', capability, args, principal: P });

/** A broker with every capability granted to one principal, like the console. */
const grantedBroker = () => {
  const b = new CapabilityBroker();
  for (const c of CAPABILITIES) b.grant({ capability: c.id, principal: P });
  return b;
};

describe('CapabilityBroker', () => {
  test('an unknown capability is refused without reaching a handler', async () => {
    const b = grantedBroker();
    const r = await b.request(req('filesystem.obliterate'));
    assert.equal(r.ok, false);
    assert.equal(r.error, 'unknown capability');
  });

  test('an ungranted capability is terminal, and never prompts', async () => {
    // Prompting for something approval cannot unlock is an infinite loop,
    // not a policy: approve it and it must still refuse for the same reason.
    const b = new CapabilityBroker();
    const first = await b.request(req('filesystem.list'));
    assert.equal(first.ok, false);
    assert.match(first.error, /not granted/);
    assert.equal(first.requiresHITL, undefined);

    b.approve(P, 'filesystem.list');
    const second = await b.request(req('filesystem.list'));
    assert.equal(second.ok, false);
    assert.match(second.error, /not granted/);
  });

  test('a grant to one principal does not serve another', async () => {
    const b = new CapabilityBroker();
    b.grant({ capability: 'filesystem.list', principal: 'someone-else' });
    const r = await b.request(req('filesystem.list'));
    assert.equal(r.ok, false);
    assert.match(r.error, /not granted/);
  });

  test('low and medium risk run without asking', async () => {
    const b = grantedBroker();
    b.handle('filesystem.list', async () => ({ ok: true, result: [] }));
    b.handle('filesystem.write', async () => ({ ok: true, result: 'written' }));
    assert.equal((await b.request(req('filesystem.list'))).ok, true);
    assert.equal((await b.request(req('filesystem.write'))).ok, true);
  });

  test('high risk stops for a human even when granted', async () => {
    const b = grantedBroker();
    b.handle('browser.navigate', async () => ({ ok: true, result: 'went' }));
    const r = await b.request(req('browser.navigate'));
    assert.equal(r.ok, false);
    assert.equal(r.requiresHITL, true);
  });

  test('an approval is spent on use — the next call asks again', async () => {
    // The single best idea in this repository, asserted directly.
    const b = grantedBroker();
    let calls = 0;
    b.handle('browser.navigate', async () => { calls += 1; return { ok: true, result: 'went' }; });

    b.approve(P, 'browser.navigate');
    assert.equal((await b.request(req('browser.navigate'))).ok, true);
    assert.equal(calls, 1);

    const again = await b.request(req('browser.navigate'));
    assert.equal(again.ok, false, 'a spent approval must not carry over');
    assert.equal(again.requiresHITL, true);
    assert.equal(calls, 1, 'the handler must not run a second time');
  });

  test('requiresHITL forces approval on a risk level that would not', async () => {
    const b = new CapabilityBroker([{ id: 'x.y', risk: 'low', blurb: 'x', requiresHITL: true }]);
    b.grant({ capability: 'x.y', principal: P });
    assert.equal((await b.request(req('x.y'))).requiresHITL, true);
  });
});

describe('FileAgent', () => {
  test('a missing path is a value, not an exception', async () => {
    const f = new FileAgent();
    const r = await f.handlers['filesystem.read']({ args: { path: '/nope' } });
    assert.equal(r.ok, false);
    assert.match(r.error, /^ENOENT/);
  });

  test('a write awaits its persist before reporting ok', async () => {
    // Reporting a write durable before it is means a reload one keystroke
    // later silently loses the file.
    const order = [];
    const f = new FileAgent({}, {
      onChange: async () => { await new Promise((r) => setTimeout(r, 10)); order.push('persisted'); },
    });
    await f.handlers['filesystem.write']({ args: { path: '/a.md', content: 'x' } });
    order.push('returned');
    assert.deepEqual(order, ['persisted', 'returned']);
  });

  test('reset restores the seed and announces it', async () => {
    let seen = null;
    const f = new FileAgent({ '/readme.md': 'seed' }, { onChange: (s) => { seen = [...s.keys()]; } });
    await f.handlers['filesystem.write']({ args: { path: '/scratch.md', content: 'x' } });
    assert.equal(f.store.size, 2);
    await f.reset();
    assert.deepEqual([...f.store.keys()], ['/readme.md']);
    assert.deepEqual(seen, ['/readme.md'], 'reset must persist, or a reload resurrects the file');
  });
});

describe('BrowserAgent', () => {
  const spy = () => {
    const calls = [];
    return { calls, navigate: async (url) => { calls.push(url); return { ok: true }; } };
  };

  test('vets the scheme before the surface is touched', async () => {
    const s = spy();
    const r = await new BrowserAgent(s).handlers['browser.navigate']({ args: { url: 'ftp://example.com/x' } });
    assert.equal(r.ok, false);
    assert.match(r.error, /refused scheme ftp:/);
    assert.deepEqual(s.calls, []);
  });

  test('refuses to frame its own origin', async () => {
    // allow-same-origin plus allow-scripts aimed back at the console is an
    // agent that can rewrite its own permission prompt.
    globalThis.location = { origin: 'https://console.example' };
    try {
      const s = spy();
      const r = await new BrowserAgent(s).handlers['browser.navigate']({ args: { url: 'https://console.example/x' } });
      assert.equal(r.ok, false);
      assert.match(r.error, /own origin/);
      assert.deepEqual(s.calls, []);
    } finally { delete globalThis.location; }
  });

  test('claims only what it can observe', async () => {
    const s = spy();
    const r = await new BrowserAgent(s).handlers['browser.navigate']({ args: { url: 'https://example.com' } });
    assert.equal(r.ok, true);
    assert.equal(r.result.committed, 'https://example.com/');
    assert.equal('loaded' in r.result, false, 'a commit is not a load');
  });

  test('a surface that refuses is reported, not swallowed', async () => {
    const r = await new BrowserAgent({ navigate: async () => ({ ok: false, error: 'blocked' }) })
      .handlers['browser.navigate']({ args: { url: 'https://example.com' } });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'blocked');
  });
});

describe('planner', () => {
  const capOf = (text) => plan(text)[0].capability;

  test('matches its four verbs', () => {
    assert.equal(capOf('list files'), 'filesystem.list');
    assert.equal(capOf('read /readme.md'), 'filesystem.read');
    assert.equal(capOf('write /a.md "hi"'), 'filesystem.write');
    assert.equal(capOf('navigate to example.com'), 'browser.navigate');
  });

  test('declines rather than inventing a capability', () => {
    const [step] = plan('tell me a joke');
    assert.equal(step.capability, undefined);
    assert.match(step.description, /no tool matched/i);
  });

  test('preserves an explicit scheme instead of rewriting it', () => {
    // It used to strip ftp:// and substitute https:// via the bare-domain branch.
    assert.equal(plan('navigate to ftp://example.com/x')[0].args.url, 'ftp://example.com/x');
    assert.equal(plan('navigate to example.com')[0].args.url, 'https://example.com');
  });

  test('click is gone, and is declined like any other unmatched verb', () => {
    assert.equal(plan('click #submit')[0].capability, undefined);
  });
});

describe('WorkerBridge', () => {
  test('plans inline where there is no Worker, rather than failing to construct', async () => {
    const w = new WorkerBridge();
    assert.equal(w.broken, true);
    assert.equal(w.worker, null);
    assert.equal((await w.offloadPlan('list files'))[0].capability, 'filesystem.list');
  });
});

describe('Kernel', () => {
  const boot = () => {
    const k = new Kernel();
    const files = new FileAgent({ '/readme.md': 'seed' });
    const surface = { navigate: async () => ({ ok: true }) };
    k.registerAgent(files.handlers);
    k.registerAgent(new BrowserAgent(surface).handlers);
    for (const c of CAPABILITIES) k.grant(c.id);
    const seen = [];
    k.bus.on('*', (e) => seen.push(e.type));
    return { k, files, seen };
  };

  test('a low-risk intent runs end to end', async () => {
    const { k, seen } = boot();
    await k.handleIntent('list files');
    assert.deepEqual(seen, ['intent', 'plan', 'tool_call', 'tool_result']);
  });

  test('an unmatched intent emits noop and calls nothing', async () => {
    const { k, seen } = boot();
    await k.handleIntent('tell me a joke');
    assert.deepEqual(seen, ['intent', 'plan', 'noop']);
  });

  test('a high-risk intent stops at the broker and runs nothing', async () => {
    const { k, seen } = boot();
    await k.handleIntent('navigate to example.com');
    assert.deepEqual(seen, ['intent', 'plan', 'tool_call', 'tool_result', 'error']);
  });

  test('denial writes nothing in its place', async () => {
    // The old kernel answered a denied navigate by writing /nav-fallback.txt.
    const { k, files, seen } = boot();
    await k.handleIntent('navigate to example.com');
    const before = [...files.store.keys()];
    await k.deny('browser.navigate', { url: 'https://example.com' });
    assert.equal(seen.at(-1), 'denied');
    assert.deepEqual([...files.store.keys()], before);
  });

  test('approving then executing consumes the approval', async () => {
    const { k } = boot();
    k.approve('browser.navigate');
    assert.equal(await k.execute('browser.navigate', { url: 'https://example.com' }), false);
    // stopped === true means the broker halted it: the approval is spent
    assert.equal(await k.execute('browser.navigate', { url: 'https://example.com' }), true);
  });

  test('a failing tool is an error event, not a throw', async () => {
    const { k, seen } = boot();
    await k.handleIntent('read /does-not-exist.md');
    assert.equal(seen.at(-1), 'error');
  });
});

describe('EventBus', () => {
  test('unsubscribes cleanly', async () => {
    const bus = new EventBus();
    let n = 0;
    const off = bus.on('intent', () => { n += 1; });
    await bus.emit({ type: 'intent', payload: {} });
    off();
    await bus.emit({ type: 'intent', payload: {} });
    assert.equal(n, 1);
  });

  test('awaits async listeners before resolving', async () => {
    const bus = new EventBus();
    let done = false;
    bus.on('*', async () => { await new Promise((r) => setTimeout(r, 10)); done = true; });
    await bus.emit({ type: 'intent', payload: {} });
    assert.equal(done, true);
  });
});
