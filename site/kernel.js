/* Web Agent Machine — kernel.
   Pure logic: no DOM, no styling. The console imports this; so can a test. */

export const LAYERS = {
  intent: { label: 'Intent', color: 'var(--l-intent)' },
  kernel: { label: 'Kernel', color: 'var(--l-kernel)' },
  router: { label: 'Router', color: 'var(--l-conc)' },
  policy: { label: 'Broker', color: 'var(--l-policy)' },
  agent: { label: 'Agents', color: 'var(--l-wasm)' },
  store: { label: 'Storage', color: 'var(--l-store)' },
};

/* ── EventBus ─────────────────────────────────────────────── */
export class EventBus {
  constructor() { this.handlers = new Map(); this.all = new Set(); }
  on(type, h) {
    if (type === '*') { this.all.add(h); return () => this.all.delete(h); }
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(h);
    return () => this.handlers.get(type)?.delete(h);
  }
  async emit(ev) {
    const tasks = [];
    for (const h of this.handlers.get(ev.type) || []) tasks.push(Promise.resolve(h(ev)));
    for (const h of this.all) tasks.push(Promise.resolve(h(ev)));
    await Promise.all(tasks);
  }
}

/* ── CapabilityBroker ─────────────────────────────────────── */
export const CAPABILITIES = [
  { id: 'filesystem.list', risk: 'low', blurb: 'Enumerate the virtual disk.' },
  { id: 'filesystem.read', risk: 'low', blurb: 'Read one path from the virtual disk.' },
  { id: 'filesystem.write', risk: 'medium', blurb: 'Create or overwrite a path.' },
  { id: 'browser.navigate', risk: 'high', blurb: 'Point the browser agent at a URL.' },
  { id: 'browser.click', risk: 'high', blurb: 'Click a selector on the current page.' },
];

export class CapabilityBroker {
  constructor(defs = CAPABILITIES) {
    this.registry = new Map(defs.map((d) => [d.id, d]));
    this.grants = new Map();
    this.handlers = new Map();
    this.approved = new Map();
  }
  handle(cap, fn) { this.handlers.set(cap, fn); }
  grant(g) { const list = this.grants.get(g.principal) || []; list.push(g); this.grants.set(g.principal, list); }
  approve(principal, cap) {
    if (!this.approved.has(principal)) this.approved.set(principal, new Set());
    this.approved.get(principal).add(cap);
  }
  needsHITL(cap) {
    const def = this.registry.get(cap);
    return !!def && (def.risk === 'high' || def.requiresHITL);
  }
  async request(req) {
    const def = this.registry.get(req.capability);
    if (!def) return { ok: false, error: 'unknown capability' };
    const has = (this.grants.get(req.principal) || []).some((g) => g.capability === req.capability);
    if (!has) return { ok: false, error: 'no grant', requiresHITL: def.risk === 'high' };
    const needs = this.needsHITL(req.capability);
    const okHITL = this.approved.get(req.principal)?.has(req.capability);
    if (needs && !okHITL) return { ok: false, error: 'HITL required', requiresHITL: true };
    // A one-shot approval is spent on use — nothing stays granted because it was granted once.
    if (okHITL) this.approved.get(req.principal).delete(req.capability);
    const h = this.handlers.get(req.capability);
    return h ? h(req) : { ok: true, result: { echoed: req.args } };
  }
}

/* ── Agents ───────────────────────────────────────────────── */
export class FileAgent {
  constructor(seed = {}) { this.seed = { ...seed }; this.store = new Map(Object.entries(seed)); }
  reset() { this.store = new Map(Object.entries(this.seed)); }
  handlers = {
    'filesystem.read': async (req) => {
      const path = req.args?.path || '/';
      if (!this.store.has(path)) return { ok: false, error: `ENOENT ${path}` };
      return { ok: true, result: this.store.get(path) };
    },
    'filesystem.list': async () => ({ ok: true, result: [...this.store.keys()] }),
    'filesystem.write': async (req) => {
      const { path, content } = req.args || {};
      if (!path) return { ok: false, error: 'path required' };
      this.store.set(path, content ?? '');
      return { ok: true, result: { written: path, bytes: String(content ?? '').length } };
    },
  };
}

