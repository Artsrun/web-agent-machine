# Web Agent Machine — product audit & refactor plan

Date: 2026-09-17 · Against: `prod` @ `3a73e23` · Scope: `site/`, `README.md`, `docs/`

Two parts. **Part I** is an inventory of what the product claims versus what it
does. **Part II** is the plan. Part I is the reason Part II is shaped the way it
is, so it comes first.

---

# Part I — What is fabricated

Verified by reading every file in `site/` and grepping the tree. Each entry names
the claim, the code, and the delta.

## 1. There is no model. There is no AI.

**Claim** — `README.md` line 1: *"AI-native machine substrate"*, and
*"local 6B / 8B / 9B model routing"*. The console header: *"a router picks a
model tier"*. A `--tier` badge renders on every sample.

**Code** — `kernel.js:ModelRouter` is two regexes over the raw intent string:

```js
route(text) {
  if (TIER_9B.test(text)) return '9b';   // /architect|orchestrate|multi-agent/
  if (TIER_8B.test(text)) return '8b';   // /refactor|plan|analyze|debug/
  return '6b';
}
```

**Delta** — no model is loaded, fetched, quantised, or invoked. No WebLLM, no
transformers.js, no ONNX, no worker inference. `grep -ri "onnx\|transformers\|
webllm"` over the tree: zero hits.

Worse, the tier is **write-only**. `kernel.js:210-223` computes `model`, emits it
on the bus, attaches it to the plan object, returns it — and nothing ever reads
it. `console.js:242` prints it. That is the entire lifecycle. Routing to `9b`
versus `6b` changes one string in a badge and zero bytes of behaviour.

This is the largest single gap between the pitch and the artifact, and it is the
first thing a technical reader checks.

## 2. WASM and WebGPU do not appear in the product

**Claim** — `README.md` banner:

```text
Agent Kernel + WASM + Workers + WebGPU + HTML/Canvas + Capability Security
```

**Code** — `grep -ril wasm site/` returns three files. In all three it is a CSS
custom property name:

- `index.html:19` — `--l-wasm: #A78BFA;` (a purple)
- `index.html:317`, `console.js:180` — that purple applied to the "agent" chip
- `kernel.js:9` — `agent: { color: 'var(--l-wasm)' }`

WebGPU and Canvas appear **only** in `site/notes/scanline-to-web.html` and
`site/notes/bkt-simulator.html` — blog posts, not the machine. `--l-gfx` is
declared and never used anywhere.

**Delta** — four of the six subsystems in the headline banner are colour names.
Workers and Capability Security are real (see §8); the rest is a palette.

## 3. The BrowserAgent does not touch a browser

**Code** — `kernel.js:BrowserAgent`:

```js
'browser.navigate': async (req) => { this.url = url; this.history.push({action:'navigate', url}); ... }
'browser.click':    async (req) => { this.history.push({action:'click', selector: sel}); ... }
```

**Delta** — `navigate` assigns a string to a field. `click` pushes an object into
an array. Nothing is fetched, rendered, embedded, or clicked. No iframe, no
`window.open`, no `fetch`.

This is the load-bearing fabrication, because the entire security narrative rests
on it. `browser.navigate` is marked `risk: 'high'`, it triggers the HITL bar, the
walkthrough builds to it ("*Try a risky one*"), and the README says *"the last one
stops and asks you, which is the point."*

**The approval gate guards a no-op.** The user is asked to make a security
decision about an operation that has no consequence in either direction. The
stake is zero, so the lesson does not land — which is very likely a large part of
why the product reads as pointless while you are using it.

## 4. "Fallback" is a log line wearing a recovery costume

**Code** — `kernel.js:196-201`:

```js
{ from: 'browser.navigate', to: 'filesystem.write',
  mapArgs: (a) => ({ path: '/nav-fallback.txt', content: `navigate blocked: ${a.url}` }) }
```

**Delta** — presented in `samples.js` as resilience: *"the kernel does not give
up: it falls back to writing /nav-fallback.txt"*. Writing a file that says "I was
denied" is not a fallback; it is a log entry. Nothing downstream consumes it,
nothing retries, no alternative route to the goal is attempted.

