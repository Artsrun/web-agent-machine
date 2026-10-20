/* Web Agent Machine — kernel.
   Pure logic: no DOM, no styling. The console imports this; so does
   tests/unit/kernel.test.js, in bare Node, with no browser at all.
   Types live in ./protocol.d.ts and are checked by `npm run typecheck`. */

/* Layer identity — which part of the machine spoke. Never a state: a green
   here would mean "storage", not "it worked". The two scales stay disjoint. */
export const LAYERS = {
  intent: { label: 'Intent', color: 'var(--layer-intent)' },
  kernel: { label: 'Kernel', color: 'var(--layer-kernel)' },
  policy: { label: 'Broker', color: 'var(--layer-broker)' },
  agent: { label: 'Agents', color: 'var(--layer-agent)' },
  store: { label: 'Storage', color: 'var(--layer-store)' },
};

/* ── EventBus ─────────────────────────────────────────────── */
/** @typedef {import('./protocol.js').AgentEvent} AgentEvent */
/** @typedef {import('./protocol.js').CapRequest} CapRequest */
/** @typedef {import('./protocol.js').CapResponse} CapResponse */
/** @typedef {import('./protocol.js').CapHandler} CapHandler */
/** @typedef {import('./protocol.js').PlanStep} PlanStep */
/** @typedef {(e: AgentEvent) => unknown} Listener */

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Listener>>} */ this.handlers = new Map();
    /** @type {Set<Listener>} */ this.all = new Set();
  }
  /**
   * @param {AgentEvent['type'] | '*'} type
   * @param {Listener} h
   * @returns {() => void} unsubscribe
   */
  on(type, h) {
    if (type === '*') { this.all.add(h); return () => { this.all.delete(h); }; }
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)?.add(h);
    return () => { this.handlers.get(type)?.delete(h); };
  }
  /** @param {AgentEvent} ev */
  async emit(ev) {
    const tasks = [];
    for (const h of this.handlers.get(ev.type) || []) tasks.push(Promise.resolve(h(ev)));
    for (const h of this.all) tasks.push(Promise.resolve(h(ev)));
    await Promise.all(tasks);
  }
}

/* ── CapabilityBroker ─────────────────────────────────────── */
/** @type {import('./protocol.js').CapabilityDef[]} */
export const CAPABILITIES = [
  { id: 'filesystem.list', risk: 'low', blurb: 'Enumerate the virtual disk.' },
  { id: 'filesystem.read', risk: 'low', blurb: 'Read one path from the virtual disk.' },
  { id: 'filesystem.write', risk: 'medium', blurb: 'Create or overwrite a path.' },
  { id: 'browser.navigate', risk: 'high', blurb: 'Load a URL into a sandboxed frame you can see.' },
];

export class CapabilityBroker {
  /** @param {import('./protocol.js').CapabilityDef[]} defs */
  constructor(defs = CAPABILITIES) {
    this.registry = new Map(defs.map((d) => [d.id, d]));
    /** @type {Map<string, import('./protocol.js').Grant[]>} */ this.grants = new Map();
    /** @type {Map<string, CapHandler>} */ this.handlers = new Map();
    /** @type {Map<string, Set<string>>} */ this.approved = new Map();
  }
  /** @param {string} cap @param {CapHandler} fn */
  handle(cap, fn) { this.handlers.set(cap, fn); }
  /** @param {import('./protocol.js').Grant} g */
  grant(g) { const list = this.grants.get(g.principal) || []; list.push(g); this.grants.set(g.principal, list); }
  /** @param {string} principal @param {string} cap */
  approve(principal, cap) {
    if (!this.approved.has(principal)) this.approved.set(principal, new Set());
    this.approved.get(principal)?.add(cap);
  }
  /** @param {string} cap */
  needsHITL(cap) {
    const def = this.registry.get(cap);
    return !!def && (def.risk === 'high' || def.requiresHITL);
  }
  /** @param {CapRequest} req @returns {Promise<CapResponse>} */
  async request(req) {
    const def = this.registry.get(req.capability);
    if (!def) return { ok: false, error: 'unknown capability' };
    const has = (this.grants.get(req.principal) || []).some((g) => g.capability === req.capability);
    // Ungranted is terminal: approval cannot conjure a grant, so never prompt for one.
    if (!has) return { ok: false, error: `not granted to ${req.principal}` };
    const needs = this.needsHITL(req.capability);
    const okHITL = this.approved.get(req.principal)?.has(req.capability);
    if (needs && !okHITL) return { ok: false, error: 'HITL required', requiresHITL: true };
    // A one-shot approval is spent on use — nothing stays granted because it was granted once.
    if (okHITL) this.approved.get(req.principal)?.delete(req.capability);
    const h = this.handlers.get(req.capability);
    return h ? h(req) : { ok: true, result: { echoed: req.args } };
  }
}