export class BrowserAgent {
  constructor() { this.url = 'about:blank'; this.history = []; }
  reset() { this.url = 'about:blank'; this.history = []; }
  handlers = {
    'browser.navigate': async (req) => {
      const url = req.args?.url;
      if (!url) return { ok: false, error: 'url required' };
      this.url = url;
      this.history.push({ action: 'navigate', url });
      return { ok: true, result: { navigated: true, url } };
    },
    'browser.click': async (req) => {
      const sel = req.args?.selector;
      if (!sel) return { ok: false, error: 'selector required' };
      this.history.push({ action: 'click', selector: sel });
      return { ok: true, result: { clicked: sel, on: this.url } };
    },
  };
}

/* ── Planner ──────────────────────────────────────────────────
   One definition, stringified into the worker below, so the
   main thread and the worker can never drift apart.          */
export function plan(text) {
  const lower = text.toLowerCase();
  const id = () => crypto.randomUUID();
  const path = (text.match(/(\/[\w.\-/]+)/) || [])[1];
  const url = (text.match(/\bhttps?:\/\/[^\s"']+/) || [])[0]
    || ((text.match(/\b((?:[\w-]+\.)+(?:com|org|net|io|dev|ai|sh|app|md))\b/) || [])[1]
      ? 'https://' + text.match(/\b((?:[\w-]+\.)+(?:com|org|net|io|dev|ai|sh|app|md))\b/)[1]
      : null);
  const quoted = (text.match(/["'`]([^"'`]+)["'`]/) || [])[1];
  const selector = (text.match(/\bclick\s+(?:on\s+)?([#.][\w-]+)/i) || [])[1];

  if (/\b(write|save|create|touch)\b/.test(lower) && !/\bfile\s*(system)?\.read\b/.test(lower)) {
    const p = path || '/notes.txt';
    return [{ id: id(), description: `Write ${p}`, capability: 'filesystem.write',
      args: { path: p, content: quoted || 'hello from agent' } }];
  }
  if (/\b(list|ls|dir|show files|what files)\b/.test(lower)) {
    return [{ id: id(), description: 'List the virtual disk', capability: 'filesystem.list', args: { path: '/' } }];
  }
  if (/\b(read|open|show|cat|print)\b/.test(lower) && (path || /\b(file|notes|readme)\b/.test(lower))) {
    const p = path || (/readme/.test(lower) ? '/readme.md' : '/notes.txt');
    return [{ id: id(), description: `Read ${p}`, capability: 'filesystem.read', args: { path: p } }];
  }
  if (/\bclick\b/.test(lower)) {
    return [{ id: id(), description: `Click ${selector || 'button'}`, capability: 'browser.click',
      args: { selector: selector || 'button' } }];
  }
  if (/\b(navigate|go to|open url|browse|visit)\b/.test(lower) || url) {
    const u = url || 'https://example.com';
    return [{ id: id(), description: `Navigate to ${u}`, capability: 'browser.navigate', args: { url: u } }];
  }
  return [{ id: id(), description: 'Acknowledge intent (no tool matched)' }];
}

/* ── ModelRouter ──────────────────────────────────────────── */
export class ModelRouter {
  static TIER_9B = /\b(architect(?:ure|ing|ural)?|design(?:s|ing)? a system|orchestrat(?:e|es|ing|ion)|multi[- ]agent|system design|end-?to-?end design)\b/i;
  static TIER_8B = /\b(refactor(?:s|ing|ed)?|plan(?:s|ning|ned)?|analy(?:ze|se|zing|sing|sis)|multi-?step|migrat(?:e|es|ing|ion)|optimi[sz]e(?:s|d|ing)?|debug(?:s|ging|ged)?|investigat(?:e|es|ing|ion)|compare|summari[sz]e)\b/i;
  route(text) {
    if (ModelRouter.TIER_9B.test(text)) return '9b';
    if (ModelRouter.TIER_8B.test(text)) return '8b';
    return '6b';
  }
}

/* ── WorkerBridge ─────────────────────────────────────────── */
export class WorkerBridge {
  constructor() {
    const src = `${plan.toString()}
      self.onmessage = (e) => self.postMessage({ id: e.data.id, steps: plan(e.data.text) });`;
    this.url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
    this.worker = new Worker(this.url);
    this.pending = new Map();
    this.worker.onmessage = (e) => {
      const { id, steps } = e.data;
      this.pending.get(id)?.(steps);
      this.pending.delete(id);
    };
    // A worker that dies must not hang the console — fall back to the same planner inline.
    this.worker.onerror = () => { this.broken = true; };
  }
  offloadPlan(text) {
    if (this.broken) return Promise.resolve(plan(text));
    return new Promise((resolve) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => { this.pending.delete(id); resolve(plan(text)); }, 2000);
      this.pending.set(id, (steps) => { clearTimeout(timer); resolve(steps); });
      this.worker.postMessage({ id, text });
    });
  }
}

/* ── Kernel ───────────────────────────────────────────────── */
export class Kernel {
  constructor() {
    this.bus = new EventBus();
    this.broker = new CapabilityBroker();
    this.principal = 'desktop-agent';
    this.modelRouter = new ModelRouter();
    this.workerBridge = new WorkerBridge();
    this.fallbacks = [
      { from: 'browser.navigate', to: 'filesystem.write',
        mapArgs: (a) => ({ path: '/nav-fallback.txt', content: `navigate blocked: ${(a && a.url) || '(no url provided)'}` }),
        reason: 'navigate denied/failed → log to file' },
      { from: 'browser.click', to: 'filesystem.write',
        mapArgs: (a) => ({ path: '/click-fallback.txt', content: `click blocked: ${JSON.stringify(a)}` }),
        reason: 'click denied/failed → log to file' },
    ];
  }
  grant(cap) { this.broker.grant({ capability: cap, principal: this.principal }); }
  approve(cap) { this.broker.approve(this.principal, cap); }
  registerAgent(handlers) { for (const [cap, fn] of Object.entries(handlers)) this.broker.handle(cap, fn); }

  async handleIntent(text) {
    const intent = { id: crypto.randomUUID(), text, timestamp: Date.now() };
    await this.bus.emit({ type: 'intent', payload: intent });
    const model = this.modelRouter.route(text);
    await this.bus.emit({ type: 'route', payload: { intentId: intent.id, model } });
    const steps = await this.workerBridge.offloadPlan(text);
    const planObj = { id: crypto.randomUUID(), intentId: intent.id, steps, model };
    await this.bus.emit({ type: 'plan', payload: planObj });
    for (const step of steps) {
      if (!step.capability) {
        await this.bus.emit({ type: 'noop', payload: { description: step.description, text } });
        continue;
      }
      const stopped = await this.executeWithFallback(step.capability, step.args || {});
      if (stopped) break;
    }
    return { intent, plan: planObj, model };
  }

  async executeWithFallback(capability, args, depth = 0) {
    if (depth > 2) return true;
    const callId = crypto.randomUUID();
    await this.bus.emit({ type: 'tool_call', payload: { id: callId, capability, args, principal: this.principal } });
    const result = await this.broker.request({ requestId: callId, capability, args, principal: this.principal });
    await this.bus.emit({ type: 'tool_result', payload: {
      callId, capability, args, ok: result.ok,
      result: result.ok ? result.result : undefined,
      error: result.ok ? undefined : result.error,
    } });
    if (result.ok) return false;
    if (result.requiresHITL) {
      await this.bus.emit({ type: 'error', payload: { code: 'HITL_REQUIRED', message: `Human approval needed for ${capability}`, recoverable: true, capability, args } });
      return true;
    }
    const rule = this.fallbacks.find((f) => f.from === capability);
    if (rule) {
      await this.bus.emit({ type: 'error', payload: { code: 'FALLBACK', message: rule.reason || `${capability} → ${rule.to}`, recoverable: true, capability, fallbackTo: rule.to } });
      return this.executeWithFallback(rule.to, rule.mapArgs ? rule.mapArgs(args) : args, depth + 1);
    }
    await this.bus.emit({ type: 'error', payload: { code: 'TOOL_FAILED', message: result.error || `${capability} failed`, recoverable: false, capability } });
    return false;
  }
}
