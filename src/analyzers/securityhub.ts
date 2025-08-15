import type { AppConfig } from "../config.js";
import { makeOpenAI } from "../providers/openai.js";
import { logJob } from "../utils/jobTracker.js";
import { execSync } from "node:child_process";
import { formatJsonData } from "../utils/tableFormatter.js";

async function getAwsSecurityHubData(cfg: AppConfig): Promise<string> {
  try {
    // Get Security Hub findings
    const findingsCmd = `aws securityhub get-findings --max-results 50 --profile ai-cloud-doctor --output json`;
    const findingsData = JSON.parse(execSync(findingsCmd, { encoding: 'utf8', timeout: 30000 }));
    
    // Get compliance summary
    const complianceCmd = `aws configservice get-compliance-summary-by-config-rule --profile ai-cloud-doctor --output json`;
    let complianceData = {};
    try {
      complianceData = JSON.parse(execSync(complianceCmd, { encoding: 'utf8', timeout: 15000 }));
    } catch {
      // Compliance summary might not be available in all regions
    }
    
    // Summarize findings by severity and type
    const summary = {
      findings: findingsData.Findings.map((finding: any) => ({
        Id: finding.Id,
        Title: finding.Title,
        Severity: finding.Severity?.Label || 'UNKNOWN',
        ComplianceStatus: finding.Compliance?.Status || 'UNKNOWN',
        ResourceType: finding.Resources?.[0]?.Type || 'UNKNOWN',
        Description: finding.Description
      })),
      compliance: complianceData
    };
    
    return JSON.stringify(summary, null, 2);
  } catch (error) {
    return `Error fetching Security Hub data: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function analyzeSecurityHub(cfg: AppConfig, live: { live: boolean }, opts: Record<string, any> = {}): Promise<string> {
  if (!live.live) {
    return "### Security Hub\nOffline mode: AWS Security Hub API access required for security analysis.";
  }
  if (!cfg.openaiKey) {
    return "### Security Hub\nOpenAI API key missing; cannot perform Security Hub analysis.";
  }
  
  const securityData = await getAwsSecurityHubData(cfg);
  const openai = makeOpenAI(cfg);
  const question = opts.question || "Analyze Security Hub findings for critical security issues and compliance gaps";
  
  const response = await openai.ask(
    `Analyze this AWS Security Hub data and provide security insights:\n\n${securityData}\n\nReturn your response formatted ONLY in this exact structure for CLI display. \nFollow this markdown layout strictly:\n\n| Section | Details |\n|---------|---------|\n| 🚨 CRITICAL FINDINGS | • Finding 1 (Severity: description) <br> • Finding 2 (Severity: description) |\n| 🔒 COMPLIANCE ISSUES | • Issue 1 (Standard: description) <br> • Issue 2 (Standard: description) |\n| 🛡️ SECURITY RECOMMENDATIONS | • Rec 1 (Resource: description) <br> • Rec 2 (Resource: description) |\n| ⚡ IMMEDIATE ACTIONS | • Action 1 (Priority: description) <br> • Action 2 (Priority: description) |\n\nRules:\n- Use ONLY the table above.\n- Replace the placeholder bullet points with specific findings.\n- Do not add extra text outside the table.\n- Keep total word count under 400 words.`,
    question
  );
  
  const jobId = await logJob('securityhub-analysis', response.inputTokens, response.outputTokens, response.cost, response.model, response.cachedTokens);
  console.log(`\n🔒 Tokens: ${response.inputTokens} in, ${response.outputTokens} out | Job: ${jobId}`);
  
  // Parse and display with improved formatting
  const lines = response.content.split('\n');
  const chalk = (await import('chalk')).default;
  
  console.log('\n' + chalk.bold.cyan('🔒 Security Hub Analysis Results'));
  console.log(chalk.gray('─'.repeat(60)));
  
  lines.forEach(line => {
    if (line.includes('|') && (line.includes('🚨') || line.includes('🔒') || line.includes('🛡️') || line.includes('⚡'))) {
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
              const color = section.includes('CRITICAL') ? chalk.red : 
                           section.includes('COMPLIANCE') ? chalk.yellow : chalk.white;
              console.log(chalk.yellow('  • ') + color(cleanItem));
            }
          });
        }
      }
    }
  });
  
  console.log('\n' + chalk.gray('─'.repeat(60)));

  // Display structured Security Hub data using formatJsonData
  console.log(formatJsonData(securityData));
  
  return `### Security Hub\nAnalysis complete`;
}