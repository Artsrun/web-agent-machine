/* Web Agent Machine — console UI.
   Owns the DOM only. All machine behaviour lives in kernel.js.

   Desktop and mobile are treated as two instruments, not one layout at
   two widths: `view` drives which controls exist and how running an
   intent behaves, on top of the CSS that decides what is on screen. */

import { Kernel, FileAgent, BrowserAgent, CAPABILITIES, LAYERS } from './kernel.js';
import { GROUPS, SAMPLES, GRAMMAR, WALKTHROUGH, MAP } from './samples.js';
import * as Disk from './disk.js';

const q = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/* ── the frame: the one place an agent action leaves a visible mark ──
   browser.navigate used to assign a string to a field, so APPROVE and DENY
   had identical consequences — none. It now commits a URL to a sandboxed
   frame, which is the whole point of asking you first. */
const frameSurface = {
  navigate: (url) => new Promise((resolve) => {
    const f = q('frame');
    q('frame-url').textContent = url;
    q('frame-wrap').hidden = false;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      f.onload = null;
      // We can observe that the frame took the URL. We cannot read a
      // cross-origin document to find out whether the site served it — so
      // that is not claimed anywhere. You are looking at the answer.
      resolve({ ok: true });
    };
    const timer = setTimeout(finish, 4000);
    f.onload = finish;
    f.src = url;
  }),
  clear: () => {
    q('frame').src = 'about:blank';
    q('frame-url').textContent = '';
    q('frame-wrap').hidden = true;
  },
};

/* ── machine ──────────────────────────────────────────────── */
const files = new FileAgent(
  { '/readme.md': '# Web Agent Machine\nA capability-secured agent kernel, in a tab.' },
  { onChange: (store) => Disk.save(store) },
);
const browser = new BrowserAgent(frameSurface);
const kernel = new Kernel();
kernel.registerAgent(files.handlers);
kernel.registerAgent(browser.handlers);
CAPABILITIES.forEach((c) => kernel.grant(c.id));

/* ── view mode ────────────────────────────────────────────── */
const desktop = matchMedia('(min-width: 900px)');
let view = 'mobile';
const applyView = () => {
  view = desktop.matches ? 'desktop' : 'mobile';
  document.body.dataset.view = view;
  // On desktop every pane is on screen, so "the active tab" is meaningless.
  if (view === 'desktop') clearUnread();
};
desktop.addEventListener('change', applyView);

/* ── mobile tabs ──────────────────────────────────────────── */
const tabbar = q('tabbar');
const tabButtons = [...tabbar.querySelectorAll('button')];
const setTab = (name) => {
  document.body.dataset.tab = name;
  tabButtons.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  if (name === 'bus') clearUnread();
};
const clearUnread = () => tabbar.querySelector('[data-tab="bus"]').dataset.unread = 'false';
const markUnread = () => {
  if (view === 'mobile' && document.body.dataset.tab !== 'bus') {
    tabbar.querySelector('[data-tab="bus"]').dataset.unread = 'true';
  }
};
tabbar.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn) setTab(btn.dataset.tab);
});

/* ── static renders ───────────────────────────────────────── */
const fillSamples = () => {
  const host = q('samples');
  host.replaceChildren();
  for (const g of GROUPS) {
    const rows = SAMPLES.filter((s) => s.group === g.id);
    if (!rows.length) continue;
    const wrap = el('div', 'group');
    const hd = el('div', 'group-hd');
    hd.append(el('b', null, g.label), el('i', null, g.note));
    const list = el('div', 'samples');
    for (const s of rows) {
      const b = el('button', 'sample');
      b.type = 'button';
      b.dataset.cmd = s.intent;
      b.append(el('span', 's-cmd', s.intent), el('span', 's-does', s.does));
      list.append(b);
    }
    wrap.append(hd, list);
    host.append(wrap);
  }
};

/* The phone gets one thumb-height row of the most useful intents,
   always within reach — not a grid that vanishes after the first run. */
const RAIL = ['list files', 'write a file', 'read /readme.md', 'navigate to example.com', 'read /does-not-exist.md'];
const fillRail = () => {
  const rail = q('rail');
  rail.replaceChildren();
  for (const intent of RAIL) {
    const b = el('button', 'chip', intent);
    b.type = 'button';
    b.dataset.cmd = intent;
    rail.append(b);
  }
};

const fillWalkthrough = () => {
  const host = q('walkthrough');
  host.replaceChildren();
  for (const s of WALKTHROUGH) {
    const li = el('li');
    const body = el('div');
    body.append(el('b', null, s.title), el('p', null, s.watch));
    if (s.intent) {
      const b = el('button', 'run-step', `run: ${s.intent}`);
      b.type = 'button';
      b.dataset.cmd = s.intent;
      body.append(b);
    }
    li.append(el('span', 'n', String(s.n)), body);
    host.append(li);
  }
};

