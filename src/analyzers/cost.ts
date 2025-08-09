import type { AppConfig } from "../config.js";
import { makeOpenAI } from "../providers/openai.js";
import { promises as fs } from "node:fs";
import { execSync } from "node:child_process";

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
async function getAwsCostData(cfg: AppConfig): Promise<string> {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const scanDays = cfg.scanPeriod || 30;
    const startDate = new Date(Date.now() - scanDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const cmd = `aws ce get-cost-and-usage --time-period Start=${startDate},End=${endDate} --granularity MONTHLY --metrics BlendedCost --group-by Type=DIMENSION,Key=SERVICE --profile ai-cloud-doctor --output json`;
    
    if (cfg.region) {
      process.env.AWS_DEFAULT_REGION = cfg.region;
    }
    
    const result = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    const data = JSON.parse(result);
    
    return JSON.stringify(data, null, 2);
  } catch (error) {
    return `Error fetching AWS cost data: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function analyzeCost(cfg: AppConfig, live: { live: boolean }, opts: Record<string, any> = {}): Promise<string> {
  if (!live.live) {
    return "### Cost\nNo live AWS credentials; provide a cost report or run with credentials for analysis.";
  }
  if (!cfg.openaiKey) {
    return "### Cost\nOpenAI API key missing; cannot perform cost analysis.";
  }
  
  const costData = await getAwsCostData(cfg);
  const openai = makeOpenAI(cfg.openaiKey, cfg.model, cfg.maxTokens);
  const question = opts.question || "Analyze this AWS cost data and suggest specific savings opportunities";
  
  const message = await openai.ask(
    "You are a concise AWS cost analyzer. Analyze the cost data and provide: 1) Top spending services summary, 2) Cost trends, 3) Key recommendations. Keep response under 300 words.",
    `${question}\n\nAWS Cost Data:\n${costData}`
  );
  return `### Cost\n${costData}\n\n${message}`;
}