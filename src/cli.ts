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
import { analyzeTrustedAdvisor } from "./analyzers/trustedadvisor.js";
import { analyzeSecurityHub } from "./analyzers/securityhub.js";
import { analyzeIam } from "./analyzers/iam.js";
import { getJobLogs } from "./utils/jobTracker.js";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagePath = __dirname.includes('dist') ? path.join(__dirname, '../../package.json') : path.join(__dirname, '../package.json');
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));

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
  const serviceTier = await ask(`Service Tier [${existing.serviceTier || 'flex'}]: `);
  const maxTokens = await ask(`Max Tokens [${existing.maxTokens || '500'}]: `);
  const inputTokenCost = await ask(`Input token cost per 1M [${existing.inputTokenCost || '0.15'}]: `);
  const outputTokenCost = await ask(`Output token cost per 1M [${existing.outputTokenCost || '0.6'}]: `);
  const cachedTokenCost = await ask(`Cached token cost per 1M [${existing.cachedTokenCost || '0.075'}]: `);
  const reasoningEffort = await ask(`Reasoning Effort [${existing.reasoningEffort || 'low'}]: `);
  const temperature = await ask(`Temperature [${existing.temperature || '1.0'}]: `);
  const verbosity = await ask(`Verbosity [${existing.verbosity || 'low'}]: `);
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
    inputTokenCost: inputTokenCost ? parseFloat(inputTokenCost) : existing.inputTokenCost || 0.15,
    outputTokenCost: outputTokenCost ? parseFloat(outputTokenCost) : existing.outputTokenCost || 0.6,
    cachedTokenCost: cachedTokenCost ? parseFloat(cachedTokenCost) : existing.cachedTokenCost || 0.075,
    serviceTier: serviceTier || existing.serviceTier || 'auto',
    reasoningEffort: reasoningEffort || existing.reasoningEffort || 'low',
    temperature: temperature ? parseFloat(temperature) : existing.temperature || 0.7,
    verbosity: verbosity || existing.verbosity || 'low',
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
    console.table(jobs.map(job => ({
      'Job ID': job.id.substring(0, 8),
      'Name': job.name,
      'Model': job.model || 'unknown',
      'Date': new Date(job.timestamp).toLocaleDateString(),
      'In': job.inputTokens,
      'Out': job.outputTokens,
      'Cached': job.cachedTokens || 0,
      'Total': job.totalTokens,
      'Cost': job.cost ? `$${job.cost.toFixed(4)}` : 'N/A'
    })));

    const totalIn = jobs.reduce((sum, job) => sum + job.inputTokens, 0);
    const totalOut = jobs.reduce((sum, job) => sum + job.outputTokens, 0);
    const totalCost = jobs.reduce((sum, job) => sum + (job.cost || 0), 0);

    console.log(`\n${chalk.bold('TOTAL:')} ${chalk.cyan(totalIn + totalOut)} tokens (${chalk.green(totalIn)} in, ${chalk.yellow(totalOut)} out) - ${chalk.red('$' + totalCost.toFixed(4))}`);
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

    const tfSpinner = ora('Analyzing Terraform plans...').start();
    await analyzeTf(cfg, options);
    tfSpinner.succeed('Terraform analysis complete');

    const costSpinner = ora('Analyzing AWS costs...').start();
    await analyzeCost(cfg, live, options);
    costSpinner.succeed('Cost analysis complete');

    const lambdaSpinner = ora('Analyzing Lambda functions...').start();
    await analyzeLambda(cfg, live, options);
    lambdaSpinner.succeed('Lambda analysis complete');

    const logsSpinner = ora('Analyzing CloudWatch logs...').start();
    await analyzeLogs(cfg, options, live);
    logsSpinner.succeed('Logs analysis complete');

    const advisorSpinner = ora('Analyzing Trusted Advisor...').start();
    await analyzeTrustedAdvisor(cfg, live, options);
    advisorSpinner.succeed('Trusted Advisor analysis complete');

    const securitySpinner = ora('Analyzing Security Hub...').start();
    await analyzeSecurityHub(cfg, live, options);
    securitySpinner.succeed('Security Hub analysis complete');

    const iamSpinner = ora('Analyzing IAM permissions...').start();
    await analyzeIam(cfg, live, options);
    iamSpinner.succeed('IAM analysis complete');
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
    await analyzeCost(cfg, live, options);
    spinner.succeed('Cost analysis complete');
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
    await analyzeLambda(cfg, live, options);
    spinner.succeed('Lambda analysis complete');
  });

// Terraform command
program
  .command('tf')
  .description('Run terraform plan analyzer')
  .option('--tf-plan <file>', 'Path to terraform plan JSON file')
  .option('--question <text>', 'Custom Terraform analysis question')
  .action(async (options) => {
    log.header('🏗️  Analyzing Terraform plan...');

    const spinner = ora('Loading configuration...').start();
    const cfg = await loadConfig(options);

    spinner.text = 'Analyzing TF plan...';
    await analyzeTf(cfg, options);
    spinner.succeed('TF plan analysis complete');
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
    await analyzeLogs(cfg, options, live);
    spinner.succeed('Logs analysis complete');
  });

// Trusted Advisor command
program
  .command('advisor')
  .description('Run Trusted Advisor analyzer')
  .option('--mode <mode>', 'Analysis mode (auto|live|offline)', 'auto')
  .option('--region <region>', 'AWS region')
  .option('--question <text>', 'Custom Trusted Advisor analysis question')
  .action(async (options) => {
    log.header('🛡️ Analyzing Trusted Advisor...');

    const spinner = ora('Loading configuration...').start();
    const cfg = await loadConfig(options);
    const live = await ensureAwsLive(cfg, options);

    spinner.text = 'Fetching Trusted Advisor checks...';
    await analyzeTrustedAdvisor(cfg, live, options);
    spinner.succeed('Trusted Advisor analysis complete');
  });

// Security Hub command
program
  .command('security')
  .description('Run Security Hub analyzer')
  .option('--mode <mode>', 'Analysis mode (auto|live|offline)', 'auto')
  .option('--region <region>', 'AWS region')
  .option('--question <text>', 'Custom Security Hub analysis question')
  .action(async (options) => {
    log.header('🔒 Analyzing Security Hub...');

    const spinner = ora('Loading configuration...').start();
    const cfg = await loadConfig(options);
    const live = await ensureAwsLive(cfg, options);

    spinner.text = 'Fetching Security Hub findings...';
    await analyzeSecurityHub(cfg, live, options);
    spinner.succeed('Security Hub analysis complete');
  });

// IAM command
program
  .command('iam')
  .description('Run IAM permissions analyzer')
  .option('--mode <mode>', 'Analysis mode (auto|live|offline)', 'auto')
  .option('--region <region>', 'AWS region')
  .option('--question <text>', 'Custom IAM analysis question')
  .action(async (options) => {
    log.header('🔑 Analyzing IAM permissions...');

    const spinner = ora('Loading configuration...').start();
    const cfg = await loadConfig(options);
    const live = await ensureAwsLive(cfg, options);

    spinner.text = 'Fetching IAM users, roles, and policies...';
    await analyzeIam(cfg, live, options);
    spinner.succeed('IAM analysis complete');
  });

program
  .name('ai-cloud-doctor')
  .description('AI powered AWS sanity checks for cost, Terraform diffs, Lambda tuning, and logs')
  .version(pkg.version);

program.parse();