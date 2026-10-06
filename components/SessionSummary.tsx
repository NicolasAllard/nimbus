import { BarChart3 } from "lucide-react";

interface SessionSummaryProps {
  messageCount: number;
  promptTokens: number;
  completionTokens: number;
  cost: number;
}

function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(5)}`;
  return `$${cost.toFixed(4)}`;
}

export function SessionSummary({ messageCount, promptTokens, completionTokens, cost }: SessionSummaryProps) {
  const stats = [
    { label: "Answers", value: messageCount.toLocaleString("en-US") },
    { label: "Input tokens", value: promptTokens.toLocaleString("en-US") },
    { label: "Output tokens", value: completionTokens.toLocaleString("en-US") },
  ];

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 text-sm shadow-sm">
      <h2 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        <BarChart3 className="h-3.5 w-3.5 text-indigo-400" />
        Session totals
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md bg-neutral-950/60 px-2 py-1.5 text-center">
            <p className="text-sm font-semibold text-neutral-100">{stat.value}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-neutral-500">{stat.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between rounded-md bg-indigo-500/10 px-2.5 py-1.5">
        <span className="text-xs text-indigo-300">Estimated cost</span>
        <span className="font-mono text-sm font-semibold text-indigo-200">{formatCost(cost)}</span>
      </div>
    </div>
  );
}
