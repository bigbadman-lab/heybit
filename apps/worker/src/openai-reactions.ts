import {
  BIT_PERSONALITY_PROMPT,
  BIT_REACTION_MODEL,
  validateReactionText,
  type InferenceResult,
  type ReactionFacts,
} from "@heybit/shared/reaction";
import OpenAI from "openai";

const TIMEOUT_MS = 15_000;

export interface OpenAiCheck {
  api: "PASS" | "FAIL";
  model: "PASS" | "FAIL";
  output: "PASS" | "FAIL";
  validator: "PASS" | "FAIL";
  sample: string | null;
  verdict: "PASS" | "FAIL";
}

export async function requestBitReaction(apiKey: string, facts: ReactionFacts): Promise<InferenceResult> {
  if (apiKey.trim() === "") {
    return { ok: false, transient: false, reason: "unavailable" };
  }
  const client = new OpenAI({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 });
  try {
    const response = await client.responses.create({
      model: BIT_REACTION_MODEL,
      instructions: BIT_PERSONALITY_PROMPT,
      input: JSON.stringify(facts),
      store: false,
      max_output_tokens: 80,
      reasoning: { effort: "none" },
    });
    const text = readOutput(response);
    if (text === "") {
      return { ok: false, transient: false, reason: "empty" };
    }
    return { ok: true, text };
  } catch (error) {
    return classify(error);
  }
}

export async function checkOpenAi(env: NodeJS.ProcessEnv): Promise<OpenAiCheck> {
  const key = env.OPENAI_API_KEY;
  if (typeof key !== "string" || key.trim() === "") {
    return failed();
  }
  const result = await requestBitReaction(key, {
    mode: "INDIVIDUAL",
    type: "BUY",
    solAmount: 0.01,
    activityLevel: "LOW",
  });
  if (!result.ok) {
    return failed();
  }
  const validated = validateReactionText(result.text);
  if (!validated.ok || validated.text.includes(key)) {
    return {
      api: "PASS",
      model: "PASS",
      output: validated.ok ? "PASS" : "FAIL",
      validator: "FAIL",
      sample: null,
      verdict: "FAIL",
    };
  }
  return {
    api: "PASS",
    model: "PASS",
    output: "PASS",
    validator: "PASS",
    sample: validated.text,
    verdict: "PASS",
  };
}

export function formatOpenAiCheck(check: OpenAiCheck): string {
  const lines = [
    "HEYBIT — OPENAI CHECK",
    "",
    `API ................. ${check.api}`,
    `Model ............... ${check.model}`,
    `Output contract ..... ${check.output}`,
    `Content validator ... ${check.validator}`,
    "",
  ];
  if (check.sample) {
    lines.push("Sample reaction:", check.sample, "");
  }
  lines.push(`VERDICT: ${check.verdict}`, "");
  return lines.join("\n");
}

function readOutput(response: { output_text?: string }): string {
  return typeof response.output_text === "string" ? response.output_text.trim() : "";
}

function classify(error: unknown): InferenceResult {
  const status = statusOf(error);
  const name = error instanceof Error ? error.name : "";
  if (status === 429) {
    return { ok: false, transient: true, reason: "rate_limit" };
  }
  if (status === 408 || name.toLowerCase().includes("timeout")) {
    return { ok: false, transient: true, reason: "timeout" };
  }
  if (status >= 500) {
    return { ok: false, transient: true, reason: "unavailable" };
  }
  return { ok: false, transient: false, reason: "unavailable" };
}

function statusOf(error: unknown): number {
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
    return error.status;
  }
  return 0;
}

function failed(): OpenAiCheck {
  return { api: "FAIL", model: "FAIL", output: "FAIL", validator: "FAIL", sample: null, verdict: "FAIL" };
}
