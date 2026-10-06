"use client";

const PROMPTS = [
  "Does Vault support SAML 2.0 on the Pro plan?",
  "I'm getting a 403 Forbidden error on an API call, how do I fix it?",
  "What's included in the Relay Pro plan?",
  "Does NimbusStack support SCIM provisioning?",
];

export function SuggestedPrompts({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onSelect(prompt)}
          className="rounded-full border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:border-indigo-500/60 hover:bg-indigo-500/10 hover:text-indigo-200"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
