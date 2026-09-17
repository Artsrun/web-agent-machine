/* The explainer renders the same content the console does, and runs nothing.
   Every sample is a deep link into the console, so reading never becomes
   operating by accident — the split this page exists to make. */

import { GROUPS, SAMPLES, GRAMMAR, WALKTHROUGH, MAP, LIMITS } from './content.js';

const q = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const runHref = (intent) => `./index.html#run=${encodeURIComponent(intent)}`;

const LAYER_COLOR = {
  intent: 'var(--layer-intent)', kernel: 'var(--layer-kernel)', policy: 'var(--layer-broker)',
  agent: 'var(--layer-agent)', store: 'var(--layer-store)',
};

const map = q('map');
for (const n of MAP) {
  const item = el('div', 'item');
  item.style.setProperty('--c', LAYER_COLOR[n.layer]);
  item.append(el('b', null, n.title), el('i', null, n.sub), el('p', null, n.role));
  map.append(item);
}

const grammar = q('grammar').querySelector('tbody');
for (const g of GRAMMAR) {
  const tr = el('tr');
  [g.match, g.cap, g.args].forEach((c) => tr.append(el('td', null, c)));
  grammar.append(tr);
}

const steps = q('walkthrough');
for (const s of WALKTHROUGH) {
  const li = el('li');
  const body = el('div');
  body.append(el('b', null, s.title), el('p', null, s.watch));
  if (s.intent) {
    const a = el('a', null, `run: ${s.intent}`);
    a.href = runHref(s.intent);
    body.append(a);
  }
  li.append(el('span', 'n', String(s.n)), body);
  steps.append(li);
}

const samples = q('samples');
for (const g of GROUPS) {
  const rows = SAMPLES.filter((s) => s.group === g.id);
  if (!rows.length) continue;
  const hd = el('div', 'group-hd');
  hd.append(el('b', null, g.label), el('i', null, g.note));
  const list = el('div', 'runs');
  for (const s of rows) {
    const a = el('a', 'run-link');
    a.href = runHref(s.intent);
    a.append(el('b', null, s.intent), el('span', null, s.does));
    list.append(a);
  }
  samples.append(hd, list);
}

const limits = q('limits');
for (const [term, body] of LIMITS) {
  limits.append(el('dt', null, term), el('dd', null, body));
}
