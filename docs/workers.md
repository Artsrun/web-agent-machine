# Workers & SharedArrayBuffer

## Requirements for high-performance workers

To use `SharedArrayBuffer` and high-performance atomics the page **must** be cross-origin isolated:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without these headers `SharedArrayBuffer` is unavailable and many WASM + GPU pipelines degrade.

## Current scaffolding (v0.2)

- `packages/workers/src/agent.worker.ts` — dedicated worker entry
- `packages/kernel/src/worker-bridge.ts` — postMessage bridge with Node mock fallback
- `Kernel.workers` — ready for offloading planner / model / WASM tasks

## Next steps

1. Move real planner into the worker
2. Add SharedArrayBuffer ring buffer for high-frequency state
3. Offload WebGPU command encoding where possible
4. Service Worker for model asset caching + offline
