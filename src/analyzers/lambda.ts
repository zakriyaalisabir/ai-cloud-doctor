import type { AppConfig } from "../config.js";
import { makeOpenAI } from "../providers/openai.js";

/**
 * Analyse Lambda functions for performance tuning.  In live mode this
 * function would normally query AWS Lambda and CloudWatch to gather
 * metrics such as duration and error rates.  Here it produces a stub
 * response to illustrate the mechanism.
 */
export async function analyzeLambda(cfg: AppConfig, live: { live: boolean }): Promise<string> {
  if (!live.live) {
    return "### Lambda\nOffline mode: supply logs/metrics export for tuning suggestions.";
  }
  if (!cfg.openaiKey) {
    return "### Lambda\nOpenAI API key missing; cannot perform Lambda analysis.";
  }
  const openai = makeOpenAI(cfg.openaiKey);
  const msg = await openai.ask(
    "You are ai-lambda-optimizer. Provide a stub summary of Lambda performance.",
    "Dummy Lambda metrics"
  );
  return `### Lambda\n${msg}`;
}