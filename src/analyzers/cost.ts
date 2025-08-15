import type { AppConfig } from "../config.js";
import { makeOpenAI } from "../providers/openai.js";
import { logJob } from "../utils/jobTracker.js";
import { execSync } from "node:child_process";
import { formatJsonData } from "../utils/tableFormatter.js";

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
  const openai = makeOpenAI(cfg);
  const question = opts.question || "Analyze this AWS cost data and suggest specific savings opportunities";

  const response = await openai.ask(
    `Analyze this AWS cost data and provide insights:\n\n${costData}\n\nReturn your response formatted ONLY in this exact structure for CLI display. \nFollow this markdown layout strictly:\n\n| Section | Details |\n|---------|---------|\n| 🔍 ANALYSIS | • Finding 1 (Service: description) <br> • Finding 2 (Service: description) |\n| 📊 TOP COSTS | • Cost 1 (Service: $amount description) <br> • Cost 2 (Service: $amount description) |\n| 💡 RECOMMENDATIONS | • Rec 1 (Service: description) <br> • Rec 2 (Service: description) |\n| ⚡ QUICK WINS | • Win 1 (Service: description) <br> • Win 2 (Service: description) |\n\nRules:\n- Use ONLY the table above.\n- Replace the placeholder bullet points with specific findings.\n- Do not add extra text outside the table.\n- Keep total word count under 400 words.`,
    question
  );

  const jobId = await logJob('cost-analysis', response.inputTokens, response.outputTokens, response.cost, response.model, response.cachedTokens);
  console.log(`\n📊 Tokens: ${response.inputTokens} in, ${response.outputTokens} out, ${response.cachedTokens} cached | Job: ${jobId}`);

  // Parse and display with improved formatting
  const lines = response.content.split('\n');
  const chalk = (await import('chalk')).default;

  console.log('\n' + chalk.bold.cyan('💰 Cost Analysis Results'));
  console.log(chalk.gray('─'.repeat(60)));

  lines.forEach(line => {
    if (line.includes('|') && (line.includes('🔍') || line.includes('📊') || line.includes('💡') || line.includes('⚡'))) {
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

  // Display structured AWS cost data using formatJsonData
  console.log(formatJsonData(costData));

  return `### Cost\nAnalysis complete`;
}