/* ── Agents ───────────────────────────────────────────────── */
export class FileAgent {
  /* onChange fires on every mutation. The agent does not know what persistence
     is — it announces, and the console decides where that lands. */
  /**
   * @param {Record<string, string>} seed
   * @param {{ onChange?: (store: Map<string, string>) => unknown | Promise<unknown> }} [opts]
   */
  constructor(seed = {}, opts = {}) {
    this.seed = { ...seed };
    this.store = new Map(Object.entries(seed));
    this.onChange = opts.onChange;
  }
  /** @param {Iterable<[string, string]>} entries */
  load(entries) { this.store = new Map(entries); }
  async reset() { this.store = new Map(Object.entries(this.seed)); await this.onChange?.(this.store); }
  /** @type {Record<string, CapHandler>} */
  handlers = {
    'filesystem.read': async (req) => {
      const path = String(/** @type {any} */ (req.args)?.path || '/');
      if (!this.store.has(path)) return { ok: false, error: `ENOENT ${path}` };
      return { ok: true, result: this.store.get(path) };
    },
    'filesystem.list': async () => ({ ok: true, result: [...this.store.keys()] }),
    'filesystem.write': async (req) => {
      const { path, content } = /** @type {any} */ (req.args) || {};
      if (!path) return { ok: false, error: 'path required' };
      this.store.set(path, content ?? '');
      // Await the persist: reporting a write as ok before it is durable means a
      // reload one keystroke later silently loses it.
      await this.onChange?.(this.store);
      return { ok: true, result: { written: path, bytes: String(content ?? '').length } };
    },
  };
}

export class BrowserAgent {
  /* The kernel stays DOM-free, so the agent is handed a surface instead of a
     document: anything with navigate(url) -> { ok, error? }. The console
     supplies a sandboxed iframe; a test can supply a spy. */
  /** @param {import('./protocol.js').BrowserSurface} surface */
  constructor(surface) {
    this.surface = surface;
    this.url = 'about:blank';
    /** @type {{ action: string, url: string, ok: boolean }[]} */ this.history = [];
  }
  reset() { this.url = 'about:blank'; this.history = []; this.surface?.clear?.(); }
  /** @type {Record<string, CapHandler>} */
  handlers = {
    'browser.navigate': async (req) => {
      const raw = /** @type {any} */ (req.args)?.url;
      if (!raw) return { ok: false, error: 'url required' };

      /** @type {URL} */ let target;
      try { target = new URL(String(raw)); } catch { return { ok: false, error: `unparseable url: ${raw}` }; }
      if (!/^https?:$/.test(target.protocol)) {
        return { ok: false, error: `refused scheme ${target.protocol} — http and https only` };
      }
      // The frame runs with allow-same-origin so real sites render. That is only
      // safe while the agent can never aim it at us: an agent that can frame its
      // own origin with scripts enabled is an agent that can rewrite the console.
      if (typeof location !== 'undefined' && target.origin === location.origin) {
        return { ok: false, error: 'refused: the agent may not frame its own origin' };
      }

      const res = await this.surface.navigate(target.href);
      this.history.push({ action: 'navigate', url: target.href, ok: res.ok });
      if (!res.ok) return { ok: false, error: res.error || 'frame refused the url' };
      this.url = target.href;
      // We committed a URL to a frame. Whether the site permits framing is the
      // site's decision and it is visible on screen — so do not claim it loaded.
      return { ok: true, result: { committed: target.href, frame: 'sandboxed, no cookies, no storage' } };
    },
  };
}

/* ── Planner ──────────────────────────────────────────────────
   One definition, stringified into the worker below, so the
   main thread and the worker can never drift apart.          */