There is also a **policy smell** here worth naming: a *denied* `high`-risk
capability silently escalates into an *executed* `medium`-risk one, with no
second broker prompt. In a real broker, "deny X ⇒ automatically do Y" is the
shape of a sandbox escape, not of graceful degradation.

## 5. The grant system is ceremonial

**Code** — `console.js:24`:

```js
CAPABILITIES.forEach((c) => kernel.grant(c.id));
```

Every capability, granted to the single hardcoded principal `'desktop-agent'`, at
boot, unconditionally.

**Delta** — `CapabilityBroker` implements `grants`, per-principal lists, and a
`no grant` rejection path. In the shipped app that path is **unreachable**. There
is one principal and it holds everything. The only gate that ever fires is
`def.risk === 'high'`, which is a property on a hardcoded array of five objects.

"Capability-secured" currently means: *a five-row constant where two rows prompt*.

## 6. The Web Worker is not load-bearing

**Code** — `WorkerBridge` stringifies `plan()` into a Blob worker, and:

```js
const timer = setTimeout(() => { resolve(plan(text)); }, 2000);   // falls back inline
this.worker.onerror = () => { this.broken = true; };              // falls back inline
```

**Delta** — the offloaded work is ~15 regex tests on a string under 200 chars,
i.e. microseconds. It is offloaded to demonstrate that offloading exists, and it
degrades to the identical inline path with no observable difference. The
single-source trick (stringify one function so main thread and worker cannot
drift) is genuinely nice engineering — in service of nothing.

## 7. Chrome that signals liveness it does not have

- **The clock.** `setInterval` writing `HH:MM:SS` into the topbar every second.
  It is `new Date()`. It signals "telemetry, live system" and carries zero bits.
- **`LIVE` badge.** Hardcoded string, never changes. It exists as contrast
  against a `SIM` mode that does not exist in this build (it lived on `main`).
- **The pulse dot.** A CSS keyframe animation on the bus header.
- **`rev 0.3`, "Architecture v0.2", "Implementation Phase 2–4".** Version theatre.
  No reader can decode what Phase 1 was or what Phase 5 would be.
- **The machine map.** Honest in mechanism — it lights from real bus events, not
  `Math.random()` — but it draws "Planner worker / Capability broker / Agent mesh /
  Virtual disk" as a six-node distributed topology. The reality is three classes
  in one 12 KB file. The diagram implies an architecture the code does not have.

## 8. What is real, and good — the part worth building on

Stated plainly so the plan below does not read as demolition:

- **One-shot approval, spent on use** (`broker.request`: `approved.delete(cap)`
  after a grant is consumed). This is the single best idea in the repository. It
  is correct, it is unusual, and it is the thing the product should be *about*.
- **The event bus is real.** One `*` subscriber drives the entire UI; the DOM is
  a pure function of emitted events. Clean unidirectional flow, no hidden paths.
- **Kernel / DOM separation is real.** `kernel.js` imports nothing, touches no
  DOM, and is importable by a test. This is honest architecture.
- **The `noop` path.** When no verb matches, the planner declines instead of
  inventing a tool call. Most demos fake a result here. This one does not.
- **Errors are values.** `ENOENT` arrives as a `tool_result` with `ok: false`,
  not an exception.
- **Tests exist and are real** — 31 Playwright tests across two viewport projects,
  run against the working tree, not only against the deployment.

## 9. Verdict

The repository is a **well-built explanation of an idea, marketed as a machine.**

The engineering underneath is clean. The claims stacked on top of it — AI-native,
model routing, WASM, WebGPU, browser agent, fallback recovery, capability security
— are between 10% and 0% implemented, and the product's own UI spends most of its
pixels advertising the 0% half.

That is also the answer to *"I don't understand the usefulness"*:

1. **Nothing survives.** The disk is a `Map` that dies on reload. The bus caps at
   60 rows and dies on reload. No session produces anything that outlives it.
2. **The five verbs solve no task.** Writing `/todo.md` into a `Map` and reading
   it back is not a job anyone has.
