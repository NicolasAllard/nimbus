import { NextRequest } from "next/server";
import { streamText, convertToCoreMessages, StreamData, type Message } from "ai";
import { resolveFallbackChain, type ModelConfig } from "@/models.config";
import { resolveLanguageModel } from "@/lib/providers";
import { searchKnowledgeBase, type KnowledgeChunk } from "@/lib/knowledge-base";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an internal product knowledge chatbot for NimbusStack. Answer using ONLY the provided text passages.

A "conflict" means two passages give a DIFFERENT answer to the SAME fact about the SAME
product/tier (e.g., one file says Vault SAML 2.0 is Enterprise only, another says Vault SAML 2.0
is Pro and Enterprise). It is NOT a conflict when different products or tiers simply have
different values for the same kind of metric -- that is normal variation, not a discrepancy, and
must not be described using the word "conflict" or "disagree".
Example of NOT a conflict: "What's the P1 SLA for the Starter tier?" has Ledger at 8 business
hours, Relay at 8 business hours, and Vault at 4 business hours. These are three different
products each reporting their own SLA -- simply list each product's value, do not say the
documents conflict or disagree.
Example of an actual conflict: two passages both describe Vault's SAML availability and give
different tiers for it -- that must be flagged as a conflict.

The documents use different words for the same feature -- treat "single sign-on", "SSO", "SAML",
"SAML 2.0", and "federated sign-in" as synonyms referring to the same capability. The conflict
check in step 2 applies based on what the passages actually describe, not on whether the user's
wording matches the document's wording: if the question is about SSO/single sign-on and any
retrieved passage mentions SAML/federated sign-in for that same product, you must cross-reference
ALL retrieved passages about that product's sign-in/SAML/SSO support against each other before
answering, even if only one of them uses the word "SSO".

