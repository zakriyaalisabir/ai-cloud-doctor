import type { AppConfig } from "../config.js";

/**
 * Determines whether the tool should operate in live mode based on the
 * provided configuration and command line options.  In live mode the
 * analyzers would normally attempt to query AWS APIs; in offline mode
 * they will avoid any external calls.
 *
 * @param cfg Loaded configuration
 * @param cli Raw CLI options (may include `mode`)
 * @returns An object with a `live` boolean property
 * @throws If `--mode=live` is requested but no AWS credentials are present
 */
export async function ensureAwsLive(cfg: AppConfig, cli: Record<string, any>): Promise<{ live: boolean }> {
  // explicit mode from CLI
  const requestedMode = (cli.mode || "auto").toString();
  if (requestedMode === "offline") {
    return { live: false };
  }
  if (requestedMode === "live") {
    if (cfg.awsCredentials) {
      return { live: true };
    }
    throw new Error("AWS credentials not found but --mode=live requested.");
  }
  // auto mode: decide based on credentials presence
  if (cfg.awsCredentials) {
    return { live: true };
  }
  return { live: false };
}