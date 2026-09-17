# Web Agent Machine

**A capability-secured agent kernel that runs inside a browser tab.**

```text
Agent Kernel + EventBus + Web Worker planner + Capability Broker + HITL approval
```

Not a chatbot, and not an LLM. The planner is a small deterministic grammar, not
a model — the point of the thing is the *broker*: what an agent is allowed to do,
who decides, and what a refusal actually means.

## Live demo

**https://artsrun.github.io/web-agent-machine/**

Type an intent. A worker plans the tool calls, a broker checks permission, and an
agent executes — all inside the tab. Nothing leaves the page; the virtual disk is
in memory and dies with the reload.

Start with `list files`, then `write /todo.md "ship it"`, then
`navigate to example.com` — the last one stops and asks you, which is the point.
Approving spends a single use: run it again and it asks again. Denying is
terminal — nothing is retried and nothing is written in its place.

## Status

- Kernel + EventBus + CapabilityBroker + WorkerBridge
- FileAgent (real, in-memory) + BrowserAgent (**does not yet touch a browser** —
  `navigate` records a URL, `click` records a selector; see the audit below)
- HITL approval, one-shot and spent on use
- Live console with separate desktop and mobile control surfaces
- Machine map that lights up from real bus events
- Notes + Playwright UI tests across both viewports

What is claimed versus what is implemented is inventoried in
[docs/product-refactor.md](docs/product-refactor.md), along with the plan to
close the gap.

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
