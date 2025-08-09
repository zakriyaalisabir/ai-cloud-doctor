#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, saveConfig } from "./config.js";
import { ensureAwsLive } from "./detectors/awslive.js";
import { analyzeCost } from "./analyzers/cost.js";
import { analyzeTf } from "./analyzers/tf.js";
import { analyzeLambda } from "./analyzers/lambda.js";
import { analyzeLogs } from "./analyzers/logs.js";
import { formatCostAnalysis, formatLambdaAnalysis, formatLogsAnalysis } from "./utils/formatter.js";
import { formatMultipleTables } from "./utils/tableFormatter.js";
import { getJobLogs } from "./utils/jobTracker.js";

const program = new Command();

// Logger utility
const log = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  error: (msg: string) => console.log(chalk.red('✗'), msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  header: (msg: string) => console.log(chalk.bold.cyan(msg)),
  dim: (msg: string) => console.log(chalk.dim(msg))
};

async function setupAwsProfile(config: any) {
  const { execSync } = await import("node:child_process");
  const profileName = "ai-cloud-doctor";
  
  try {
    log.info(`Setting up AWS CLI profile '${profileName}'...`);
    
    execSync(`aws configure set aws_access_key_id ${config.awsCredentials.accessKeyId} --profile ${profileName}`);
    execSync(`aws configure set aws_secret_access_key ${config.awsCredentials.secretAccessKey} --profile ${profileName}`);
    execSync(`aws configure set region ${config.region} --profile ${profileName}`);
    
    if (config.awsCredentials.sessionToken) {
      execSync(`aws configure set aws_session_token ${config.awsCredentials.sessionToken} --profile ${profileName}`);
    }
    
    log.success(`AWS CLI profile '${profileName}' created successfully.`);
    log.dim(`To use this profile: export AWS_PROFILE=${profileName}`);
    
  } catch (error) {
    log.error(`Failed to setup AWS profile: ${error instanceof Error ? error.message : String(error)}`);
    log.warn('Manual setup - add these to your environment:');
    console.log(`export AWS_ACCESS_KEY_ID=${config.awsCredentials.accessKeyId}`);
    console.log(`export AWS_SECRET_ACCESS_KEY=${config.awsCredentials.secretAccessKey}`);
    console.log(`export AWS_DEFAULT_REGION=${config.region}`);
    if (config.awsCredentials.sessionToken) {
      console.log(`export AWS_SESSION_TOKEN=${config.awsCredentials.sessionToken}`);
    }
  }
}

async function configureCredentials() {
  const existing = await loadConfig();
  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r));
  
  log.header('🔧 Configure ai-cloud-doctor credentials');
  log.dim('Press Enter to keep existing values\n');
  
  const openaiKey = await ask(`OpenAI API Key [${existing.openaiKey ? chalk.green('***') : chalk.red('none')}]: `);
  const model = await ask(`OpenAI Model [${existing.model || 'gpt-5-nano'}]: `);
  const maxTokens = await ask(`Max Tokens [${existing.maxTokens || '500'}]: `);
  const scanPeriod = await ask(`Scan Period (No. of Days) [${existing.scanPeriod || '30'}]: `);
  const region = await ask(`AWS Region [${existing.region || 'us-east-1'}]: `);
  const accessKeyId = await ask(`AWS Access Key ID [${existing.awsCredentials?.accessKeyId ? chalk.green('***') : chalk.red('none')}]: `);
  const secretAccessKey = await ask(`AWS Secret Access Key [${existing.awsCredentials?.secretAccessKey ? chalk.green('***') : chalk.red('none')}]: `);
  const sessionToken = await ask(`AWS Session Token [${existing.awsCredentials?.sessionToken ? chalk.green('***') : chalk.red('none')}]: `);
  const setupProfile = await ask(`Setup AWS CLI profile? (y/n) [n]: `);
  rl.close();
  
  const validateScanPeriod = (period: string | number | undefined): number => {
    const p = typeof period === 'string' ? parseInt(period) : period;
    return [1, 7, 30, 120, 365].includes(p || 0) ? p! : existing.scanPeriod || 30;
  };

  const finalConfig = {
    openaiKey: openaiKey || existing.openaiKey,
    model: model || existing.model,
    maxTokens: maxTokens ? parseInt(maxTokens) : existing.maxTokens,
    scanPeriod: validateScanPeriod(scanPeriod),
    region: region || existing.region || "us-east-1",
    awsCredentials: (accessKeyId || existing.awsCredentials?.accessKeyId) && (secretAccessKey || existing.awsCredentials?.secretAccessKey) ? {
      accessKeyId: accessKeyId || existing.awsCredentials!.accessKeyId,
      secretAccessKey: secretAccessKey || existing.awsCredentials!.secretAccessKey,
      sessionToken: sessionToken || existing.awsCredentials?.sessionToken
    } : undefined
  };
  
  await saveConfig(finalConfig);
  log.success('Configuration saved to ~/.ai-cloud-doctor-configs.json');
  
  if (setupProfile?.toLowerCase() === 'y' && finalConfig.awsCredentials) {
    await setupAwsProfile(finalConfig);
  }
}

