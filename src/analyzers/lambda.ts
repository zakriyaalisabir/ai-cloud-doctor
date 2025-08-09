import type { AppConfig } from "../config.js";
import { makeOpenAI } from "../providers/openai.js";
import { logJob } from "../utils/jobTracker.js";
import { execSync } from "node:child_process";

async function getAwsLambdaData(cfg: AppConfig): Promise<string> {
  try {
    const listCmd = `aws lambda list-functions --profile ai-cloud-doctor --output json`;
    const functionsData = JSON.parse(execSync(listCmd, { encoding: 'utf8', timeout: 30000 }));
    
    const endTime = new Date().toISOString();
    const scanDays = cfg.scanPeriod || 30;
    const startTime = new Date(Date.now() - scanDays * 24 * 60 * 60 * 1000).toISOString();
    
    const metricsCmd = `aws cloudwatch get-metric-data --metric-data-queries '[{"Id":"m1","MetricStat":{"Metric":{"Namespace":"AWS/Lambda","MetricName":"Duration"},"Period":86400,"Stat":"Average"},"ReturnData":true},{"Id":"m2","MetricStat":{"Metric":{"Namespace":"AWS/Lambda","MetricName":"Invocations"},"Period":86400,"Stat":"Sum"},"ReturnData":true}]' --start-time ${startTime} --end-time ${endTime} --profile ai-cloud-doctor --output json`;
    const metricsData = JSON.parse(execSync(metricsCmd, { encoding: 'utf8', timeout: 30000 }));
    
    return JSON.stringify({ Functions: functionsData.Functions, Metrics: metricsData }, null, 2);
  } catch (error) {
    return `Error fetching AWS Lambda data: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function analyzeLambda(cfg: AppConfig, live: { live: boolean }, opts: Record<string, any> = {}): Promise<string> {
  if (!live.live) {
    return "### Lambda\nOffline mode: supply logs/metrics export for tuning suggestions.";
  }
  if (!cfg.openaiKey) {
    return "### Lambda\nOpenAI API key missing; cannot perform Lambda analysis.";
  }
  
  const lambdaData = await getAwsLambdaData(cfg);
  const openai = makeOpenAI(cfg.openaiKey, cfg.model, cfg.maxTokens);
  const question = opts.question || "Analyze Lambda functions for performance optimization";
  
  const response = await openai.ask(
    `Analyze this AWS Lambda data and provide optimization insights:\n\n${lambdaData}\n\nReturn your response formatted ONLY in this exact structure for CLI display. \nFollow this markdown layout strictly:\n\n| Section | Details |\n|---------|---------|\n| ⚠️ PERFORMANCE ISSUES | • Issue 1 (FunctionName: description) <br> • Issue 2 (FunctionName: description) |\n| ⚙️ OPTIMIZATIONS | • Step 1 (FunctionName: description) <br> • Step 2 (FunctionName: description) |\n| 💰 COST SAVINGS | • Idea 1 (FunctionName: description) <br> • Idea 2 (FunctionName: description) |\n| ⚡ QUICK FIXES | • Fix 1 (FunctionName: description) <br> • Fix 2 (FunctionName: description) |\n\nRules:\n- Use ONLY the table above.\n- Replace the placeholder bullet points with specific findings.\n- Do not add extra text outside the table.\n- Keep total word count under 400 words.`,
    question
  );
  
  const jobId = await logJob('lambda-analysis', response.inputTokens, response.outputTokens, response.cost, response.model);
  console.log(`\n⚡ Tokens: ${response.inputTokens} in, ${response.outputTokens} out | Job: ${jobId}`);
  
  return `### Lambda\n${lambdaData}\n\n${response.content}`;
}