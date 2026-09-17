/* Everything the product teaches, as data, in one place.

   Two pages read this: the console (site/index.html) renders the primaries
   and lights the map from live events; the explainer (site/explain.html)
   renders all of it and runs nothing. There used to be three catalogues of
   the same handful of verbs — SAMPLES, a hardcoded RAIL of string literals,
   and WALKTHROUGH — which could and did drift apart. */

export const GROUPS = [
  { id: 'disk', label: 'Virtual disk', note: 'Granted up front. Runs immediately.' },
  { id: 'browser', label: 'Browser', note: 'High risk. Stops for your approval, then you watch it happen.' },
  { id: 'failure', label: 'Refusals', note: 'Nothing fails silently.' },
];

/* `primary` is the phone rail: the shortest path to understanding the thing.
   One array, so the rail can never drift from the catalogue. */
export const SAMPLES = [
  { group: 'disk', intent: 'list files', primary: true,
    does: 'Enumerates the virtual disk.' },
  { group: 'disk', intent: 'write a file', primary: true,
    does: 'No path given, so it writes /notes.txt with default content.' },
  { group: 'disk', intent: 'write /todo.md "ship the mobile view"',
    does: 'A path and a quoted string become the args.' },
  { group: 'disk', intent: 'read /readme.md',
    does: 'Reads the seeded file.' },

  { group: 'browser', intent: 'navigate to example.com', primary: true,
    does: 'APPROVE and the page loads in the frame. DENY and it does not.' },
  { group: 'browser', intent: 'go to https://wikipedia.org',
    does: 'The URL is parsed out of your sentence. Many sites refuse to be framed — that refusal is real, and you see it.' },
  { group: 'browser', intent: 'navigate to ftp://example.com/x',
    does: 'The agent vets the scheme before the broker is even asked.' },

  { group: 'failure', intent: 'read /does-not-exist.md',
    does: 'ENOENT arrives as a tool_result, not an exception.' },
  { group: 'failure', intent: 'tell me a joke',
    does: 'The planner declines instead of inventing a tool.' },
];

export const PRIMARIES = SAMPLES.filter((s) => s.primary);

/* What the planner actually matches. The single biggest source of
   "why did nothing happen" — so it is written down, not left in the source. */
export const GRAMMAR = [
  { match: 'list · ls · dir · what files', cap: 'filesystem.list', args: '—' },
  { match: 'read · open · show · cat · print', cap: 'filesystem.read', args: 'first /path in the text' },
  { match: 'write · save · create · touch', cap: 'filesystem.write', args: '/path + "quoted content"' },
  { match: 'navigate · go to · visit · browse', cap: 'browser.navigate', args: 'any URL, or a bare domain' },
];

export const WALKTHROUGH = [
  { n: 1, title: 'Write something', intent: 'write /hello.md "first contact"',
    watch: 'The virtual disk gains /hello.md, and keeps it — the disk is in IndexedDB, so it survives a reload.' },
  { n: 2, title: 'Read it back', intent: 'read /hello.md',
    watch: 'Same broker, different capability. Low risk, so no interruption.' },
  { n: 3, title: 'Try a risky one', intent: 'navigate to example.com',
    watch: 'Execution stops before anything loads. A red approval bar appears — this is HITL.' },
  { n: 4, title: 'Deny it', intent: null,
    watch: 'Press DENY. Nothing loads, nothing is written in its place, and the run ends there. A denial that still does something is not a denial.' },
  { n: 5, title: 'Approve the next one', intent: 'navigate to example.com',
    watch: 'Press APPROVE. The page appears in a sandboxed frame with no cookies and no storage. The approval is spent on use — run it again and it asks again.' },
];

/* The layer stack. The console lights these from real bus events; the
   explainer shows them all at rest. */
export const MAP = [
  { id: 'intent', layer: 'intent', title: 'Intent surface', sub: 'command bar · sample chips',
    role: 'Typed records, so they can be replayed, diffed and audited.', events: ['intent'] },
  { id: 'worker', layer: 'kernel', title: 'Planner worker', sub: 'off the main thread',
    role: 'A deterministic grammar, not a model. It matches four verbs and declines everything else.', events: ['plan'] },
  { id: 'broker', layer: 'policy', title: 'Capability broker', sub: 'grants · risk · HITL',
    role: 'An autonomous agent without permissions is a security incident with a personality.', events: ['tool_call', 'error', 'denied'] },
  { id: 'agents', layer: 'agent', title: 'Agents', sub: 'FileAgent · BrowserAgent',
    role: 'Agents declare their capability set and cannot widen it later.', events: ['tool_result'] },
  { id: 'store', layer: 'store', title: 'Virtual disk', sub: 'IndexedDB, this origin only',
    role: 'Nothing leaves the page, but it now survives the reload. Reset is the only way out.', events: ['tool_result'] },
];

/* The honest limits, in one place, so the explainer cannot quietly stop
   mentioning them. */
export const LIMITS = [
  ['There is no model.', 'The planner is a regex cascade over four verbs. Nothing is inferred, downloaded or generated. An intent it does not match is declined, not guessed at.'],
  ['The disk is not a filesystem.', 'It is a Map persisted to IndexedDB, scoped to this origin. No directories, no permissions, no metadata.'],
  ['The frame is the only outward action.', 'browser.navigate commits a URL to a sandboxed iframe. That is the entire blast radius of this machine.'],
  ['One principal holds every grant.', 'The broker supports several principals with partial grants; this console uses one that holds all of them. Risk, not grants, is what stops you here.'],
];
