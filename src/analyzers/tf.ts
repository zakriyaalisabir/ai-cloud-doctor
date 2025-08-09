import { promises as fs } from "node:fs";
import type { AppConfig } from "../config.js";
import { makeOpenAI } from "../providers/openai.js";
import { logJob } from "../utils/jobTracker.js";

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
  // Extract structured data from Terraform plan
  const resourceChanges = Array.isArray(planObj.resource_changes) ? planObj.resource_changes : [];
  const planData = {
    ResourceChanges: resourceChanges.map((change: any) => ({
      Address: change.address || 'unknown',
      Type: change.type || 'unknown',
      Action: Array.isArray(change.change?.actions) ? change.change.actions.join(',') : 'no-op',
      Provider: change.provider_name || 'unknown'
    })),
    Summary: {
      TotalChanges: resourceChanges.length,
      Actions: resourceChanges.reduce((acc: any, change: any) => {
        const actions = change.change?.actions || ['no-op'];
        actions.forEach((action: string) => {
          acc[action] = (acc[action] || 0) + 1;
        });
        return acc;
      }, {})
    }
  };
  
  const structuredData = JSON.stringify(planData, null, 2);
  
  // if openaiKey available, call AI for analysis
  if (cfg.openaiKey) {
    const openai = makeOpenAI(cfg.openaiKey, cfg.model, cfg.maxTokens);
    const response = await openai.ask(
      `Analyze this Terraform plan data and provide insights:\n\n${structuredData}\n\nReturn your response formatted ONLY in this exact structure for CLI display. \nFollow this markdown layout strictly:\n\n| Section | Details |\n|---------|---------|\n| ⚠️ RISK ASSESSMENT | • Risk 1 (Resource: description) <br> • Risk 2 (Resource: description) |\n| 📊 RESOURCE IMPACT | • Impact 1 (Resource: description) <br> • Impact 2 (Resource: description) |\n| 💡 RECOMMENDATIONS | • Rec 1 (Resource: description) <br> • Rec 2 (Resource: description) |\n| ⚙️ BEST PRACTICES | • Practice 1 (Resource: description) <br> • Practice 2 (Resource: description) |\n\nRules:\n- Use ONLY the table above.\n- Replace the placeholder bullet points with specific findings.\n- Do not add extra text outside the table.\n- Keep total word count under 400 words.`,
      "Analyze this Terraform plan for risks and recommendations"
    );
    
    const jobId = await logJob('terraform-analysis', response.inputTokens, response.outputTokens, response.cost, response.model);
    console.log(`\n🛠️ Tokens: ${response.inputTokens} in, ${response.outputTokens} out | Job: ${jobId}`);
    
    return `### Terraform\n${structuredData}\n\n${response.content}`;
  }
  return `### Terraform\n${structuredData}`;
}