3. **The one interesting moment has no stake** (§3).
4. **It teaches a toy grammar.** The largest information surface on screen is a
   tutorial for a five-verb regex dialect that transfers nowhere. The fact that a
   grammar table is *necessary* is the diagnosis: the input is undiscoverable, and
   the response was documentation rather than design.

---

# Part II — The refactor plan

## The decision that has to come first

The product is currently four products sharing one stylesheet:

| # | Product | Surface | Needs the others? |
|---|---|---|---|
| 1 | Demo of a capability broker | HITL bar, caps, disk | — |
| 2 | Tutorial for its own regex grammar | grammar table, tiers table, walkthrough, samples ×3 | only exists because #1's input is undiscoverable |
| 3 | Systems dashboard | bus, machine map, pipeline strip ×2, clock | no |
| 4 | A blog | `blog.html` + 7 notes on kaomoji, scan-line rendering, BKT, context rot | no |

Nothing here is a bad idea. The failure is that all four render **simultaneously,
at equal visual weight**, on a phone.

Three honest positionings:

- **(A) Explainer.** Accept that it teaches. Kill the dashboard, keep one
  narrative, delete the tier fiction. Cheap. Ceiling is low.
- **(B) Real substrate.** Make the claims true — real model, real navigation,
  real persistence. Expensive. The claims become assets instead of liabilities.
- **(C) Library + minimal demo.** The kernel is the product (typed, published,
  tested); the site is one screen that proves it.

**Recommendation: B-lite, then C.** Do not chase all of B. Make exactly **one**
claim true — the browser agent — because that single change converts the whole
thing from theatre into demonstration, and it costs roughly eighty lines. Then
strip everything not in service of it, and let the kernel become the durable
artifact.

The order below is deliberate: **truth before polish.** Refining a UI around
claims you are going to delete is wasted work.

---

## Phase 0 — Truth pass (no new features, delete only)

Goal: after this phase, every sentence in the product is true. Nothing is built.

**0.1 — Retire the model-router fiction.**
Delete `ModelRouter`, the `route` bus event, the `route` pipeline stage, the
`tier` field on every sample, the `TIERS` table, and the "Model tiers" card.
Delete the 6B/8B/9B line from `README.md`.

Counter-option if the idea is worth keeping: rename it to what it is — an
**intent classifier** (`simple | reasoning | architectural`) — and *give it a
consumer*, e.g. the classification selects the planner strategy. A classification
nothing reads is not a feature. Ship it with a consumer or delete it; do not ship
a third badge.

**0.2 — Fix the README banner.** `WASM + WebGPU + HTML/Canvas` describe nothing
in `site/`. Replace with what is actually there:

```text
Agent Kernel + Web Workers + Capability Broker + HITL approval
```

Drop "AI-native" until §1 or Phase 1 makes it true. Delete the unused `--l-gfx`
token; rename `--l-wasm` → `--l-agent`.

**0.3 — Rename "fallback" to "compensation", or delete it.**
It logs a denial; call it logging. Preferred: delete the auto-escalation entirely
(§4) and emit a terminal `denied` event. If kept, the compensating write must
route through the broker as a *fresh* request so it is visible as a second
decision, not a silent one.

**0.4 — Cut the liveness theatre.** Remove the clock, the `LIVE` badge, the
pulse animation, and `rev 0.3` from the chrome. Version strings belong in the
footer or the README, not the topbar of a single-screen app.

**0.5 — Make the grant system load-bearing or admit it is not.**
Cheapest honest move: seed only `filesystem.*` at boot and let `browser.*` be
genuinely ungranted, so the `no grant` path executes and the caps panel shows a
real difference between *granted*, *ungranted*, and *asks you*. Today all five
rows are the same state wearing three colours.

*Exit criteria:* `grep -i "6b\|8b\|9b\|wasm\|webgpu\|AI-native"` over `site/` and
`README.md` returns nothing. Test suite green with the tier assertions removed.

---

## Phase 1 — Give the approval gate a real stake (the one feature)

Goal: when the user presses **APPROVE**, something visibly happens. When they
press **DENY**, that same something visibly does not.

