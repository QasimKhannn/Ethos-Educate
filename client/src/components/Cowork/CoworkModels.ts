// cowork — available LLM models for the Cowork project picker.
// Only models that are active in librechat.yaml are listed here.
// Cowork-only: no effect on the main chat or other agents.

export type CoworkModel = {
  provider: string;
  model: string;
  label: string;
};

export const COWORK_MODELS: CoworkModel[] = [
  { provider: 'azureOpenAI', model: 'gpt-5-chat', label: 'GPT-5 Pro' },
  { provider: 'azureOpenAI', model: 'gpt-5-mini', label: 'GPT-5 Mini' },
  { provider: 'azureOpenAI', model: 'gpt-5-nano', label: 'GPT-5 Nano' },
];

/** Default model — matches the seeded Cowork agent in seed-cowork-agent.js. */
export const DEFAULT_COWORK_MODEL: CoworkModel = COWORK_MODELS[0];

/** Resolve a stored model key to its display label. */
export function resolveModelLabel(model?: string): string {
  if (!model) return DEFAULT_COWORK_MODEL.label;
  return COWORK_MODELS.find((m) => m.model === model)?.label ?? model;
}