const fillTable = (id, rows) => {
  const body = q(id).querySelector('tbody');
  body.replaceChildren();
  for (const cells of rows) {
    const tr = el('tr');
    cells.forEach((c) => tr.append(el('td', null, c)));
    body.append(tr);
  }
};

const fillCaps = () => {
  const host = q('caps');
  host.replaceChildren();
  for (const c of CAPABILITIES) {
    const row = el('div');
    // Two states, not three: every capability here is granted to the one
    // principal. Risk decides whether spending it needs you, not whether it exists.
    row.append(el('span', null, c.id), el('b', c.risk, c.risk === 'high' ? `${c.risk} · asks you` : `${c.risk} · runs`));
    row.title = c.blurb;
    host.append(row);
  }
};

const fillMap = () => {
  const host = q('map');
  host.replaceChildren();
  for (const n of MAP) {
    const node = el('div', 'node');
    node.id = `map-${n.id}`;
    node.dataset.live = 'false';
    node.style.setProperty('--c', LAYERS[n.layer].color);
    node.append(el('b', null, n.title), el('i', null, n.sub), el('p', null, n.role));
    host.append(node);
  }
};

const mapTimers = new Map();
const lightMap = (type) => {
  for (const n of MAP) {
    if (!n.events.includes(type)) continue;
    const node = q(`map-${n.id}`);
    if (!node) continue;
    node.dataset.live = 'true';
    clearTimeout(mapTimers.get(n.id));
    mapTimers.set(n.id, setTimeout(() => { node.dataset.live = 'false'; }, 1400));
  }
};

/* ── event bus log ────────────────────────────────────────── */
const busEl = q('bus');
const stamp = () => {
  const t = new Date();
  return `${t.toTimeString().slice(0, 8)}.${String(t.getMilliseconds()).padStart(3, '0')}`;
};
const pushBus = (src, ev, msg, layer = 'kernel') => {
  const li = el('li');
  li.style.setProperty('--c', LAYERS[layer]?.color || 'var(--l-kernel)');
  li.append(el('time', null, stamp()), el('b', null, src), el('em', null, ev), el('span', null, String(msg ?? '')));
  busEl.prepend(li);
  while (busEl.children.length > 60) busEl.lastElementChild.remove();
  markUnread();
};

/* ── pipeline strip ───────────────────────────────────────── */
const PIPE = [
  ['intent', 'intent', 'var(--l-intent)'],
  ['plan', 'plan', 'var(--l-kernel)'],
  ['broker', 'broker', 'var(--l-policy)'],
  ['agent', 'agent', 'var(--l-agent)'],
];
const resetPipeline = () => {
  const host = q('pipeline');
  host.replaceChildren();
  PIPE.forEach(([key, label, color], i) => {
    if (i) host.append(el('span', 'arrow', '→'));
    const s = el('span', 'stage', label);
    s.id = `st-${key}`;
    s.dataset.on = 'false';
    s.style.setProperty('--c', color);
    host.append(s);
  });
};
const setStage = (key, label, state = 'true') => {
  const s = q(`st-${key}`);
  if (!s) return;
  s.dataset.on = state;
  if (label) s.textContent = label;
};

/* ── result panel ─────────────────────────────────────────── */
const showResult = (label, body, meta = '', tone = 'ok') => {
  q('welcome').classList.add('hide');
  q('out').classList.add('show');
  q('out-badge').dataset.tone = tone;
  q('out-label').textContent = label;
  q('out-meta').textContent = meta;
  q('out-body').textContent = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
};

const renderDisk = () => {
  const ul = q('files');
  ul.replaceChildren();
  q('disk-count').textContent = `(${files.store.size})`;
  if (!files.store.size) {
    ul.append(el('li', 'none', 'empty'));
    return;
  }
  for (const [path, content] of files.store) {
    const li = el('li');
    const b = el('button');
    b.type = 'button';
    b.append(el('span', null, path), el('em', null, `${String(content).length}b`));
    b.onclick = () => {
      showResult('filesystem.read', String(content), `${path} · read from the disk panel, no kernel round-trip`);
      if (view === 'mobile') setTab('run');
    };
    li.append(b);
    ul.append(li);
  }
};

