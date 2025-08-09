import { promises as fs } from "node:fs";
import type { AppConfig } from "../config.js";
import { makeOpenAI } from "../providers/openai.js";

/**
 * Analyse a Terraform plan JSON file.  If a plan is provided this
 * implementation reads the file, counts the number of resource changes,
 * and returns a stub summary.  When run in live mode with an OpenAI
 * key this function could be extended to call a language model for
 * richer analysis.
 */
export async function analyzeTf(cfg: AppConfig, opts: Record<string, any>): Promise<string> {
  const planPath = opts.tfPlan || opts["tf-plan"];
  if (!planPath) {
    return "### Terraform\nNo plan provided; skipping detailed TF analysis.";
  }
  let fileContent = "";
  try {
    fileContent = await fs.readFile(planPath, "utf8");
  } catch {
    return `### Terraform\nUnable to read Terraform plan file at ${planPath}.`;
  }
  let planObj: any;
  try {
    planObj = JSON.parse(fileContent);
  } catch {
    return `### Terraform\nInvalid JSON in Terraform plan file ${planPath}.`;
  }
  const resourceChanges = Array.isArray(planObj.resource_changes) ? planObj.resource_changes.length : 0;
  // if openaiKey available, call stub to produce an analysis
  if (cfg.openaiKey) {
    const openai = makeOpenAI(cfg.openaiKey);
    const summary = await openai.ask(
      "You are ai-tf-doctor. Provide a high-level summary of a Terraform plan.",
      `The plan includes ${resourceChanges} resource changes.`
    );
    return `### Terraform\n${summary}`;
  }
  return `### Terraform\nTerraform plan contains ${resourceChanges} resource changes.`;
}