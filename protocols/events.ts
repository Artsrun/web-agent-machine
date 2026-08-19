/** Shared event types for the Agent Kernel */

export type Intent = {
  id: string;
  text: string;
  context?: Record<string, unknown>;
  timestamp: number;
};

export type Plan = {
  id: string;
  intentId: string;
  steps: PlanStep[];
};

export type PlanStep = {
  id: string;
  description: string;
  capability?: string;
  args?: unknown;
};

export type ToolCall = {
  id: string;
  capability: string;
  args: unknown;
  principal: string;
};

export type ToolResult = {
  callId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

export type StateDelta = {
  path: string;
  value: unknown;
};

export type AgentError = {
  code: string;
  message: string;
  recoverable: boolean;
};

export type AgentEvent =
  | { type: "intent"; payload: Intent }
  | { type: "plan"; payload: Plan }
  | { type: "tool_call"; payload: ToolCall }
  | { type: "tool_result"; payload: ToolResult }
  | { type: "state_update"; payload: StateDelta }
  | { type: "error"; payload: AgentError };
