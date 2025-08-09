import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface JobLog {
  id: string;
  name: string;
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost?: number;
  model?: string;
}

/**
 * Configuration object returned by loadConfig.
 */
export interface AppConfig {
  /** OpenAI API key, if configured */
  openaiKey?: string;
  /** OpenAI model to use */
  model?: string;
  /** Maximum tokens for OpenAI responses */
  maxTokens?: number;
  /** Scan/analysis period in days */
  scanPeriod?: number;
  /** AWS default region */
  region?: string;
  /** AWS credentials; if present the tool will attempt to run in live mode */
  awsCredentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
  /** Analysis mode derived from CLI (--mode) */
  offline?: boolean;
}

/** Path to the persistent configuration file.  Credentials and other settings
 * are stored here to avoid repeatedly prompting the user.  The file is
 * created in the user's home directory if it does not already exist.
 */
const CONFIG_FILENAME = ".ai-cloud-doctor-configs.json";

/** Load configuration by merging values from the persistent file,
 * environment variables, and command line options.  If credentials
 * are present in environment variables but not in the file, they are
 * persisted to the file automatically so subsequent runs don't require
 * them to be set again.
 */
export async function loadConfig(cli: Record<string, any> = {}): Promise<AppConfig> {
  const home = os.homedir() || process.env.HOME || process.env.USERPROFILE || ".";
  const cfgPath = path.join(home, CONFIG_FILENAME);
  let fileCfg: Partial<AppConfig> = {};
  try {
    const contents = await fs.readFile(cfgPath, "utf8");
    fileCfg = JSON.parse(contents);
  } catch {
    // file might not exist or be malformed; ignore for now
    fileCfg = {};
  }

  // read from environment
  const envOpenAI = process.env.OPENAI_API_KEY;
  const envRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  const envAwsAccess = process.env.AWS_ACCESS_KEY_ID;
  const envAwsSecret = process.env.AWS_SECRET_ACCESS_KEY;
  const envAwsToken = process.env.AWS_SESSION_TOKEN;

  // start building configuration
  const cfg: AppConfig = {};

  // openaiKey: CLI option overrides env and file
  if (cli.openaiKey) {
    cfg.openaiKey = String(cli.openaiKey);
  } else if (envOpenAI) {
    cfg.openaiKey = envOpenAI;
  } else if (fileCfg.openaiKey) {
    cfg.openaiKey = fileCfg.openaiKey;
  }

  // model: CLI overrides file
  if (cli.model) {
    cfg.model = String(cli.model);
  } else if (fileCfg.model) {
    cfg.model = fileCfg.model;
  }

  // maxTokens: CLI overrides file
  if (cli.maxTokens) {
    cfg.maxTokens = parseInt(String(cli.maxTokens));
  } else if (fileCfg.maxTokens) {
    cfg.maxTokens = fileCfg.maxTokens;
  }

  // scanPeriod: CLI overrides file, validate allowed values
  if (cli.scanPeriod) {
    const period = parseInt(String(cli.scanPeriod));
    if ([1, 7, 30, 120, 365].includes(period)) {
      cfg.scanPeriod = period;
    }
  } else if (fileCfg.scanPeriod) {
    cfg.scanPeriod = fileCfg.scanPeriod;
  }

  // region: CLI overrides env and file
  if (cli.region) {
    cfg.region = String(cli.region);
  } else if (envRegion) {
    cfg.region = envRegion;
  } else if (fileCfg.region) {
    cfg.region = fileCfg.region;
  }

  // AWS credentials: prefer CLI?  environment variables, then file
  let awsCreds: AppConfig["awsCredentials"] | undefined;
  if (envAwsAccess && envAwsSecret) {
    awsCreds = {
      accessKeyId: envAwsAccess,
      secretAccessKey: envAwsSecret,
      sessionToken: envAwsToken,
    };
  } else if (fileCfg.awsCredentials) {
    awsCreds = fileCfg.awsCredentials;
  }

  // offline mode: CLI option --mode overrides everything
  const mode = (cli.mode || "auto").toString();
  if (mode === "offline") {
    cfg.offline = true;
  } else if (mode === "live") {
    cfg.offline = false;
  } else {
    // auto: offline true if no credentials present
    cfg.offline = !awsCreds;
  }

  if (awsCreds) {
    cfg.awsCredentials = awsCreds;
  }

  // persist credentials and settings to config file if they didn't exist
  const toPersist: Partial<AppConfig> = { ...fileCfg };
  let needsWrite = false;
  // store openai key
  if (cfg.openaiKey && !fileCfg.openaiKey) {
    toPersist.openaiKey = cfg.openaiKey;
    needsWrite = true;
  }
  // store region
  if (cfg.region && !fileCfg.region) {
    toPersist.region = cfg.region;
    needsWrite = true;
  }
  // store AWS credentials
  if (awsCreds && !fileCfg.awsCredentials) {
    toPersist.awsCredentials = awsCreds;
    needsWrite = true;
  }
  if (needsWrite) {
    try {
      await fs.writeFile(cfgPath, JSON.stringify(toPersist, null, 2), { encoding: "utf8", mode: 0o600 });
    } catch {
      // ignore write errors
    }
  }

  return cfg;
}

/** Save configuration to the persistent file */
export async function saveConfig(config: Partial<AppConfig>): Promise<void> {
  const home = os.homedir() || process.env.HOME || process.env.USERPROFILE || ".";
  const cfgPath = path.join(home, CONFIG_FILENAME);
  await fs.writeFile(cfgPath, JSON.stringify(config, null, 2), { encoding: "utf8", mode: 0o600 });
}