# Web Agent Machine

**AI-native machine substrate inside the browser.**

```text
Agent Kernel + WASM + Workers + WebGPU + HTML/Canvas + Capability Security
+ local 6B / 8B / 9B model routing
```

Not a chatbot. Not a traditional OS.  
A capability-secured agent runtime that treats the browser as hardware abstraction.

## Status

Architecture **v0.2** · Implementation **Phase 2–4**

- Kernel + EventBus + ModelRouter + CapabilityBroker + WorkerBridge
- FileAgent + BrowserAgent (with HITL)
- Minimal desktop shell (`apps/desktop`)
- Worker offload scaffolding (`packages/workers`)

See [docs/architecture.md](docs/architecture.md) and [docs/workers.md](docs/workers.md).

## Core Ideas

- LLM is a **replaceable component**, never the kernel
- Semantic APIs preferred over pixel / vision control
- Explicit **Capability Broker** (no ambient authority)
- Dual UI: HTML for semantics, WebGPU/Canvas for composition
- Model router: 6B fast path, 8B for hard reasoning
- Cross-origin isolation (COOP/COEP) required for performance

## Quick Start

```bash
# run the pure Node test suite
cd packages/kernel && npx tsx src/run-tests.mjs

# desktop shell (requires a static server that can serve TS or a bundler)
cd apps/desktop && npx serve .
```

## Repository Layout

```text
packages/
  kernel/     Agent Kernel (planner, router, permissions, memory, events)
  agents/     Specialized agents
  workers/    Concurrent execution
  wasm/       WIT interfaces + components
  graphics/   Scene graph + WebGPU
  ui/         HTML surfaces
apps/
  desktop/    Runnable shell
protocols/    Shared event & capability types
docs/         Architecture & principles
site/         GitHub Pages
```

## Evolution

```text
Phase 0–1  Browser shell + dual UI
Phase 2    Worker runtime + Kernel skeleton
Phase 3    WASM tool runtime
Phase 4    Capability Broker
Phase 5    Local model router (6B/8B)
Phase 6+   Multi-agent + GPU desktop
```

## License

MIT (planned)
