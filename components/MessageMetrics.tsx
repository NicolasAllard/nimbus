import { ArrowDownToLine, ArrowUpFromLine, FileText, Sparkles, TriangleAlert } from "lucide-react";
import type { MetricsAnnotation } from "@/lib/chat-types";

function formatCost(value: number | null | undefined): string {
  const cost = Number.isFinite(value) ? (value as number) : 0;
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(5)}`;
  return `$${cost.toFixed(4)}`;
}

function formatTokens(value: number | null | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0;
}

export function MessageMetrics({ metrics }: { metrics: MetricsAnnotation }) {
  const uniqueSources = Array.from(
    new Map(metrics.sources.map((source) => [`${source.file}#${source.heading}`, source])).values(),
  );
  const didFailover = Boolean(metrics.requestedModelId && metrics.requestedModelId !== metrics.modelId);

  return (
    <div className="mt-2 max-w-[85%] space-y-2 rounded-lg border border-neutral-800/80 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-400">
      {didFailover && (
        <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-amber-300">
          <TriangleAlert className="h-3 w-3 shrink-0" />
          <span>
            {metrics.requestedModelDisplayName} was unavailable, so {metrics.modelDisplayName} answered instead.
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 font-medium text-indigo-300">
          <Sparkles className="h-3 w-3" />
          {metrics.modelDisplayName}
        </span>
        <span className="inline-flex items-center gap-1">
          <ArrowUpFromLine className="h-3 w-3 text-neutral-500" />
          {formatTokens(metrics.usage.promptTokens)}
        </span>
        <span className="inline-flex items-center gap-1">
          <ArrowDownToLine className="h-3 w-3 text-neutral-500" />
          {formatTokens(metrics.usage.completionTokens)}
        </span>
        <span className="font-mono text-neutral-300">{formatCost(metrics.cost)}</span>
      </div>
      {uniqueSources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-neutral-800/80 pt-1.5">
          <FileText className="h-3 w-3 shrink-0 text-neutral-500" />
          {uniqueSources.map((source) => (
            <span
              key={`${source.file}#${source.heading}`}
              className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300"
              title={source.heading}
            >
              {source.file}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
