/* Everything the console teaches, as data.
   Desktop and mobile render these differently — they never diverge in content. */

export const GROUPS = [
  { id: 'disk', label: 'Virtual disk', note: 'Granted up front. Runs immediately.' },
  { id: 'browser', label: 'Browser', note: 'High risk. Stops for your approval.' },
  { id: 'failure', label: 'Failure paths', note: 'Nothing fails silently. Watch the bus.' },
];

export const SAMPLES = [
  { group: 'disk', label: 'list files', intent: 'list files',
    does: 'Enumerates the virtual disk.', cap: 'filesystem.list' },
  { group: 'disk', label: 'write a file', intent: 'write a file',
    does: 'Writes /notes.txt with default content.', cap: 'filesystem.write' },
  { group: 'disk', label: 'write /todo.md', intent: 'write /todo.md "ship the mobile view"',
    does: 'A path and a quoted string become the args.', cap: 'filesystem.write' },
  { group: 'disk', label: 'read /readme.md', intent: 'read /readme.md',
    does: 'Reads the seeded file.', cap: 'filesystem.read' },

  { group: 'browser', label: 'navigate', intent: 'navigate to example.com',
    does: 'Asks the broker for browser.navigate — you must APPROVE.', cap: 'browser.navigate' },
  { group: 'browser', label: 'navigate elsewhere', intent: 'go to https://developer.mozilla.org',
    does: 'The URL is parsed out of your sentence, not hardcoded.', cap: 'browser.navigate' },
  { group: 'browser', label: 'click a selector', intent: 'click #submit',
    does: 'Also high risk, also gated.', cap: 'browser.click' },

  { group: 'failure', label: 'missing file', intent: 'read /does-not-exist.md',
    does: 'ENOENT surfaces as a tool_result, not an exception.', cap: 'filesystem.read' },
  { group: 'failure', label: 'deny a navigate', intent: 'navigate to example.com',
    does: 'Press DENY — nothing runs, and the refusal is on the bus.', cap: 'browser.navigate' },
  { group: 'failure', label: 'no tool matches', intent: 'tell me a joke',
    does: 'The planner declines instead of inventing a tool.', cap: null },
];

/* What the planner actually matches. The single biggest source of
   "why did nothing happen" — so it is on the page, not in the source. */
export const GRAMMAR = [
  { match: 'list · ls · dir · what files', cap: 'filesystem.list', args: '—' },
  { match: 'read · open · show · cat · print', cap: 'filesystem.read', args: 'first /path in the text' },
  { match: 'write · save · create · touch', cap: 'filesystem.write', args: '/path + "quoted content"' },
  { match: 'navigate · go to · visit · browse', cap: 'browser.navigate', args: 'any URL or bare domain' },
  { match: 'click', cap: 'browser.click', args: '#id or .class' },
];

export const WALKTHROUGH = [
  { n: 1, title: 'Write something', intent: 'write /hello.md "first contact"',
    watch: 'The virtual disk gains /hello.md. The bus shows intent → plan → tool_call → grant.' },
  { n: 2, title: 'Read it back', intent: 'read /hello.md',
    watch: 'Same broker, different capability. Low risk, so no interruption.' },
  { n: 3, title: 'Try a risky one', intent: 'navigate to example.com',
    watch: 'Execution stops. A red approval bar appears — this is HITL.' },
  { n: 4, title: 'Deny it', intent: null,
    watch: 'Press DENY. Execution stops there — no retry, no consolation write. A denial that still does something is not a denial.' },
  { n: 5, title: 'Approve the next one', intent: 'navigate to example.com',
    watch: 'Press APPROVE. The grant is spent on use — run it again and it asks again.' },
];

/* The layer stack, live-highlighted as events fire.
   Merged from the machine map on origin/main, which was static and simulated. */
export const MAP = [
  { id: 'intent', layer: 'intent', title: 'Intent surface', sub: 'command bar · sample chips',
    role: 'Typed records, so they can be replayed, diffed and audited.', events: ['intent'] },
  { id: 'worker', layer: 'kernel', title: 'Planner worker', sub: 'off the main thread',
    role: 'The plan is built in a Web Worker; the main thread stays free for input.', events: ['plan'] },
  { id: 'broker', layer: 'policy', title: 'Capability broker', sub: 'grants · risk · HITL',
    role: 'An autonomous agent without permissions is a security incident with a personality.', events: ['tool_call', 'error', 'denied'] },
  { id: 'agents', layer: 'agent', title: 'Agent mesh', sub: 'FileAgent · BrowserAgent',
    role: 'Agents declare their capability set and cannot widen it later.', events: ['tool_result'] },
  { id: 'store', layer: 'store', title: 'Virtual disk', sub: 'in-memory, this tab only',
    role: 'Nothing leaves the page. Reload and it is gone.', events: ['tool_result'] },
];
