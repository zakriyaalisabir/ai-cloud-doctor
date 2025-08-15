import type { AppConfig } from "../config.js";
import { makeOpenAI } from "../providers/openai.js";
import { logJob } from "../utils/jobTracker.js";
import { execSync } from "node:child_process";
import { formatJsonData } from "../utils/tableFormatter.js";

async function getAwsLogsData(cfg: AppConfig, question: string): Promise<string> {
  try {
    // Get log groups
    const logGroupsCmd = `aws logs describe-log-groups --limit 10 --profile ai-cloud-doctor --output json`;
    const logGroupsData = JSON.parse(execSync(logGroupsCmd, { encoding: 'utf8', timeout: 30000 }));

    // Build query based on question
    function buildQuery(q: string): string {
      const sanitized = q.toLowerCase();
      if (sanitized.includes('error')) {
        return 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 100';
      } else if (sanitized.includes('timeout')) {
        return 'fields @timestamp, @message | filter @message like /timeout/i | sort @timestamp desc | limit 100';
      } else {
        return `fields @timestamp, @message | filter @message like /${q.replace(/[\\\/.]/g, '')}/i | sort @timestamp desc | limit 100`;
      }
    }

    const query = buildQuery(question);

    return JSON.stringify({ LogGroups: logGroupsData.logGroups, Query: query }, null, 2);
  } catch (error) {
    return `Error fetching AWS logs data: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function analyzeLogs(cfg: AppConfig, opts: Record<string, any>, live: { live: boolean }): Promise<string> {
  const question = opts.question || opts.q || "recent errors";

  if (!live.live) {
    function buildQuery(q: string): string {
      const sanitized = q.replace(/[\n\r]/g, " ").replace(/\s+/g, " ").trim();
      return `fields @timestamp, @message\n| filter @message like /${sanitized.replace(/\//g, "\\/")}/\n| stats count() by bin(60s)`;
    }
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

  if (!cfg.openaiKey) {
    return "### Logs\nOpenAI API key missing; cannot perform logs analysis.";
  }

  const logsData = await getAwsLogsData(cfg, question);
  const openai = makeOpenAI(cfg);

  const response = await openai.ask(
    `Analyze this AWS logs data and provide insights:\n\n${logsData}\n\nReturn your response formatted ONLY in this exact structure for CLI display. \nFollow this markdown layout strictly:\n\n| Section | Details |\n|---------|---------|\n| 🔍 KEY PATTERNS | • Pattern 1 (LogGroup: description) <br> • Pattern 2 (LogGroup: description) |\n| 📈 ERROR TRENDS | • Trend 1 (LogGroup: description) <br> • Trend 2 (LogGroup: description) |\n| 💡 ACTIONABLE INSIGHTS | • Insight 1 (LogGroup: description) <br> • Insight 2 (LogGroup: description) |\n| ⚙️ RECOMMENDATIONS | • Rec 1 (LogGroup: description) <br> • Rec 2 (LogGroup: description) |\n\nRules:\n- Use ONLY the table above.\n- Replace the placeholder bullet points with specific findings.\n- Do not add extra text outside the table.\n- Keep total word count under 400 words.`,
    `Question: ${question}`
  );

  const jobId = await logJob('logs-analysis', response.inputTokens, response.outputTokens, response.cost, response.model, response.cachedTokens);
  console.log(`\n📈 Tokens: ${response.inputTokens} in, ${response.outputTokens} out | Job: ${jobId}`);

  // Parse and display with improved formatting
  const lines = response.content.split('\n');
  const chalk = (await import('chalk')).default;

  console.log('\n' + chalk.bold.cyan('📈 Logs Analysis Results'));
  console.log(chalk.gray('─'.repeat(60)));

  lines.forEach(line => {
    if (line.includes('|') && (line.includes('🔍') || line.includes('📈') || line.includes('💡') || line.includes('⚙️'))) {
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

  // Display structured AWS CW Logs data using formatJsonData
  console.log(formatJsonData(logsData));

  return `### Logs\nAnalysis complete`;
}