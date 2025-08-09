import type { AppConfig } from "../config.js";
import { makeOpenAI } from "../providers/openai.js";

/**
 * Analyse logs based on a natural language question.  Offline mode
 * constructs a simple CloudWatch Logs Insights query without
 * contacting AWS; live mode would normally execute the query and
 * summarise the results.  In this stub implementation we either
 * return a proposed query or a generic placeholder.
 */
export async function analyzeLogs(cfg: AppConfig, opts: Record<string, any>, live: { live: boolean }): Promise<string> {
  // determine the user's question
  const question = opts.question || opts.q || "top timeouts in last 1h by function";
  // simple helper to craft a query from a question
  function buildQuery(q: string): string {
    const sanitized = q.replace(/[\n\r]/g, " ").replace(/\s+/g, " ").trim();
    // very basic heuristic: search for all messages containing the question text
    return `fields @timestamp, @message\n| filter @message like /${sanitized.replace(/\//g, "\\/")}/\n| stats count() by bin(60s)`;
  }
  if (!live.live) {
    const query = buildQuery(question);
    return [
      "### Logs",
      "**Proposed Logs Insights query:**",
      "```",
      query,
      "```",
      "_Offline mode: run this query in CloudWatch Logs Insights or provide a logs export for analysis._"
    ].join("\n");
  }
  // live mode requires OpenAI key for summary stub
  if (!cfg.openaiKey) {
    return "### Logs\nOpenAI API key missing; cannot perform logs analysis.";
  }
  const openai = makeOpenAI(cfg.openaiKey);
  const summary = await openai.ask(
    "You are ai-log-copilot. Summarise CloudWatch Logs queries.",
    `User question: ${question}`
  );
  return `### Logs\n${summary}`;
}