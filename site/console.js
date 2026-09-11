const LAYERS = { intent: { color: 'var(--l-intent)' }, kernel: { color: 'var(--l-kernel)' }, policy: { color: 'var(--l-policy)' }, conc: { color: 'var(--l-conc)' }, wasm: { color: 'var(--l-wasm)' }, store: { color: 'var(--l-store)' }, gfx: { color: 'var(--l-gfx)' } };
const q = (id) => document.getElementById(id);

class EventBus {
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

class CapabilityBroker {
  constructor() {
    this.registry = new Map([
      ['filesystem.read', { risk: 'low' }],
      ['filesystem.list', { risk: 'low' }],
      ['filesystem.write', { risk: 'medium' }],
      ['browser.navigate', { risk: 'high', requiresHITL: true }],
      ['browser.click', { risk: 'high', requiresHITL: true }],
    ]);
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
  async request(req) {
    const def = this.registry.get(req.capability);
    if (!def) return { ok: false, error: 'unknown capability' };
    const has = (this.grants.get(req.principal) || []).some(g => g.capability === req.capability);
    if (!has) return { ok: false, error: 'no grant', requiresHITL: def.risk === 'high' };
    const needs = def.risk === 'high' || def.requiresHITL;
    const okHITL = this.approved.get(req.principal)?.has(req.capability);
    if (needs && !okHITL) return { ok: false, error: 'HITL required', requiresHITL: true };
    if (okHITL) this.approved.get(req.principal).delete(req.capability);
    const h = this.handlers.get(req.capability);
    return h ? h(req) : { ok: true, result: { echoed: req.args } };
  }
}

class FileAgent {
  constructor(seed = {}) { this.store = new Map(Object.entries(seed)); }
  handlers = {
    'filesystem.read': async (req) => {
      const path = req.args?.path || '/';
      if (!this.store.has(path)) return { ok: false, error: 'ENOENT' };
      return { ok: true, result: this.store.get(path) };
    },
    'filesystem.list': async () => ({ ok: true, result: [...this.store.keys()] }),
    'filesystem.write': async (req) => {
      const { path, content } = req.args || {};
      if (!path) return { ok: false, error: 'path required' };
      this.store.set(path, content ?? '');
      return { ok: true, result: { written: path } };
    },
  };
}

class BrowserAgent {
  constructor() { this.url = 'about:blank'; this.history = []; }
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
      return { ok: true, result: { clicked: sel } };
    },
  };
}

function plan(text) {
  const lower = text.toLowerCase();
  const id = () => crypto.randomUUID();
  if (/write|save|create/.test(lower) && /file/.test(lower)) {
    return [{ id: id(), description: 'Write file', capability: 'filesystem.write', args: { path: '/notes.txt', content: 'hello from agent' } }];
  }
  if (/list|ls|dir/.test(lower)) {
    return [{ id: id(), description: 'List directory', capability: 'filesystem.list', args: { path: '/' } }];
  }
  if (/read|open|show|cat/.test(lower) && /file|notes/.test(lower)) {
    return [{ id: id(), description: 'Read file', capability: 'filesystem.read', args: { path: '/notes.txt' } }];
  }
  if (/navigate|go to|open url|browse/.test(lower)) {
    return [{ id: id(), description: 'Navigate browser', capability: 'browser.navigate', args: { url: 'https://example.com' } }];
  }
  return [{ id: id(), description: 'Acknowledge intent (no tool)' }];
}

class ModelRouter {
  static TIER_9B = /\b(architect(?:ure|ing|ural)?|design(?:s|ing)? a system|orchestrat(?:e|es|ing|ion)|multi[- ]agent|system design|end-?to-?end design)\b/i;
  static TIER_8B = /\b(refactor(?:s|ing|ed)?|plan(?:s|ning|ned)?|analy(?:ze|se|zing|sing|sis)|multi-?step|migrat(?:e|es|ing|ion)|optimi[sz]e(?:s|d|ing)?|debug(?:s|ging|ged)?|investigat(?:e|es|ing|ion)|compare|summari[sz]e)\b/i;
  route(text) {
    if (ModelRouter.TIER_9B.test(text)) return '9b';
    if (ModelRouter.TIER_8B.test(text)) return '8b';
    return '6b';
  }
}

