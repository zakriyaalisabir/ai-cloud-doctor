import { JobLog } from "../config.js";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const JOBS_FILENAME = ".ai-cloud-doctor-jobs.json";

export function generateJobId(): string {
  return randomBytes(8).toString('hex');
}

export async function logJob(jobName: string, inputTokens: number, outputTokens: number, cost?: number, model?: string): Promise<string> {
  const jobId = generateJobId();
  
  const job: JobLog = {
    id: jobId,
    name: jobName,
    timestamp: new Date().toISOString(),
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cost: cost || calculateCost(inputTokens, outputTokens),
    model
  };
  
  const jobs = await getJobLogs();
  jobs.push(job);
  
  const home = os.homedir() || process.env.HOME || process.env.USERPROFILE || ".";
  const jobsPath = path.join(home, JOBS_FILENAME);
  await fs.writeFile(jobsPath, JSON.stringify(jobs, null, 2), { encoding: "utf8", mode: 0o600 });
  
  return jobId;
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  // GPT-3.5-turbo pricing: $0.0015/1K input, $0.002/1K output
  const inputCost = (inputTokens / 1000) * 0.0015;
  const outputCost = (outputTokens / 1000) * 0.002;
  return inputCost + outputCost;
}

export async function getJobLogs(): Promise<JobLog[]> {
  const home = os.homedir() || process.env.HOME || process.env.USERPROFILE || ".";
  const jobsPath = path.join(home, JOBS_FILENAME);
  
  try {
    const contents = await fs.readFile(jobsPath, "utf8");
    return JSON.parse(contents);
  } catch {
    return [];
  }
}