**1.1 — Real `browser.navigate`, sandboxed.** Replace the string assignment with
an actual `<iframe sandbox="allow-scripts" referrerpolicy="no-referrer">` mounted
in the run pane. Approve → the page loads in front of you. Deny → the frame stays
blank and the reason is on screen.

This is the whole pitch, finally demonstrated: *an agent asked to do a real thing;
a broker stopped it; you decided; the consequence was visible.* Roughly 80 lines,
and it retires §3 entirely.

Handle the honest failure mode: most sites set `X-Frame-Options`/`frame-ancestors`
and will refuse. Ship a short allowlist of frame-friendly targets in the samples,
and surface a refusal as a **real `tool_result` error** — an agent discovering the
world says no is a better lesson than a fake success.

**1.2 — `browser.click` becomes honest.** Cross-origin frames cannot be scripted,
so drop `browser.click` from the capability set rather than shipping a second
no-op. One real capability beats two fake ones.

**1.3 — Persist the disk to OPFS or IndexedDB.** One small module behind the
existing `FileAgent` interface. The moment work survives a reload, the disk stops
being a toy and the "virtual machine" framing starts paying rent. Keep `reset` as
an explicit, loud action.

*Exit criteria:* a Playwright test that approves a navigate, asserts the frame
committed, denies the next one, and asserts it did not.

---

## Phase 2 — Separate the concepts

One surface, one job. Today every surface does every job.

**2.1 — Split the site into three artifacts with three different chromes:**

| Artifact | Job | Contents |
|---|---|---|
| `index.html` | **Operate** | command bar, result, approval bar. Nothing else. |
| `explain.html` | **Understand** | machine map, the grammar, the walkthrough, the architecture argument. Static. Linkable. Readable on a phone in portrait. |
| `blog.html` + `notes/` | **Read** | unchanged, but stop sharing the console's stylesheet and token set — it is a separate publication and should look like one. |

The console links to the explainer. The explainer links back with live examples.
Neither is embedded in the other.

**2.2 — Collapse the three sample catalogues into one.**
Today: `SAMPLES` (12, in the playbook), `RAIL` (6, **hardcoded string literals in
`console.js:105`** that duplicate `SAMPLES` intents with no link between them, so
they can and will drift), and `WALKTHROUGH` (5, with their own run buttons).

One array, one `primary: true` flag. The rail renders the primaries; the explainer
renders all. `RAIL` as a literal array is a bug waiting to happen.

**2.3 — Delete the duplicate pipeline strip.** It renders twice with identical
labels — static in the playbook (`index.html:313-319`), live in the run pane. Keep
the live one. A diagram of the pipeline belongs in `explain.html`.

**2.4 — One meaning per colour.** Currently `--l-policy` (red) means *broker
layer* **and** *high risk* **and** *failure*; `--l-store` (green) means *storage
layer* **and** *low risk* **and** *success*. Three semantics per hue. Split into
two disjoint scales: **layer identity** (map/bus only, desaturated) and **state**
(risk/result only, saturated). Nothing may use both.

---

## Phase 3 — Mobile as the primary instrument

The current mobile build is a desktop information architecture squeezed into tabs.
Specific defects, each with a fix:

**3.1 — The tabs fight the task.** Four tabs (Run/State/Bus/Guide) for a product
with one job. Tapping a sample in **Guide** force-switches you to **Run**
(`console.js:runIntent` → `setTab('run')`), so you cannot read the guide and run
from it — the act of trying yanks the page away. Fix: guide moves to
`explain.html` (2.1), leaving **Run** and a single **Inspect** (disk + bus,
segmented). Two tabs.

**3.2 — Three nested scroll containers in one column.**
`body{overflow:hidden}` + `100dvh` grid ⇒ `.pane{overflow:auto}` ⇒
`.run-body{overflow:auto}` ⇒ `#out-body{max-height:40dvh; overflow:auto}`. On a
phone this is the classic scroll trap: the user cannot tell which surface will
move. Fix: let the document scroll. One scroller. The dock becomes
`position: sticky; bottom: 0`.

**3.3 — The approval bar can land under the dock.** `.hitl` renders at the bottom
of the run pane and relies on `scrollIntoView({block:'nearest'})`; with the dock
and tabbar stacked below it, the APPROVE/DENY buttons can sit behind them. A
decision prompt must never be reachable-only-by-scrolling. Fix: promote HITL to a
bottom sheet above the dock, with the page inert behind it.

