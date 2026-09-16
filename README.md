# Web Agent Machine

**AI-native machine substrate inside the browser.**

```text
Agent Kernel + WASM + Workers + WebGPU + HTML/Canvas + Capability Security
+ local 6B / 8B / 9B model routing
```

Not a chatbot. Not a traditional OS.
A capability-secured agent runtime that treats the browser as hardware abstraction.

## Live demo

**https://artsrun.github.io/web-agent-machine/**

Type an intent. A router picks a model tier, a worker plans the tool calls, a
broker checks permission, and an agent executes — all inside the tab. Nothing
leaves the page; the virtual disk is in memory and dies with the reload.

Start with `list files`, then `write /todo.md "ship it"`, then
`navigate to example.com` — the last one stops and asks you, which is the point.
The console ships its own guide: a sample catalogue, the verbs the planner
actually matches, the model-tier rules, and a five-minute walkthrough.

## Status

Architecture **v0.2** · Console **rev 0.3** · Implementation **Phase 2–4**

- Kernel + EventBus + ModelRouter + CapabilityBroker + WorkerBridge
- FileAgent + BrowserAgent (with HITL + automated fallbacks)
- Live console with separate desktop and mobile control surfaces
- Machine map that lights up from real bus events
- Notes + Playwright UI tests across both viewports

## Layout

```text
site/
  index.html     console shell — mobile-first, desktop grid over the top
  console.js     UI only: panes, tabs, keyboard, HITL, pipeline strip
  kernel.js      the machine — no DOM, importable on its own
  samples.js     samples, intent grammar, tiers, walkthrough, machine map
  blog.html      notes index
  notes/*.html   the notes
tests/           Playwright, one project per viewport
docs/            branch review, roadmap notes
```

## Quick start

```bash
npm install
npm run serve     # http://localhost:4173
```

## Tests

```bash
npm install
npx playwright install chromium
npm test                  # serves site/ and tests the working tree
npm test -- --project=mobile
npm run test:deployed     # smoke-test the live Pages build instead
```

`npm test` boots `scripts/serve.mjs` and runs against it, so a pull request is
tested against its own changes. Set `BASE_URL` to point the suite at a deployment.

## Branches

`prod` is the trunk. See [docs/branch-review.md](docs/branch-review.md) for the
state of every other branch and what is safe to delete.

## License

MIT
