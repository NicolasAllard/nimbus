// Standalone model registry. The app must never reference a hard-coded model id directly;
// every call site reads from MODELS (or the helpers below) so switching/adding providers only
// requires editing this file.

export type Provider = "openai" | "google";

export interface ModelConfig {
  /** Stable id used in the UI, the request body, and for fallback lookups. */
  id: string;
  /** Which provider SDK to use. */
  provider: Provider;
  /** The literal model id sent to the provider SDK. */
  modelId: string;
  displayName: string;
  description: string;
  contextWindow: number;
  /** USD cost per single input token. */
  inputCostPerToken: number;
  /** USD cost per single output token. */
  outputCostPerToken: number;
  /** Ids of other ModelConfig entries to try, in order, if this model fails. */
  fallbacks: string[];
}

export const MODELS: ModelConfig[] = [
  {
    id: "gpt-4o-mini",
    provider: "openai",
    modelId: "gpt-4o-mini",
    displayName: "GPT-4o mini",
    description: "Fast, low-cost OpenAI model. Good default for everyday product and pricing questions.",
    contextWindow: 128_000,
    inputCostPerToken: 0.15 / 1_000_000,
    outputCostPerToken: 0.6 / 1_000_000,
    fallbacks: ["gemini-flash-latest", "gpt-4o"],
  },
  {
    id: "gpt-4o",
    provider: "openai",
    modelId: "gpt-4o",
    displayName: "GPT-4o",
    description: "Higher-accuracy OpenAI flagship model, useful for conflicting or multi-document questions.",
    contextWindow: 128_000,
    inputCostPerToken: 2.5 / 1_000_000,
    outputCostPerToken: 10.0 / 1_000_000,
    fallbacks: ["gpt-4o-mini", "gemini-3.1-pro-preview"],
  },
  {
    id: "gemini-flash-latest",
    provider: "google",
    modelId: "gemini-flash-latest",
    displayName: "Gemini Flash (latest)",
    description:
      "Fast, low-cost Google model with a very large context window. Tracks Google's current recommended Flash model.",
    contextWindow: 1_048_576,
    inputCostPerToken: 0.3 / 1_000_000,
    outputCostPerToken: 2.5 / 1_000_000,
    fallbacks: ["gpt-4o-mini", "gemini-3.1-pro-preview"],
  },
  {
    id: "gemini-3.1-pro-preview",
    provider: "google",
    modelId: "gemini-3.1-pro-preview",
    displayName: "Gemini 3.1 Pro (Preview)",
    description: "High-accuracy Google model with a very large context window, for the hardest questions.",
    contextWindow: 1_048_576,
    inputCostPerToken: 1.25 / 1_000_000,
    outputCostPerToken: 10.0 / 1_000_000,
    fallbacks: ["gemini-flash-latest", "gpt-4o-mini"],
  },
];

export function getModelConfig(id: string | undefined | null): ModelConfig | undefined {
  return MODELS.find((model) => model.id === id);
}

/** Builds the ordered list of models to try: the requested model first, then its fallbacks. */
export function resolveFallbackChain(requestedId: string | undefined | null): ModelConfig[] {
  const start = getModelConfig(requestedId) ?? MODELS[0];
  const chain: ModelConfig[] = [start];
  const seen = new Set([start.id]);

  for (const fallbackId of start.fallbacks) {
    if (seen.has(fallbackId)) continue;
    const fallbackConfig = getModelConfig(fallbackId);
    if (fallbackConfig) {
      chain.push(fallbackConfig);
      seen.add(fallbackConfig.id);
    }
  }

  return chain;
}
