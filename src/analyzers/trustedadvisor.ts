import type { AppConfig } from "../config.js";
import { makeOpenAI } from "../providers/openai.js";
import { logJob } from "../utils/jobTracker.js";
import { execSync } from "node:child_process";
import { formatJsonData } from "../utils/tableFormatter.js";

async function getAwsTrustedAdvisorData(cfg: AppConfig): Promise<string> {
  try {
    const checksCmd = `aws support describe-trusted-advisor-checks --language en --profile ai-cloud-doctor --output json`;
    const checksData = JSON.parse(execSync(checksCmd, { encoding: 'utf8', timeout: 30000 }));

    // Get check results for top categories
    const checkResults = [];
    const topChecks = checksData.checks.slice(0, 10);

    for (const check of topChecks) {
      try {
        const resultCmd = `aws support describe-trusted-advisor-check-result --check-id ${check.id} --language en --profile ai-cloud-doctor --output json`;
        const result = JSON.parse(execSync(resultCmd, { encoding: 'utf8', timeout: 15000 }));
        checkResults.push({
          name: check.name,
          category: check.category,
          status: result.result.status,
          resourcesSummary: result.result.resourcesSummary
        });
      } catch (error) {
        // Skip checks that fail (might require Business/Enterprise support)
        continue;
      }
    }

    return JSON.stringify({ checks: checkResults }, null, 2);
  } catch (error) {
    return `Error fetching Trusted Advisor data: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function analyzeTrustedAdvisor(cfg: AppConfig, live: { live: boolean }, opts: Record<string, any> = {}): Promise<string> {
  if (!live.live) {
    return "### Trusted Advisor\nOffline mode: AWS Support API access required for Trusted Advisor analysis.";
  }
  if (!cfg.openaiKey) {
    return "### Trusted Advisor\nOpenAI API key missing; cannot perform Trusted Advisor analysis.";
  }

  const advisorData = await getAwsTrustedAdvisorData(cfg);
  const openai = makeOpenAI(cfg);
  const question = opts.question || "Analyze Trusted Advisor recommendations for optimization opportunities";

  const response = await openai.ask(
    `Analyze this AWS Trusted Advisor data and provide insights:\n\n${advisorData}\n\nReturn your response formatted ONLY in this exact structure for CLI display. \nFollow this markdown layout strictly:\n\n| Section | Details |\n|---------|---------|\n| 🔍 KEY FINDINGS | • Finding 1 (Check: description) <br> • Finding 2 (Check: description) |\n| ⚠️ CRITICAL ISSUES | • Issue 1 (Check: description) <br> • Issue 2 (Check: description) |\n| 💡 RECOMMENDATIONS | • Rec 1 (Check: description) <br> • Rec 2 (Check: description) |\n| ⚡ QUICK ACTIONS | • Action 1 (Check: description) <br> • Action 2 (Check: description) |\n\nRules:\n- Use ONLY the table above.\n- Replace the placeholder bullet points with specific findings.\n- Do not add extra text outside the table.\n- Keep total word count under 400 words.`,
    question
  );

  const jobId = await logJob('trustedadvisor-analysis', response.inputTokens, response.outputTokens, response.cost, response.model, response.cachedTokens);
  console.log(`\n🔑 Tokens: ${response.inputTokens} in, ${response.outputTokens} out, ${response.cachedTokens} cached | Job: ${jobId}`);

  // Parse and display with improved formatting
  const lines = response.content.split('\n');
  const chalk = (await import('chalk')).default;

  console.log('\n' + chalk.bold.cyan('🛡️ Trusted Advisor Analysis Results'));
  console.log(chalk.gray('─'.repeat(60)));

  lines.forEach(line => {
    if (line.includes('|') && (line.includes('🔍') || line.includes('⚠️') || line.includes('💡') || line.includes('⚡'))) {
      const parts = line.split('|');
      if (parts.length >= 3) {
        const section = parts[1].trim();
        const details = parts[2].replace(/<br>/g, '\n').replace(/• /g, '').trim();
        if (details && details !== 'Details') {
          console.log('\n' + chalk.bold.white(section));

          const items = details.split('\n').filter(item => item.trim());
          items.forEach(item => {
            const cleanItem = item.trim();
            if (cleanItem) {
              console.log(chalk.yellow('  • ') + chalk.white(cleanItem));
            }
          });
        }
      }
    }
  });

  console.log('\n' + chalk.gray('─'.repeat(60)));

  // Display structured Trusted Advisor data using formatJsonData
  console.log(formatJsonData(advisorData));

  return `### Trusted Advisor\nAnalysis complete`;
}