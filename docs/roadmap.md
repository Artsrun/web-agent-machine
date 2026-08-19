# Web Agent Machine — Future Development Roadmap

Grounded in the [MDN Web API reference](https://developer.mozilla.org/en-US/docs/Web/API).

Current status: **v0.2** (Kernel + Capability Broker + FileAgent + BrowserAgent stub + Worker planner + SabRing scaffolding).

---

## Phase 5 — Local Model Runtime
**Target APIs**: WebGPU, WebAssembly, OPFS, Streams

- Load quantized 6B / 8B models from OPFS
- WebGPU compute shaders for inference (or WebLLM / Transformers.js style)
- Progressive / streaming weight loading via Streams API
- Model router becomes hot-swappable
- Optional WebNN when available

## Phase 6 — Full Worker Mesh + Shared Memory
**Target APIs**: Web Workers, SharedArrayBuffer, Atomics, MessageChannel, Broadcast Channel

- Multiple dedicated workers (planner, render, compute, network)
- SabRing → multi-producer multi-consumer rings
- Structured clone + Transferable for large payloads
- Cross-worker event bus via Broadcast Channel

## Phase 7 — Capability-Complete File & Storage Layer
**Target APIs**: Origin Private File System (OPFS), File System Access API, IndexedDB, Cache API

- Real OPFS backend for FileAgent (persistent across sessions)
- File System Access API for user-granted directories (with HITL)
- IndexedDB for structured agent memory & task history
- Cache API for model weight & WASM binary caching

## Phase 8 — Real Browser Agent
**Target APIs**: (limited by design) + Permissions API, Clipboard API

- Semantic actions preferred over vision
- Fallback vision path via OffscreenCanvas + VLM
- Clipboard read/write under capability broker
- Permissions API integration for microphone, camera, notifications

## Phase 9 — Graphics & Desktop Composition
**Target APIs**: WebGPU, OffscreenCanvas, Canvas API, CSS, View Transitions API, Navigation API

- Scene graph owned by render worker
- Window-like surfaces composed via WebGPU
- HTML layer for semantic UI + accessibility
- View Transitions for smooth desktop-like navigation
- Navigation API for agent-controlled history

## Phase 10 — Network & Offline
**Target APIs**: Service Worker, Fetch, WebTransport, Background Sync, Periodic Background Sync

- Service Worker as lifecycle + offline shell
- Model asset precaching
- WebTransport for low-latency agent channels (future)
- Background Sync for deferred tool results

## Phase 11 — Media & Sensing
**Target APIs**: MediaDevices, Web Speech API, WebCodecs, Web Audio

- Microphone / camera under high-risk HITL
- Speech recognition / synthesis as agent I/O
- WebCodecs for efficient video frame handling (VLM input)

## Phase 12 — WASM Component Model
**Target APIs**: WebAssembly, WebAssembly Component Model (WIT)

- Typed capability interfaces via WIT
- Sandboxed plugins written in Rust / Go / C / AssemblyScript
- Capability broker becomes the only entry point to host APIs

## Phase 13 — Multi-Agent Graph & Persistence
**Target APIs**: IndexedDB, OPFS, Broadcast Channel

- Persistent agent memory across sessions
- Specialized agents (CodeAgent, MediaAgent, SecurityAgent…)
- Event-sourced state with explicit schemas

## Phase 14 — Security Hardening
**Target APIs**: Permissions Policy, CSP, COOP/COEP, Credential Management

- Full capability policy language
- Content Security Policy + Permissions Policy lockdown
- Cross-origin isolation enforced by default
- Optional WebAuthn for high-risk approvals

---

## Guiding Principle

Every new capability must be:

1. Exposed only through the **Capability Broker**
2. Prefer **semantic APIs** over pixel / vision control
3. Runnable under **cross-origin isolation** (COOP + COEP)
4. Documented against the corresponding [MDN Web API](https://developer.mozilla.org/en-US/docs/Web/API)

The browser is the hardware abstraction.  
The Agent Kernel is the policy and orchestration layer.  
The LLM remains a replaceable component.
