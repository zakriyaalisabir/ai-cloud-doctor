import type { AppConfig } from "../config.js";
import { makeOpenAI } from "../providers/openai.js";

/**
 * Perform a cost analysis.  In live mode this function would normally
 * call AWS Cost Explorer to gather service spend and feed it to an
 * OpenAI model for summarisation.  In this offline implementation it
 * either returns a stub response or a message indicating that live
 * analysis is unavailable.
 *
 * @param cfg Loaded configuration
 * @param live Output from ensureAwsLive
 */
export async function analyzeCost(cfg: AppConfig, live: { live: boolean }): Promise<string> {
  if (!live.live) {
    return "### Cost\nNo live AWS credentials; provide a cost report or run with credentials for analysis.";
  }
  // require openai key to use the stub generator
  if (!cfg.openaiKey) {
    return "### Cost\nOpenAI API key missing; cannot perform cost analysis.";
  }
  const openai = makeOpenAI(cfg.openaiKey);
  const message = await openai.ask(
    "You are ai-cost-surgeon. Given cost and usage data, summarise top cost drivers and suggest savings.",
    "Dummy cost data"
  );
  return `### Cost\n${message}`;
}