/* ── kernel → UI ──────────────────────────────────────────── */
kernel.bus.on('*', (e) => {
  lightMap(e.type);
  switch (e.type) {
    case 'intent':
      pushBus('kernel', 'intent', e.payload.text.slice(0, 64), 'intent');
      setStage('intent', 'intent');
      break;
    case 'plan': {
      const desc = e.payload.steps.map((s) => s.description).join(' → ');
      pushBus('worker', 'plan', desc, 'kernel');
      setStage('plan', e.payload.steps.length > 1 ? `plan ×${e.payload.steps.length}` : 'plan');
      q('out-meta').textContent = desc;
      break;
    }
    case 'noop':
      pushBus('kernel', 'noop', 'no capability matched', 'kernel');
      setStage('broker', 'skipped', 'false');
      showResult('no tool matched', `The planner found no capability for:\n\n  "${e.payload.text}"\n\nIt declines rather than inventing one. See "What the planner matches" in the guide.`, 'nothing executed', 'wait');
      showTip({ noop: true });
      break;
    case 'tool_call':
      pushBus('kernel', 'tool_call', e.payload.capability, 'kernel');
      setStage('agent', e.payload.capability.split('.')[0]);
      break;
    case 'tool_result':
      pushBus('broker', e.payload.ok ? 'grant' : 'deny',
        e.payload.ok ? JSON.stringify(e.payload.result).slice(0, 56) : e.payload.error, 'policy');
      if (e.payload.ok) {
        setStage('broker', 'granted');
        showResult(e.payload.capability, e.payload.result, `${e.payload.capability} · ok`);
        renderDisk();
      } else {
        setStage('broker', 'denied', 'fail');
      }
      showTip({ cap: e.payload.capability, ok: e.payload.ok, path: e.payload.args?.path, intent: lastIntent });
      break;
    case 'error':
      if (e.payload.code === 'HITL_REQUIRED') {
        pushBus('broker', 'HITL', e.payload.message, 'policy');
        setStage('broker', 'awaiting you', 'fail');
        openHITL(e.payload.capability, e.payload.args);
        showResult('waiting for you', `${e.payload.capability} is marked high risk, so the broker stopped here.\n\nApprove or deny below. Nothing runs until you decide.`, 'execution paused', 'wait');
        showTip({ hitl: true });
      } else {
        pushBus('broker', 'error', e.payload.message || e.payload.code, 'policy');
        setStage('broker', 'failed', 'fail');
        // TOOL_FAILED always trails a failed tool_result, which already set the
        // tip from the call's own args. Re-tipping here would lose the path.
        showResult('error', e.payload.message || e.payload.code, e.payload.capability || '', 'fail');
      }
      break;
    case 'denied':
      frameSurface.clear();
      pushBus('you', 'denied', e.payload.capability, 'policy');
      setStage('broker', 'you denied', 'fail');
      setStage('agent', 'not reached', 'false');
      showResult('denied', `You refused ${e.payload.capability}.\n\nNothing ran, and nothing was written in its place. The refusal is on the bus.`, 'execution stopped', 'fail');
      showTip({ denied: true });
      break;
  }
});

/* What to try next, chosen from what just happened. The single most
   useful hint is the one that arrives after you already did something. */
const TIPS = [
  { when: (r) => r.hitl, text: 'Deny it instead — the run stops there, and the refusal is recorded.', run: null },
  { when: (r) => r.denied, text: 'Approve one to see the other half. The grant is spent on use:', run: () => 'navigate to example.com' },
  { when: (r) => r.cap === 'filesystem.write', text: 'Read it back:', run: (r) => `read ${r.path}` },
  { when: (r) => r.cap === 'filesystem.list', text: 'Now try one the broker will stop:', run: () => 'navigate to example.com' },
  { when: (r) => r.cap === 'filesystem.read' && r.ok, text: 'Overwrite it:', run: (r) => `write ${r.path} "second draft"` },
  { when: (r) => r.cap === 'filesystem.read' && !r.ok, text: 'It does not exist yet — create it:', run: (r) => `write ${r.path} "now it does"` },
  { when: (r) => r.cap?.startsWith('browser.') && r.ok, text: 'The approval was spent on use. Run it again and it asks again:', run: (r) => r.intent },
  { when: (r) => r.noop, text: 'The planner only matches a few verbs. Try:', run: () => 'list files' },
];
const showTip = (ctx) => {
  const hit = TIPS.find((t) => t.when(ctx));
  const tip = q('tip');
  tip.replaceChildren();
  if (!hit) { tip.hidden = true; return; }
  tip.hidden = false;
  tip.append(document.createTextNode(hit.text));
  const cmd = hit.run?.(ctx);
  if (cmd) {
    const b = el('button', null, cmd);
    b.type = 'button';
    b.dataset.cmd = cmd;
    tip.append(b);
  }
};

