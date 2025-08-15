import type { AppConfig } from "../config.js";
import { makeOpenAI } from "../providers/openai.js";
import { logJob } from "../utils/jobTracker.js";
import { execSync } from "node:child_process";
import { formatJsonData } from "../utils/tableFormatter.js";

async function getAwsIamData(cfg: AppConfig): Promise<string> {
  try {
    // Get users
    const usersCmd = `aws iam list-users --profile ai-cloud-doctor --output json`;
    const usersData = JSON.parse(execSync(usersCmd, { encoding: 'utf8', timeout: 30000 }));

    // Get roles
    const rolesCmd = `aws iam list-roles --profile ai-cloud-doctor --output json`;
    const rolesData = JSON.parse(execSync(rolesCmd, { encoding: 'utf8', timeout: 30000 }));

    // Get groups
    const groupsCmd = `aws iam list-groups --profile ai-cloud-doctor --output json`;
    const groupsData = JSON.parse(execSync(groupsCmd, { encoding: 'utf8', timeout: 30000 }));

    // Get policies (first 50)
    const policiesCmd = `aws iam list-policies --scope Local --max-items 50 --profile ai-cloud-doctor --output json`;
    const policiesData = JSON.parse(execSync(policiesCmd, { encoding: 'utf8', timeout: 30000 }));

    // Get access analyzer findings if available
    let accessAnalyzerData = {};
    try {
      const analyzersCmd = `aws accessanalyzer list-analyzers --profile ai-cloud-doctor --output json`;
      accessAnalyzerData = JSON.parse(execSync(analyzersCmd, { encoding: 'utf8', timeout: 15000 }));
    } catch {
      // Access Analyzer might not be enabled
    }

    const summary = {
      users: usersData.Users.map((user: any) => ({
        UserName: user.UserName,
        CreateDate: user.CreateDate,
        PasswordLastUsed: user.PasswordLastUsed,
        Tags: user.Tags || []
      })),
      roles: rolesData.Roles.map((role: any) => ({
        RoleName: role.RoleName,
        CreateDate: role.CreateDate,
        AssumeRolePolicyDocument: role.AssumeRolePolicyDocument,
        MaxSessionDuration: role.MaxSessionDuration
      })),
      groups: groupsData.Groups.map((group: any) => ({
        GroupName: group.GroupName,
        CreateDate: group.CreateDate
      })),
      policies: policiesData.Policies.map((policy: any) => ({
        PolicyName: policy.PolicyName,
        CreateDate: policy.CreateDate,
        AttachmentCount: policy.AttachmentCount,
        IsAttachable: policy.IsAttachable
      })),
      accessAnalyzer: accessAnalyzerData
    };

    return JSON.stringify(summary, null, 2);
  } catch (error) {
    return `Error fetching IAM data: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function analyzeIam(cfg: AppConfig, live: { live: boolean }, opts: Record<string, any> = {}): Promise<string> {
  if (!live.live) {
    return "### IAM\nOffline mode: AWS IAM API access required for permissions analysis.";
  }
  if (!cfg.openaiKey) {
    return "### IAM\nOpenAI API key missing; cannot perform IAM analysis.";
  }

  const iamData = await getAwsIamData(cfg);
  const openai = makeOpenAI(cfg);
  const question = opts.question || "Analyze IAM users, roles, and policies for security risks and access optimization";

  const response = await openai.ask(
    `Analyze this AWS IAM data and provide security insights:\n\n${iamData}\n\nReturn your response formatted ONLY in this exact structure for CLI display. \nFollow this markdown layout strictly:\n\n| Section | Details |\n|---------|---------|\n| 🚨 SECURITY RISKS | • Risk 1 (Entity: description) <br> • Risk 2 (Entity: description) |\n| 🔑 ACCESS ISSUES | • Issue 1 (User/Role: description) <br> • Issue 2 (User/Role: description) |\n| 💡 RECOMMENDATIONS | • Rec 1 (Entity: description) <br> • Rec 2 (Entity: description) |\n| ⚡ IMMEDIATE ACTIONS | • Action 1 (Priority: description) <br> • Action 2 (Priority: description) |\n\nRules:\n- Use ONLY the table above.\n- Replace the placeholder bullet points with specific findings.\n- Do not add extra text outside the table.\n- Keep total word count under 400 words.`,
    question
  );

  const jobId = await logJob('iam-analysis', response.inputTokens, response.outputTokens, response.cost, response.model, response.cachedTokens);
  console.log(`\n🔑 Tokens: ${response.inputTokens} in, ${response.outputTokens} out, ${response.cachedTokens} cached | Job: ${jobId}`);

  // Parse and display with improved formatting
  const lines = response.content.split('\n');
  const chalk = (await import('chalk')).default;

  console.log('\n' + chalk.bold.cyan('🔑 IAM Analysis Results'));
  console.log(chalk.gray('─'.repeat(60)));

  lines.forEach(line => {
    if (line.includes('|') && (line.includes('🚨') || line.includes('🔑') || line.includes('💡') || line.includes('⚡'))) {
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
              const color = section.includes('SECURITY RISKS') ? chalk.red :
                section.includes('ACCESS ISSUES') ? chalk.yellow : chalk.white;
              console.log(chalk.yellow('  • ') + color(cleanItem));
            }
          });
        }
      }
    }
  });

  console.log('\n' + chalk.gray('─'.repeat(60)));

  // Display structured IAM data using formatAwsJson
  console.log(formatJsonData(iamData));

  return `### IAM\nAnalysis complete`;
}