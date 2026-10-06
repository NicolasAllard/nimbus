export interface SourceRef {
  file: string;
  heading: string;
}

export interface SourcesAnnotation {
  type: "sources";
  sources: SourceRef[];
}

export interface MetricsAnnotation {
  type: "metrics";
  modelId: string;
  modelDisplayName: string;
  /** The model the user actually selected, when it differs from modelId (i.e. it failed over). */
  requestedModelId?: string;
  requestedModelDisplayName?: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
  sources: SourceRef[];
}

export type ChatAnnotation = SourcesAnnotation | MetricsAnnotation;

export function isMetricsAnnotation(value: unknown): value is MetricsAnnotation {
  return typeof value === "object" && value !== null && (value as { type?: unknown }).type === "metrics";
}