/* ── HITL ─────────────────────────────────────────────────── */
let pending = null;
const hitl = q('hitl');
const openHITL = (cap, args) => {
  pending = { cap, args: args || {} };
  q('hitl-cap').textContent = `${cap} ${JSON.stringify(args || {})}`;
  q('hitl-why').textContent = 'High-risk capabilities are never granted standing. Approving spends a single use — the next call asks again.';
  hitl.classList.add('open');
  if (view === 'mobile') {
    setTab('run');
    hitl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  q('hitl-approve').focus();
};
const closeHITL = () => { hitl.classList.remove('open'); const p = pending; pending = null; return p; };

q('hitl-approve').onclick = async () => {
  const p = closeHITL();
  if (!p) return;
  kernel.approve(p.cap);
  pushBus('you', 'approve', p.cap, 'policy');
  await kernel.execute(p.cap, p.args);
};
q('hitl-deny').onclick = async () => {
  const p = closeHITL();
  if (!p) return;
  await kernel.deny(p.cap, p.args);
};

/* ── running ──────────────────────────────────────────────── */
const history = [];
let histIndex = -1;
let lastIntent = null;
let running = false;

const setBusy = (on) => {
  running = on;
  q('cmd-input').disabled = on;
  q('cmd-send').disabled = on;
  q('cmd-send').textContent = on ? '···' : 'SEND';
  document.querySelectorAll('.chip, .sample, .run-step').forEach((b) => { b.disabled = on; });
};

const runIntent = async (text) => {
  if (running || !text) return;
  lastIntent = text;
  if (history[0] !== text) history.unshift(text);
  histIndex = -1;
  // On a phone the result is on another tab — go there, or the run looks like nothing happened.
  if (view === 'mobile') setTab('run');
  resetPipeline();
  setBusy(true);
  try { await kernel.handleIntent(text); }
  catch (err) { showResult('crash', String(err), 'the console caught this so the kernel could not wedge', 'fail'); }
  finally {
    setBusy(false);
    if (view === 'desktop') q('cmd-input').focus();
  }
};

q('cmd').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = q('cmd-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await runIntent(text);
});

// One delegated handler for every "run this intent" affordance on the page.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-cmd]');
  if (btn && !btn.disabled) runIntent(btn.dataset.cmd);
});

/* ── controls ─────────────────────────────────────────────── */
q('btn-copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText(q('out-body').textContent);
    q('btn-copy').textContent = 'copied';
    setTimeout(() => { q('btn-copy').textContent = 'copy'; }, 1200);
  } catch { q('btn-copy').textContent = 'blocked'; }
};
q('btn-again').onclick = () => lastIntent && runIntent(lastIntent);
q('btn-clear-bus').onclick = () => busEl.replaceChildren();
q('btn-frame-close').onclick = () => frameSurface.clear();
q('btn-reset').onclick = async () => {
  // reset() persists the seed through onChange, so clearing separately would
  // race it — whichever transaction landed last would win.
  await files.reset();
  browser.reset();
  busEl.replaceChildren();
  q('out').classList.remove('show');
  q('welcome').classList.remove('hide');
  q('tip').hidden = true;
  closeHITL();
  resetPipeline();
  renderDisk();
  pushBus('kernel', 'reset', 'disk and bus cleared', 'kernel');
};
q('btn-guide').onclick = () => q('samples').scrollIntoView({ block: 'start', behavior: 'smooth' });

/* Desktop-only keyboard surface. A phone has no ⌘K and no room to advertise one. */
addEventListener('keydown', (e) => {
  if (view !== 'desktop') return;
  const input = q('cmd-input');
  const typing = document.activeElement === input;

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); return; }
  if (pending && !typing) {
    if (e.key.toLowerCase() === 'y') { e.preventDefault(); q('hitl-approve').click(); return; }
    if (e.key.toLowerCase() === 'n') { e.preventDefault(); q('hitl-deny').click(); return; }
  }
  if (!typing) return;
  if (e.key === 'Escape') { input.value = ''; histIndex = -1; return; }
  if (e.key === 'ArrowUp' && history.length) {
    e.preventDefault();
    histIndex = Math.min(histIndex + 1, history.length - 1);
    input.value = history[histIndex];
  }
  if (e.key === 'ArrowDown' && histIndex >= 0) {
    e.preventDefault();
    histIndex -= 1;
    input.value = histIndex < 0 ? '' : history[histIndex];
  }
});

/* ── boot ─────────────────────────────────────────────────── */
// Top-level await: the disk must be whole before anything renders it, or a
// reload flashes the seed and then corrects itself.
const saved = await Disk.load();
if (saved?.length) files.load(saved);

applyView();
fillSamples();
fillRail();
fillWalkthrough();
fillTable('grammar', GRAMMAR.map((g) => [g.match, g.cap, g.args]));
fillCaps();
fillMap();
resetPipeline();
renderDisk();
pushBus('kernel', 'boot', saved?.length ? `Kernel live · disk restored (${saved.length})` : 'Kernel + FileAgent + BrowserAgent live', 'kernel');
clearUnread();
