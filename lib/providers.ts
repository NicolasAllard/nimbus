import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import type { ModelConfig } from "@/models.config";

// API keys are read from the server-only process.env and never sent to the client.
// "strict" compatibility makes the OpenAI provider request stream_options.include_usage,
// which is what the token counts/cost metrics in the UI depend on.
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY, compatibility: "strict" });
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export function resolveLanguageModel(config: ModelConfig): LanguageModel {
  switch (config.provider) {
    case "openai":
      return openai(config.modelId);
    case "google":
      return google(config.modelId);
    default: {
      const exhaustiveCheck: never = config.provider;
      throw new Error(`Unsupported provider: ${exhaustiveCheck}`);
    }
  }
}