class WorkerBridge {
  constructor() {
    const workerSrc = `
      function plan(text) {
        const lower = text.toLowerCase(); const id = () => crypto.randomUUID();
        if (/write|save|create/.test(lower) && /file/.test(lower)) return [{ id: id(), description: 'Write file', capability: 'filesystem.write', args: { path: '/notes.txt', content: 'hello from agent' } }];
        if (/list|ls|dir/.test(lower)) return [{ id: id(), description: 'List directory', capability: 'filesystem.list', args: { path: '/' } }];
        if (/read|open|show|cat/.test(lower) && /file|notes/.test(lower)) return [{ id: id(), description: 'Read file', capability: 'filesystem.read', args: { path: '/notes.txt' } }];
        if (/navigate|go to|open url|browse/.test(lower)) return [{ id: id(), description: 'Navigate browser', capability: 'browser.navigate', args: { url: 'https://example.com' } }];
        return [{ id: id(), description: 'Acknowledge intent (no tool)' }];
      }
      self.onmessage = (e) => {
        const { id, text } = e.data;
        self.postMessage({ id, steps: plan(text) });
      };
    `;
    this.worker = new Worker(URL.createObjectURL(new Blob([workerSrc], { type: 'application/javascript' })));
    this.pending = new Map();
    this.worker.onmessage = (e) => {
      const { id, steps } = e.data;
      this.pending.get(id)?.(steps);
      this.pending.delete(id);
    };
  }
  offloadPlan(text) {
    return new Promise((resolve) => {
      const id = crypto.randomUUID();
      this.pending.set(id, resolve);
      this.worker.postMessage({ id, text });
    });
  }
}