// Configure command
program
  .command('configure')
  .description('Configure credentials and API keys')
  .action(configureCredentials);

// Usage command
program
  .command('usage')
  .description('Show OpenAI token usage and job history')
  .action(async () => {
    const jobs = await getJobLogs();
    
    if (jobs.length === 0) {
      log.info('No jobs found');
      return;
    }
    
    log.header('📊 OpenAI Usage History');
    console.log('');
    console.log('Job ID           Name              Model        Date        In     Out    Total   Cost');
    console.log('---------------- ----------------- ------------ ----------- ------ ------ ------- --------');
    
    let totalIn = 0, totalOut = 0, totalCost = 0;
    
    jobs.forEach(job => {
      const date = new Date(job.timestamp).toLocaleDateString();
      const cost = job.cost ? `$${job.cost.toFixed(4)}` : 'N/A';
      const model = job.model || 'unknown';
      console.log(`${job.id.padEnd(16)} ${job.name.padEnd(17)} ${model.padEnd(12)} ${date.padEnd(11)} ${job.inputTokens.toString().padStart(6)} ${job.outputTokens.toString().padStart(6)} ${job.totalTokens.toString().padStart(7)} ${cost.padStart(8)}`);
      
      totalIn += job.inputTokens;
      totalOut += job.outputTokens;
      totalCost += job.cost || 0;
    });
    
    console.log('---------------- ----------------- ------------ ----------- ------ ------ ------- --------');
    console.log(`${'TOTAL'.padEnd(16)} ${' '.padEnd(17)} ${' '.padEnd(12)} ${' '.padEnd(11)} ${totalIn.toString().padStart(6)} ${totalOut.toString().padStart(6)} ${(totalIn + totalOut).toString().padStart(7)} ${'$' + totalCost.toFixed(4).padStart(7)}`);
  });

// Scan command
program
  .command('scan')
  .description('Run all analyzers (cost, tf, lambda, logs)')
  .option('--mode <mode>', 'Analysis mode (auto|live|offline)', 'auto')
  .option('--region <region>', 'AWS region')
  .option('--scanPeriod <days>', 'Analysis period in days (1|7|30|120|365)')
  .action(async (options) => {
    log.header('🔍 Running comprehensive AWS analysis...');
    
    const spinner = ora('Loading configuration...').start();
    const cfg = await loadConfig(options);
    const live = await ensureAwsLive(cfg, options);
    
    spinner.succeed(`Mode: ${live.live ? 'live' : 'offline'} | Scan period: ${cfg.scanPeriod || 30} days`);
    
    const parts: string[] = [];
    
    const tfSpinner = ora('Analyzing Terraform plans...').start();
    parts.push(await analyzeTf(cfg, options));
    tfSpinner.succeed('Terraform analysis complete');
    
    const costSpinner = ora('Analyzing AWS costs...').start();
    parts.push(await analyzeCost(cfg, live, options));
    costSpinner.succeed('Cost analysis complete');
    
    const lambdaSpinner = ora('Analyzing Lambda functions...').start();
    parts.push(await analyzeLambda(cfg, live, options));
    lambdaSpinner.succeed('Lambda analysis complete');
    
    const logsSpinner = ora('Analyzing CloudWatch logs...').start();
    parts.push(await analyzeLogs(cfg, options, live));
    logsSpinner.succeed('Logs analysis complete');
    
    console.log('\n' + parts.filter(Boolean).join('\n\n---\n\n'));
  });

