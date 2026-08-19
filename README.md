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

## Status

Architecture **v0.2** · Implementation **Phase 2–4**

- Kernel + EventBus + ModelRouter + CapabilityBroker + WorkerBridge
- FileAgent + BrowserAgent (with HITL + automated fallbacks)
- Live interactive console (GitHub Pages)
- Worker offload scaffolding (`packages/workers`)

See [docs/architecture.md](docs/architecture.md), [docs/workers.md](docs/workers.md) and [docs/roadmap.md](docs/roadmap.md).

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

# desktop console locally
cd apps/desktop && npx serve .
# open /console.html
```

## License

MIT (planned)