/** @param {string} text @returns {PlanStep[]} */
export function plan(text) {
  const lower = text.toLowerCase();
  const id = () => crypto.randomUUID();
  const path = (text.match(/(\/[\w.\-/]+)/) || [])[1];
  const bare = (text.match(/\b((?:[\w-]+\.)+(?:com|org|net|io|dev|ai|sh|app|md))\b/) || [])[1];
  // Any explicit scheme is preserved verbatim — the agent decides what it may
  // use. Only a bare domain gets a scheme chosen for it.
  const url = (text.match(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"']+/i) || [])[0]
    || (bare ? `https://${bare}` : null);
  const quoted = (text.match(/["'`]([^"'`]+)["'`]/) || [])[1];

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
  if (/\b(navigate|go to|open url|browse|visit)\b/.test(lower) || url) {
    const u = url || 'https://example.com';
    return [{ id: id(), description: `Navigate to ${u}`, capability: 'browser.navigate', args: { url: u } }];
  }
  return [{ id: id(), description: 'Acknowledge intent (no tool matched)' }];
}

/* ── WorkerBridge ─────────────────────────────────────────── */
export class WorkerBridge {
  constructor() {
    // A Worker needs a browser. Outside one — Node, a unit test, a server —
    // fall through to the same planner rather than failing to construct. The
    // header above claims this file is importable on its own; this is what
    // makes that true rather than aspirational.
    /** @type {Worker | null} */ this.worker = null;
    this.broken = false;
    if (typeof Worker !== 'function' || typeof URL?.createObjectURL !== 'function') {
      this.broken = true;
      return;
    }
    const src = `${plan.toString()}
      self.onmessage = (e) => self.postMessage({ id: e.data.id, steps: plan(e.data.text) });`;
    this.url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
    this.worker = new Worker(this.url);
    /** @type {Map<string, (steps: PlanStep[]) => void>} */ this.pending = new Map();
    this.worker.onmessage = (e) => {
      const { id, steps } = e.data;
      this.pending.get(id)?.(steps);
      this.pending.delete(id);
    };
    // A worker that dies must not hang the console — fall back to the same planner inline.
    this.worker.onerror = () => { this.broken = true; };
  }
  /** @param {string} text @returns {Promise<PlanStep[]>} */
  offloadPlan(text) {
    // `broken` and a null worker are the same condition; say so once here
    // rather than relying on the constructor's early return staying early.
    const worker = this.worker;
    if (this.broken || !worker) return Promise.resolve(plan(text));
    return new Promise((resolve) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => { this.pending.delete(id); resolve(plan(text)); }, 2000);
      this.pending.set(id, (steps) => { clearTimeout(timer); resolve(steps); });
      worker.postMessage({ id, text });
    });
  }
}

/* ── Kernel ───────────────────────────────────────────────── */
export class Kernel {
  constructor() {
    this.bus = new EventBus();
    this.broker = new CapabilityBroker();
    this.principal = 'desktop-agent';
    this.workerBridge = new WorkerBridge();
  }
  /** @param {string} cap */
  grant(cap) { this.broker.grant({ capability: cap, principal: this.principal }); }
  /** @param {string} cap */
  approve(cap) { this.broker.approve(this.principal, cap); }
  /** @param {Record<string, CapHandler>} handlers */
  registerAgent(handlers) { for (const [cap, fn] of Object.entries(handlers)) this.broker.handle(cap, fn); }

  /** @param {string} text */
  async handleIntent(text) {
    const intent = { id: crypto.randomUUID(), text, timestamp: Date.now() };
    await this.bus.emit({ type: 'intent', payload: intent });
    const steps = await this.workerBridge.offloadPlan(text);
    const planObj = { id: crypto.randomUUID(), intentId: intent.id, steps };
    await this.bus.emit({ type: 'plan', payload: planObj });
    for (const step of steps) {
      if (!step.capability) {
        await this.bus.emit({ type: 'noop', payload: { description: step.description, text } });
        continue;
      }
      const stopped = await this.execute(step.capability, step.args || {});
      if (stopped) break;
    }
    return { intent, plan: planObj };
  }

  /** @param {string} capability @param {Record<string, unknown>} args @returns {Promise<boolean>} stopped */
  async execute(capability, args) {
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
    await this.bus.emit({ type: 'error', payload: { code: 'TOOL_FAILED', message: result.error || `${capability} failed`, recoverable: false, capability } });
    return false;
  }

  /* A denial is terminal. Nothing is retried, and nothing is written on the
     agent's behalf to soften it — "denied" has to mean denied, or the gate
     is decoration. The record of the refusal lives on the bus. */
  /** @param {string} capability @param {unknown} args */
  async deny(capability, args) {
    await this.bus.emit({ type: 'denied', payload: { capability, args } });
  }
}