// Cost command
program
  .command('cost')
  .description('Run cost analyzer')
  .option('--mode <mode>', 'Analysis mode (auto|live|offline)', 'auto')
  .option('--region <region>', 'AWS region')
  .option('--scanPeriod <days>', 'Analysis period in days (1|7|30|120|365)')
  .option('--question <text>', 'Custom cost analysis question')
  .action(async (options) => {
    log.header('💰 Analyzing AWS costs...');
    
    const spinner = ora('Loading configuration...').start();
    const cfg = await loadConfig(options);
    const live = await ensureAwsLive(cfg, options);
    
    spinner.text = 'Fetching AWS cost data...';
    const result = await analyzeCost(cfg, live, options);
    spinner.succeed('Cost analysis complete');
    
    console.log(formatCostAnalysis(result));
  });

// Lambda command
program
  .command('lambda')
  .description('Run lambda analyzer')
  .option('--mode <mode>', 'Analysis mode (auto|live|offline)', 'auto')
  .option('--region <region>', 'AWS region')
  .option('--scanPeriod <days>', 'Analysis period in days (1|7|30|120|365)')
  .option('--question <text>', 'Custom Lambda analysis question')
  .action(async (options) => {
    log.header('⚡ Analyzing Lambda functions...');
    
    const spinner = ora('Loading configuration...').start();
    const cfg = await loadConfig(options);
    const live = await ensureAwsLive(cfg, options);
    
    spinner.text = 'Fetching Lambda data and metrics...';
    const result = await analyzeLambda(cfg, live, options);
    spinner.succeed('Lambda analysis complete');
    
    console.log(formatLambdaAnalysis(result));
  });

// Terraform command
program
  .command('tf')
  .description('Run terraform plan analyzer')
  .option('--tf-plan <file>', 'Path to terraform plan JSON file')
  .action(async (options) => {
    log.header('🏗️  Analyzing Terraform plan...');
    
    const cfg = await loadConfig(options);
    const result = await analyzeTf(cfg, options);
    
    // Format Terraform output
    const content = result.replace(/^### Terraform\n/, '');
    const parts = content.split('\n\n');
    const tableData = parts[0];
    const aiAnalysis = parts.slice(1).join('\n\n');
    
    let formatted = formatMultipleTables(tableData);
    if (aiAnalysis) {
      formatted += '\n' + chalk.white(aiAnalysis);
    }
    
    console.log(formatted);
  });

// Logs command
program
  .command('logs')
  .description('Run logs analyzer')
  .option('--mode <mode>', 'Analysis mode (auto|live|offline)', 'auto')
  .option('--region <region>', 'AWS region')
  .option('--scanPeriod <days>', 'Analysis period in days (1|7|30|120|365)')
  .option('--question <text>', 'Natural language question to convert to logs query')
  .action(async (options) => {
    log.header('📋 Analyzing CloudWatch logs...');
    
    const spinner = ora('Loading configuration...').start();
    const cfg = await loadConfig(options);
    const live = await ensureAwsLive(cfg, options);
    
    spinner.text = 'Fetching log groups and building queries...';
    const result = await analyzeLogs(cfg, options, live);
    spinner.succeed('Logs analysis complete');
    
    console.log(formatLogsAnalysis(result));
  });

program
  .name('ai-cloud-doctor')
  .description('AI powered AWS sanity checks for cost, Terraform diffs, Lambda tuning, and logs')
  .version('0.1.0');

program.parse();