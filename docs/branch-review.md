# Branch review — 2026-09-16

Every local and remote branch, compared against `prod`, with a verdict for each.
`prod` is the trunk: GitHub Pages deploys from it and every merged PR targeted it.

## The landscape

| Branch | Head | vs `prod` | Verdict |
|---|---|---|---|
| `prod` | `5a8ba6a` | — | Trunk. Deployed. |
| `main` | `a2cc3f7` | 11 ahead / 37 behind | **Divergent.** Holds the only copy of the TS kernel, the protocol types and the roadmap. Partly ported here. |
| `codex/bkt-simulator-history-graph` | `51b80d1` | 0 ahead / 1 behind | **Fully merged** (PR #6). Safe to delete. |
| `copilot/web-agent-machine-deployment` | `bc2c949` | 0 ahead / 35 behind | **Fully merged** (PR #5). Safe to delete. |
| `claude/hubspot-blog-deploy-se932m` | `8e9aede` | 1 ahead / 30 behind | **Orphaned work.** PR #2 merged at `5c8a40f`; one commit landed after and was never merged. Ported here. |

Nothing is lost by deleting the two fully-merged branches — `git rev-list prod..<branch>`
is empty for both, so every commit is already reachable from `prod`.

## `claude/hubspot-blog-deploy-se932m` — ported

The unmerged commit (`8e9aede`, "pages: add 20-kaomoji reference table and usage tips")
targeted `site/blog.html` back when that file *was* the kaomoji post. Since then
`blog.html` became the notes index and the post moved to `site/notes/kaomoji.html`,
so the commit could never merge cleanly — `git merge` would have put a reference
table in the middle of a link list.

Ported by hand into `site/notes/kaomoji.html`:

- the `--font-kao` custom property, hoisted out of three duplicated font stacks;
- `.face-inline` widened from `code.face-inline`, so both `<code>` and `<span>` work;
- the twenty-face reference table and the "without looking silly" usage section.

Covered by `tests/notes.spec.ts` → *kaomoji note carries the twenty-face reference table*.

## `main` — what is worth taking, and what is not

`main` is not behind in the ordinary sense; it is a parallel line that stopped in
August. It carries four things `prod` has never had:

| Path | Take it? |
|---|---|
| `site/index.html` (845-line machine map console) | **Idea only.** See below. |
| `protocols/*.ts` | **Taken** (2026-09-19). See below. |
| `packages/kernel/src/*.ts` | **Skip — it does not compile.** See below. |
| `docs/roadmap.md`, `docs/workers.md` | Worth taking as-is. No conflict with anything on `prod`. |
| `apps/desktop/console.html` | Skip. Superseded by `site/index.html` on `prod`. |

### The machine map, merged as an idea rather than a diff

`main`'s console is a full-page SVG architecture diagram with an `<area>` image map
as its scene graph and a hover inspector. It is the better *explanation* of the
system. But it runs in `SIM` mode — the header literally says *"no live kernel
attached"* — and its numbers are `jitter()`ed fakes.

`prod` has the opposite problem: a real kernel with real events, and nothing that
shows you the shape of the machine those events move through.

Taking `main`'s 845 lines wholesale would have meant re-adding a simulator on top of
a live kernel, and an image-map hit layer that needs a `ResizeObserver` to rescale
its `coords` on every layout change — a lot of machinery for a diagram. So the map
was rebuilt as data (`site/samples.js` → `MAP`) and rendered as a six-node stack
that **lights up from real bus events**, not from `Math.random()`. Same explanatory
job, no simulator, and it costs about forty lines.

`main`'s `SIM` console is therefore still worth reading, and still not worth merging.

## Update, 2026-09-19 — what `packages/kernel` actually contains

The table above used to say the TS kernel sources were "worth taking … the typed
statement of the same protocol". Half of that was wrong, and it is worth writing
down why, because the claim survived unchecked for a month.

`packages/kernel/src/` holds exactly two files, `index.ts` and `kernel.ts`.
Between them they import five modules that **were never committed**:

```text
capability-broker.ts   MISSING
event-bus.ts           MISSING
model-router.ts        MISSING
worker-bridge.ts       MISSING
sab-ring.ts            MISSING
```

So the package cannot compile, has never compiled, and is a skeleton rather than
an implementation. `packages/agents/` is a `package.json` with no `src` at all.
There is nothing there to port.

`protocols/events.ts` and `protocols/capabilities.ts`, by contrast, are real and
complete — two files of pure type declarations with no dependencies. Those have
been taken, as `site/protocol.d.ts`, corrected to match what the kernel now
actually emits and pruned of every field nothing sets. The repository still has
no build step: the types are a `.d.ts` checked against the shipped JavaScript
with `npm run typecheck`, so there is no `dist/` that can drift from the code
served to a browser.

Recommendation 3 above stands, minus the `packages/*` half: keep `main` as an
archive. `docs/roadmap.md` and `docs/workers.md` are still worth cherry-picking.

## Recommendation

1. Delete `codex/bkt-simulator-history-graph` and `copilot/web-agent-machine-deployment`. Fully merged.
2. Delete `claude/hubspot-blog-deploy-se932m` once this branch merges. Its last commit is ported.
3. Keep `main` for now, but as an archive, not a branch to merge. Cherry-pick `docs/roadmap.md`
   and `docs/workers.md` onto `prod` in their own commit; decide the `packages/*` question
   separately, when the repo needs a build step for another reason.
4. Point the repo's default branch at `prod` so the divergence stops being ambiguous.
