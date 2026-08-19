/** Capability Broker types */

export type RiskLevel = "low" | "medium" | "high";

export type CapabilityDef = {
  id: string;
  risk: RiskLevel;
  description?: string;
  scope?: string[]; // paths, origins, etc.
  requiresHITL?: boolean;
};

export type Grant = {
  capability: string;
  principal: string; // agent id
  expires?: number;
  constraints?: Record<string, unknown>;
};

export type CapRequest = {
  requestId: string;
  capability: string;
  args: unknown;
  principal: string;
};

export type CapResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: string; requiresHITL?: boolean };

/** Built-in capability registry (extensible) */
export const CORE_CAPABILITIES: CapabilityDef[] = [
  { id: "filesystem.read", risk: "low" },
  { id: "filesystem.list", risk: "low" },
  { id: "filesystem.write", risk: "medium", requiresHITL: false },
  { id: "network.fetch", risk: "medium" },
  { id: "browser.navigate", risk: "high", requiresHITL: true },
  { id: "browser.click", risk: "high", requiresHITL: true },
  { id: "gpu.render", risk: "low" },
  { id: "clipboard.read", risk: "medium" },
  { id: "clipboard.write", risk: "medium" },
  { id: "microphone.record", risk: "high", requiresHITL: true },
];