Passages may include markdown tables with a header row of tier/column names (e.g.,
"| Priority | Starter | Pro | Enterprise |"). When reading a table, match each row value to the
column header directly above it by position -- count columns carefully and do not shift a value
from a neighboring column (e.g., do not report the Pro column's value as the Enterprise value).

Execution Steps (run these for every question, even ones that look like a simple factual
lookup -- the conflict check in step 2 is not optional and does not depend on how the question
is phrased):

1. Read all provided context passages.
2. Cross-reference the facts. Check if any two passages describe the SAME fact about the SAME
   product/tier with a DIFFERENT answer, even if only one of those passages was what directly
   prompted the question.
3. If there is a conflict as defined above (e.g., security-overview.md says SAML 2.0 is Enterprise only, but vault.md says it is Pro and Enterprise), you MUST explicitly state that the documents disagree, explain the discrepancy, and cite both file names. Do this before giving any other answer.
4. If there is no conflict, provide the answer -- including when different products/tiers simply have different values. Be complete: if a passage lists multiple required conditions for the
   same answer (e.g., a minimum product version AND a specific partner/API version, or a feature
   available only with an additional requirement), state all of them, not just the first one, and
   cite every passage you drew a detail from.
5. If the answer is not in the documents, explicitly state that it is missing from the knowledge base.

Always append the source filename to your claims (e.g., (source: vault.md)).
If a troubleshooting question is ambiguous, such as a 403 Forbidden API error, state the differing resolution steps for both Nimbus Pulse and Nimbus Relay.

Final check before you answer: if your context passages include BOTH a security-overview.md
passage and a product doc passage (e.g. vault.md) that each state which tier a sign-in/SSO/SAML
feature is available on, you MUST compare those two tier claims. If they differ, your answer MUST
start with the conflict disclosure (step 3) -- never answer with only one source's tier claim.`;

function buildContextBlock(sources: KnowledgeChunk[]): string {
  if (sources.length === 0) {
    return "No matching passages were found in the knowledge base for this question.";
  }
  return sources
    .map((source) => `[Source: ${source.file} | Section: ${source.heading}]\n${source.content}`)
    .join("\n\n---\n\n");
}

function getLatestUserText(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

/**
 * A short, context-free follow-up like "What about on the Pro tier?" doesn't contain enough
 * keywords on its own to refetch the right passages, even though the model can tell from the
 * conversation what product/topic it refers to. Folding the last couple of turns into the search
 * query carries that topic (e.g. "Relay", "audit log retention") forward into retrieval too.
 */
function buildSearchQuery(messages: Message[]): string {
  return messages
    .slice(-4)
    .map((message) => message.content)
    .join(" ");
}

function textResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * Starts a stream for a single model and peeks at its first chunk before returning. Each access
 * to `result.fullStream` tees the underlying stream, so this partial read doesn't consume or
 * drop any data from the full response that `toDataStreamResponse()` reads afterwards -- it only
 * lets us detect immediate provider failures (bad key, rate limit) so we can fall back cleanly
 * instead of crashing mid-stream.
 */
async function attemptModel(
  modelConfig: ModelConfig,
  requestedModelConfig: ModelConfig,
  system: string,
  coreMessages: ReturnType<typeof convertToCoreMessages>,
  data: StreamData,
  sources: KnowledgeChunk[],
) {
  const result = streamText({
    model: resolveLanguageModel(modelConfig),
    system,
    messages: coreMessages,
    // Low temperature so the mandatory conflict-check/citation rules are followed consistently
    // regardless of how the question happens to be phrased.
    temperature: 0.2,
    // We already implement our own cross-model fallback below; disable the SDK's built-in retry
    // so a retryable provider error (e.g. a rate limit that suggests retrying in 20+ hours)
    // fails fast into the next fallback model instead of stalling the response.
    maxRetries: 0,
    onFinish: ({ usage }) => {
      // Some providers omit usage on certain responses, which surfaces as NaN; NaN silently
      // becomes `null` over JSON, so normalize to 0 before computing cost.
      const promptTokens = Number.isFinite(usage.promptTokens) ? usage.promptTokens : 0;
      const completionTokens = Number.isFinite(usage.completionTokens) ? usage.completionTokens : 0;
      const cost = promptTokens * modelConfig.inputCostPerToken + completionTokens * modelConfig.outputCostPerToken;
      data.appendMessageAnnotation({
        type: "metrics",
        modelId: modelConfig.id,
        modelDisplayName: modelConfig.displayName,
        ...(modelConfig.id !== requestedModelConfig.id && {
          requestedModelId: requestedModelConfig.id,
          requestedModelDisplayName: requestedModelConfig.displayName,
        }),
        usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
        cost,
        sources: sources.map(({ file, heading }) => ({ file, heading })),
      });
      void data.close();
    },
  });

  const reader = result.fullStream.getReader();
  const first = await reader.read();
  reader.releaseLock();
  if (!first.done && first.value.type === "error") {
    const { error } = first.value;
    throw error instanceof Error ? error : new Error(String(error));
  }

  return result;
}

export async function POST(req: NextRequest) {
  let payload: { messages?: Message[]; modelId?: string };
  try {
    payload = await req.json();
  } catch {
    return textResponse("Request body must be valid JSON.", 400);
  }

  const messages = payload.messages ?? [];
  const latestUserText = getLatestUserText(messages).trim();

  if (!latestUserText) {
    return textResponse("Message cannot be empty.", 400);
  }

  const sources = searchKnowledgeBase(buildSearchQuery(messages));
  const system = `${SYSTEM_PROMPT}\n\nKnowledge base passages:\n\n${buildContextBlock(sources)}`;
  const coreMessages = convertToCoreMessages(messages);
  const chain = resolveFallbackChain(payload.modelId);

  const data = new StreamData();
  data.appendMessageAnnotation({
    type: "sources",
    sources: sources.map(({ file, heading }) => ({ file, heading })),
  });

  let lastError: unknown;
  for (const modelConfig of chain) {
    try {
      const result = await attemptModel(modelConfig, chain[0], system, coreMessages, data, sources);
      return result.toDataStreamResponse({
        data,
        headers: { "X-Model-Used": modelConfig.id },
      });
    } catch (error) {
      lastError = error;
      console.error(`[chat] model "${modelConfig.id}" failed, trying next fallback:`, error);
    }
  }

  // No model succeeded: close the unused data stream so it doesn't dangle, then report the failure.
  void data.close();
  console.error("[chat] all providers failed:", lastError);
  return textResponse(
    "All configured AI providers are currently rate-limited or unavailable. Please try again in a moment.",
    503,
  );
}
