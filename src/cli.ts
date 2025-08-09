import { loadConfig, saveConfig } from "./config.js";
import { ensureAwsLive } from "./detectors/awslive.js";
import { analyzeCost } from "./analyzers/cost.js";
import { analyzeTf } from "./analyzers/tf.js";
import { analyzeLambda } from "./analyzers/lambda.js";
import { analyzeLogs } from "./analyzers/logs.js";

/**
 * Very minimal command line parser.  It supports flags of the form
 * `--flag value` or `--flag=value`.  Positional arguments are collected into
 * the `commands` array on the returned object.
 */
function parseArgs(argv: string[]) {
  const args: { command: string; opts: Record<string, any> } = { command: "", opts: {} };
  const positional: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        const key = arg.slice(2, eq);
        const val = arg.slice(eq + 1);
        args.opts[key] = val;
        i++;
      } else {
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith("-")) {
          args.opts[key] = next;
          i += 2;
        } else {
          args.opts[key] = true;
          i++;
        }
      }
    } else if (arg.startsWith("-")) {
      // short flags not supported; treat as boolean true
      const key = arg.slice(1);
      args.opts[key] = true;
      i++;
    } else {
      positional.push(arg);
      i++;
    }
  }
  args.command = positional.shift() || "";
  return args;
}

async function run() {
  const { command, opts } = parseArgs(process.argv.slice(2));
  if (!command || command === "help" || opts.help) {
    console.log(`Usage: ai-cloud-doctor <command> [options]

Commands:
  configure Configure credentials and API keys
  scan      Run all analyzers (cost, tf, lambda, logs)
  cost      Run cost analyzer
  tf        Run terraform plan analyzer
  lambda    Run lambda analyzer
  logs      Run logs analyzer

Global options:
  --mode <auto|live|offline>   Analysis mode (default: auto)
  --region <AWS region>        Override default region

Command-specific options:
  tf:    --tf-plan <file>      Path to terraform plan JSON file
  logs:  --question <text>     Natural language question to convert to logs query

Example:
  ai-cloud-doctor scan --mode auto
`);
    return;
  }
  if (command === "configure") {
    await configureCredentials();
    return;
  }
  const cfg = await loadConfig(opts);
  const live = await ensureAwsLive(cfg, opts);
  let result = "";
  switch (command) {
    case "scan": {
      const parts: string[] = [];
      parts.push(await analyzeTf(cfg, opts));
      parts.push(await analyzeCost(cfg, live));
      parts.push(await analyzeLambda(cfg, live));
      parts.push(await analyzeLogs(cfg, opts, live));
      result = parts.filter(Boolean).join("\n\n---\n\n");
      break;
    }
    case "cost": {
      result = await analyzeCost(cfg, live);
      break;
    }
    case "tf": {
      result = await analyzeTf(cfg, opts);
      break;
    }
    case "lambda": {
      result = await analyzeLambda(cfg, live);
      break;
    }
    case "logs": {
      result = await analyzeLogs(cfg, opts, live);
      break;
    }
    default: {
      console.error(`Unknown command: ${command}`);
      process.exit(1);
    }
  }
  if (result) {
    console.log(result);
  }
}

async function configureCredentials() {
  const readline = await import("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const ask = (question: string): Promise<string> => 
    new Promise(resolve => rl.question(question, resolve));
  
  console.log("Configure ai-cloud-doctor credentials:\n");
  
  const openaiKey = await ask("OpenAI API Key (sk-...): ");
  const region = await ask("AWS Region (us-east-1): ") || "us-east-1";
  const accessKeyId = await ask("AWS Access Key ID: ");
  const secretAccessKey = await ask("AWS Secret Access Key: ");
  const sessionToken = await ask("AWS Session Token (optional): ");
  
  rl.close();
  
  const config = {
    openaiKey: openaiKey || undefined,
    region,
    awsCredentials: accessKeyId && secretAccessKey ? {
      accessKeyId,
      secretAccessKey,
      sessionToken: sessionToken || undefined
    } : undefined
  };
  
  await saveConfig(config);
  console.log("\nConfiguration saved to ~/.ai-cloud-doctor-configs.json");
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});