class Kernel {
  constructor() {
    this.bus = new EventBus();
    this.broker = new CapabilityBroker();
    this.principal = 'desktop-agent';
    this.modelRouter = new ModelRouter();
    this.workerBridge = new WorkerBridge();
    this.fallbacks = [
      { from: 'browser.navigate', to: 'filesystem.write', mapArgs: () => ({ path: '/nav-fallback.txt', content: 'navigate was blocked — logged instead' }), reason: 'navigate denied/failed → log to file' },
      { from: 'browser.click', to: 'filesystem.write', mapArgs: (args) => ({ path: '/click-fallback.txt', content: `click blocked: ${JSON.stringify(args)}` }), reason: 'click denied/failed → log to file' },
    ];
  }
  grant(cap) { this.broker.grant({ capability: cap, principal: this.principal }); }
  approve(cap) { this.broker.approve(this.principal, cap); }
  registerAgent(handlers) { for (const [cap, fn] of Object.entries(handlers)) this.broker.handle(cap, fn); }
  async handleIntent(text) {
    const intent = { id: crypto.randomUUID(), text, timestamp: Date.now() };
    await this.bus.emit({ type: 'intent', payload: intent });
    const model = this.modelRouter.route(text);
    const steps = await this.workerBridge.offloadPlan(text);
    const planObj = { id: crypto.randomUUID(), intentId: intent.id, steps, model };
    await this.bus.emit({ type: 'plan', payload: planObj });
    for (const step of steps) {
      if (!step.capability) continue;
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
    await this.bus.emit({ type: 'tool_result', payload: { callId, ok: result.ok, result: result.ok ? result.result : undefined, error: result.ok ? undefined : result.error } });
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

const files = new FileAgent({ '/readme.md': '# Web Agent Machine' });
const browser = new BrowserAgent();
const kernel = new Kernel();
kernel.registerAgent(files.handlers);
kernel.registerAgent(browser.handlers);
kernel.grant('filesystem.read');
kernel.grant('filesystem.list');
kernel.grant('filesystem.write');
kernel.grant('browser.navigate');
kernel.grant('browser.click');

const bus = q('bus');
const stamp = () => {
  const t = new Date();
  return t.toTimeString().slice(0, 8) + '.' + String(t.getMilliseconds()).padStart(3, '0');
};
const pushBus = (src, ev, msg, layer = 'kernel') => {
  const li = document.createElement('li');
  li.style.setProperty('--c', LAYERS[layer]?.color || 'var(--l-kernel)');
  const time = document.createElement('time'); time.textContent = stamp();
  const b = document.createElement('b'); b.textContent = src;
  const em = document.createElement('em'); em.textContent = ev;
  const span = document.createElement('span'); span.textContent = msg;
  li.append(time, b, em, span);
  bus.prepend(li);
  while (bus.children.length > 40) bus.lastElementChild.remove();
};

const showResult = (label, body, meta = '') => {
  q('empty').style.display = 'none';
  q('out').classList.add('show');
  q('out-label').textContent = label;
  q('out-meta').textContent = meta;
  q('out-body').textContent = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
};

const renderDisk = () => {
  const ul = q('files');
  ul.replaceChildren();
  for (const [path, content] of files.store) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = path;
    const size = document.createElement('em');
    size.textContent = `${String(content).length}b`;
    li.append(name, size);
    li.onclick = () => {
      showResult('filesystem.read', String(content), path);
      q('cmd-input').value = `read ${path}`;
    };
    ul.append(li);
  }
};

kernel.bus.on('*', (e) => {
  switch (e.type) {
    case 'intent':
      pushBus('kernel', 'intent', e.payload.text.slice(0, 48), 'kernel');
      break;
    case 'plan':
      pushBus('kernel', 'plan', `[${e.payload.model}] ` + e.payload.steps.map(s => s.description).join(' → '), 'kernel');
      q('out-meta').textContent = `model ${e.payload.model} · ${e.payload.steps.map(s => s.description).join(' → ')}`;
      break;
    case 'tool_call':
      pushBus('mesh', 'tool_call', e.payload.capability, 'intent');
      break;
    case 'tool_result':
      pushBus('broker', e.payload.ok ? 'grant' : 'deny', e.payload.ok ? JSON.stringify(e.payload.result).slice(0, 40) : e.payload.error, 'policy');
      if (e.payload.ok) {
        showResult('ok', e.payload.result);
        renderDisk();
      }
      break;
    case 'error':
      if (e.payload.code === 'HITL_REQUIRED') {
        pushBus('broker', 'HITL', e.payload.message, 'policy');
        showHITL(e.payload.capability, e.payload.args);
        showResult('waiting for you', e.payload.message + '\n\nApprove in the red bar below.');
      } else if (e.payload.code === 'HITL_DENIED') {
        pushBus('broker', 'denied', e.payload.message, 'policy');
      } else if (e.payload.code === 'FALLBACK') {
        pushBus('broker', 'fallback', e.payload.message, 'policy');
      } else {
        pushBus('broker', 'error', e.payload.message || e.payload.code, 'policy');
        showResult('error', e.payload.message || e.payload.code);
      }
      break;
  }
});

let pendingCap = null;
let pendingArgs = null;
const hitlBar = q('hitl');
function showHITL(cap, args) {
  pendingCap = cap;
  pendingArgs = args || {};
  q('hitl-cap').textContent = cap || '';
  hitlBar.classList.add('open');
}
q('hitl-approve').onclick = async () => {
  if (!pendingCap) return;
  const cap = pendingCap;
  const args = pendingArgs;
  kernel.approve(cap);
  pushBus('broker', 'approve', cap, 'policy');
  hitlBar.classList.remove('open');
  pendingCap = null;
  pendingArgs = null;
  await kernel.executeWithFallback(cap, args);
};
q('hitl-deny').onclick = async () => {
  const cap = pendingCap;
  if (!cap) { hitlBar.classList.remove('open'); return; }
  await kernel.bus.emit({ type: 'error', payload: { code: 'HITL_DENIED', message: `Human denied capability: ${cap}`, recoverable: true, capability: cap } });
  pushBus('broker', 'deny', cap, 'policy');
  hitlBar.classList.remove('open');
  pendingCap = null;
  const rule = kernel.fallbacks.find((f) => f.from === cap);
  if (rule) {
    await kernel.bus.emit({ type: 'error', payload: { code: 'FALLBACK', message: rule.reason || `${cap} denied → ${rule.to}`, recoverable: true, capability: cap, fallbackTo: rule.to } });
    await kernel.executeWithFallback(rule.to, rule.mapArgs ? rule.mapArgs({}) : {}, 1);
  }
};

const runIntent = async (text) => {
  const input = q('cmd-input');
  input.disabled = true;
  try { await kernel.handleIntent(text); }
  finally { input.disabled = false; input.focus(); }
};

q('cmd').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = q('cmd-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await runIntent(text);
});

document.querySelectorAll('.chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    const text = btn.dataset.cmd;
    q('cmd-input').value = '';
    runIntent(text);
  });
});

q('howto').addEventListener('click', () => {
  const open = q('hint').classList.toggle('open');
  q('howto').setAttribute('aria-expanded', String(open));
});

setInterval(() => { q('clock').textContent = new Date().toTimeString().slice(0, 8); }, 1000);
pushBus('kernel', 'boot', 'Kernel + FileAgent + BrowserAgent live', 'kernel');
renderDisk();
