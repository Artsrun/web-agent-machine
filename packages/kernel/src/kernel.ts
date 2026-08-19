import { EventBus } from "./event-bus.js";
import { CapabilityBroker } from "./capability-broker.js";
import { ModelRouter, type Task } from "./model-router.js";
import { WorkerBridge } from "./worker-bridge.js";
import type { Intent, Plan, PlanStep, AgentEvent } from "../../../protocols/events.js";
import type { CapRequest } from "../../../protocols/capabilities.js";

export type KernelOptions = {
  principal?: string;
  /** Optional worker URL (browser). If omitted, in-process mock is used. */
  workerUrl?: string | URL;
};

export class Kernel {
  readonly bus = new EventBus();
  readonly broker: CapabilityBroker;
  readonly router = new ModelRouter();
  readonly workers: WorkerBridge;
  private principal: string;

  constructor(opts: KernelOptions = {}) {
    this.broker = new CapabilityBroker();
    this.principal = opts.principal ?? "default-agent";
    this.workers = new WorkerBridge(opts.workerUrl);
  }

  /** Grant a capability to the current principal */
  grant(capability: string, constraints?: Record<string, unknown>) {
    this.broker.grant({
      capability,
      principal: this.principal,
      constraints,
    });
  }

  /** Wire an agent that exposes handlers */
  registerAgent(handlers: Record<string, (req: CapRequest) => Promise<any>>) {
    for (const [cap, fn] of Object.entries(handlers)) {
      this.broker.handle(cap, fn);
    }
  }

  /** Simulate human-in-the-loop approval */
  approve(capability: string) {
    this.broker.approve(this.principal, capability);
  }

  /** Main entry: turn raw intent into plan + tool calls */
  async handleIntent(text: string, context?: Record<string, unknown>) {
    const intent: Intent = {
      id: crypto.randomUUID(),
      text,
      context,
      timestamp: Date.now(),
    };

    await this.bus.emit({ type: "intent", payload: intent });

    // Route model
    const task: Task = {
      text,
      complexity: this.estimateComplexity(text),
      needsVision: /screenshot|image|see|look|vision/i.test(text),
      longContext: (context?.history?.length ?? 0) > 8,
    };
    const model = this.router.route(task);

    // Planner runs in the worker
    const planRes = await this.workers.request("plan", { text });
    if (!planRes.ok) {
      await this.bus.emit({
        type: "error",
        payload: { code: "PLAN_FAILED", message: planRes.error ?? "plan failed", recoverable: true },
      });
      return { intent, plan: { id: crypto.randomUUID(), intentId: intent.id, steps: [] }, model };
    }

    const steps = (planRes.result as any).steps as PlanStep[];
    const plan: Plan = {
      id: crypto.randomUUID(),
      intentId: intent.id,
      steps,
    };

    await this.bus.emit({ type: "plan", payload: plan });

    // Execute steps that have a capability
    for (const step of steps) {
      if (!step.capability) continue;

      const callId = crypto.randomUUID();
      await this.bus.emit({
        type: "tool_call",
        payload: {
          id: callId,
          capability: step.capability,
          args: step.args ?? {},
          principal: this.principal,
        },
      });

      const req: CapRequest = {
        requestId: callId,
        capability: step.capability,
        args: step.args ?? {},
        principal: this.principal,
      };

      const result = await this.broker.request(req);

      await this.bus.emit({
        type: "tool_result",
        payload: {
          callId,
          ok: result.ok,
          result: result.ok ? result.result : undefined,
          error: result.ok ? undefined : result.error,
        },
      });

      if (!result.ok && result.requiresHITL) {
        await this.bus.emit({
          type: "error",
          payload: {
            code: "HITL_REQUIRED",
            message: `Human approval needed for ${step.capability}`,
            recoverable: true,
          },
        });
        break;
      }
    }

    return { intent, plan, model };
  }

  private estimateComplexity(text: string): number {
    const len = text.length;
    if (len > 300 || /plan|architect|debug|refactor|multi-step/i.test(text)) return 0.8;
    if (len > 120) return 0.5;
    return 0.2;
  }
}
