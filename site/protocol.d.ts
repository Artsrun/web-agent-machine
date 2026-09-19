/* The typed statement of the kernel's protocol.
   Ported from protocols/events.ts and protocols/capabilities.ts on the
   abandoned `main` branch, and corrected to what the kernel actually emits.

   This is a .d.ts against the JavaScript that ships, not a .ts that compiles
   into it: there is no build step, nothing to bundle, and nothing that can
   drift from the running code. `npm run typecheck` checks site/kernel.js
   against this file directly.

   Dropped in the port, because nothing sets them: Grant.expires,
   Grant.constraints, CapabilityDef.scope, Intent.context, and the
   `state_update` event. A type for a field no code writes is a claim like
   any other. */

export type RiskLevel = 'low' | 'medium' | 'high';

export interface CapabilityDef {
  id: string;
  risk: RiskLevel;
  /** One line, shown as the row's title attribute in the console. */
  blurb: string;
  /** Forces approval on a capability whose risk alone would not. */
  requiresHITL?: boolean;
}

/** Eligibility to ask. Risk, not the grant, decides whether asking needs a human. */
export interface Grant {
  capability: string;
  principal: string;
}

export interface CapRequest {
  requestId: string;
  capability: string;
  args: unknown;
  principal: string;
}

export type CapResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: string; requiresHITL?: boolean };

export interface Intent {
  id: string;
  text: string;
  timestamp: number;
}

export interface PlanStep {
  id: string;
  description: string;
  /** Absent means the planner declined: no capability matched the text. */
  capability?: string;
  args?: Record<string, unknown>;
}

export interface Plan {
  id: string;
  intentId: string;
  steps: PlanStep[];
}

export interface ToolCall {
  id: string;
  capability: string;
  args: unknown;
  principal: string;
}

export interface ToolResult {
  callId: string;
  capability: string;
  args: unknown;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface Noop {
  description: string;
  text: string;
}

/** A refusal is terminal: nothing is retried and nothing is written instead. */
export interface Denied {
  capability: string;
  args: unknown;
}

export interface AgentError {
  code: 'HITL_REQUIRED' | 'TOOL_FAILED';
  message: string;
  recoverable: boolean;
  capability?: string;
  args?: unknown;
}

export type AgentEvent =
  | { type: 'intent'; payload: Intent }
  | { type: 'plan'; payload: Plan }
  | { type: 'noop'; payload: Noop }
  | { type: 'tool_call'; payload: ToolCall }
  | { type: 'tool_result'; payload: ToolResult }
  | { type: 'denied'; payload: Denied }
  | { type: 'error'; payload: AgentError };

/** What an agent needs from the outside world to act on it. */
export interface BrowserSurface {
  navigate(url: string): Promise<{ ok: boolean; error?: string }>;
  clear?(): void;
}

export type CapHandler = (req: CapRequest) => Promise<CapResponse>;
