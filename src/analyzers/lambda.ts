import type { AppConfig } from "../config.js";
import { makeOpenAI } from "../providers/openai.js";
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
  
  const message = await openai.ask(
    "You are a Lambda performance optimizer. Analyze the Lambda functions and metrics data. Provide: 1) Functions with performance issues, 2) Memory/timeout optimization recommendations, 3) Cost reduction opportunities. Keep response under 300 words.",
    `${question}\n\nLambda Data:\n${lambdaData}`
  );
  return `### Lambda\n${lambdaData}\n\n${message}`;
}