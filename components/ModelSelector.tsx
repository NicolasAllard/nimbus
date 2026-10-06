"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { MODELS } from "@/models.config";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const active = MODELS.find((model) => model.id === value);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="model-select"
        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400"
      >
        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
        Model
      </label>
      <div className="relative">
        <select
          id="model-select"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 pr-8 text-sm text-neutral-100 shadow-sm outline-none transition-colors hover:border-neutral-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50"
        >
          {MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
      </div>
      {active && (
        <div className="rounded-lg bg-neutral-900/60 px-2.5 py-2 text-xs text-neutral-500">
          <p>{active.description}</p>
          <p className="mt-1 text-neutral-600">{active.contextWindow.toLocaleString("en-US")} token context</p>
        </div>
      )}
    </div>
  );
}