**3.4 — The bus is unreadable on a phone and should not be a tab.**
Grid `auto 60px 76px 1fr` at 11.5px mono on a 360px viewport leaves ~120px for
the message column, then ellipsises it. It is texture, not data. Fix: on mobile,
collapse to **two lines per event** (`time · source · event` / message), cap to
the last 12, and expand on tap. The full 60-row firehose is a desktop affordance.

**3.5 — The rail hides its own contents.** `mask-image: linear-gradient(90deg,
#000 88%, transparent)` fades the right edge to imply scroll, but there are six
chips and no other affordance. Fix: three primaries, no horizontal scroll, sized
to thumb reach.

**3.6 — iOS keyboard.** `100dvh` + `env(safe-area-inset-bottom)` + a fixed grid
row is a known fight in iOS Safari. Once 3.2 lands (document scroll, sticky dock),
use `VisualViewport` to keep the input above the keyboard, and test it.

**3.7 — Icons that are not iconic.** A book glyph for "Guide" and a waveform for
"Bus" are unguessable. With two tabs, use words.

---

## Phase 4 — Strip the data

Rough count of distinct informational or interactive elements currently on screen
at desktop width: **~100** — topbar (7) + playbook (What-this-is, pipeline, 12
samples in 4 groups, 5 walkthrough steps, 5 grammar rows, 3 tier rows, 4 key
hints) + run (pipeline, 3 welcome paragraphs, badge, meta, body, 2 buttons, tip) +
state (disk, 5 caps, 6 map nodes) + bus (60 rows) + dock (6 chips, input, 4 key
hints).

For a product whose entire vocabulary is **five verbs**.

Delete outright:

- the tiers table and every tier badge (0.1)
- the static pipeline strip (2.3)
- the clock, `LIVE`, the pulse, `rev 0.3` (0.4)
- the 3-paragraph welcome → one sentence plus one primary action
- the desktop "Keys" card **and** the `.keys` legend under the dock — the same
  four shortcuts, printed twice on one screen
- the grammar and tiers tables from the console → `explain.html`

Move behind interaction:

- the machine map → collapsed by default, or explainer-only
- capability blurbs → they are already `title` attributes; make that the only home
- the bus → last 12 on mobile, full log on demand

Target end state for the console: **command bar, result, approval bar, disk, and a
collapsed bus.** Everything else is an explainer, one link away.

---

## Phase 5 — Make the kernel the durable artifact

`kernel.js` is the only part of this repository with a life beyond the demo. It is
DOM-free, event-driven, and already has a test seam.

- Port the TS kernel and protocol types stranded on `main`
  (`docs/branch-review.md` flags them as worth taking) and settle the build-step
  question this forces.
- Unit-test the kernel directly, without Playwright. Broker semantics — one-shot
  approval spent on use, unreachable-without-grant, risk escalation — deserve
  tests that do not boot a browser.
- Consider publishing it. A tiny, honest, well-tested capability broker with HITL
  is a more defensible artifact than a console that explains one.

---

## Sequencing and effort

| Phase | Work | Effort | Unblocks |
|---|---|---|---|
| 0 | Truth pass — deletions only | S | everything; stop polishing claims you will delete |
| 1 | Real navigate + persistence | M | the entire value proposition |
| 2 | Concept separation, 3 artifacts | M | Phases 3 and 4 |
| 3 | Mobile-primary rebuild | M | the stated pain |
| 4 | Strip | S | — |
| 5 | Kernel as library | M | long-term value |

Phases 0 and 4 are pure subtraction and can be done in an afternoon. Phase 1 is
the one that changes what the product *is*. Phases 2 and 3 are the ones that
change how it *feels*. Doing 3 before 0 would mean carefully laying out a tier
badge that is about to be deleted.

## The one-line version

> Delete every claim the code does not support, make exactly one capability real
> so the approval gate has a stake, split the console from the explainer from the
> blog, and let the kernel — not the dashboard — be the thing that lasts.
