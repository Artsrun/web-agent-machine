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
- Live interactive console
- Worker offload scaffolding
- Notes + Playwright UI tests

## Quick Start

```bash
cd site && npx serve .   # open /index.html
```

## Tests

```bash
npm install
npx playwright install chromium
npm test                  # against live GitHub Pages
BASE_URL=http://localhost:3000 npm test   # against local serve
```

## License

MIT
