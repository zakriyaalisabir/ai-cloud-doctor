import assert from 'node:assert/strict';

import { loadConfig } from '../src/config.js';
import { makeOpenAI } from '../src/providers/openai.js';
import { ensureAwsLive } from '../src/detectors/awslive.js';
import { analyzeCost } from '../src/analyzers/cost.js';
import { analyzeLambda } from '../src/analyzers/lambda.js';

// Note: tests run against the TypeScript source and compiled down to the dist
// directory.  When run via `npm test`, tsc compiles the source and test
// files into the dist folder, and Node's built‑in test runner executes
// the compiled test.

// Reset environment before each test
const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    delete (process.env as any)[key];
  }
  for (const key of Object.keys(ORIGINAL_ENV)) {
    (process.env as any)[key] = ORIGINAL_ENV[key];
  }
}

// Test loadConfig prefers environment variables over file
export async function testLoadConfigEnv() {
  resetEnv();
  process.env.OPENAI_API_KEY = 'sk-test-123';
  process.env.AWS_REGION = 'us-west-2';
  process.env.AWS_ACCESS_KEY_ID = 'AKIATEST';
  process.env.AWS_SECRET_ACCESS_KEY = 'SECRETTEST';
  const cfg = await loadConfig({});
  assert.equal(cfg.openaiKey, 'sk-test-123');
  assert.equal(cfg.region, 'us-west-2');
  assert.ok(cfg.awsCredentials);
  assert.equal(cfg.awsCredentials?.accessKeyId, 'AKIATEST');
  assert.equal(cfg.awsCredentials?.secretAccessKey, 'SECRETTEST');
}

// Test makeOpenAI throws when no key
export async function testMakeOpenAIThrows() {
  resetEnv();
  assert.throws(() => {
    makeOpenAI(undefined);
  });
}

// Test ensureAwsLive respects offline mode
export async function testEnsureAwsLive() {
  resetEnv();
  const cfg = await loadConfig({ mode: 'offline' });
  const live = await ensureAwsLive(cfg, { mode: 'offline' });
  assert.equal(live.live, false);
}

// Test analyzeCost offline returns correct message
export async function testAnalyzeCostOffline() {
  resetEnv();
  const cfg = await loadConfig({ mode: 'offline' });
  const res = await analyzeCost(cfg, { live: false });
  assert.ok(res.includes('No live AWS credentials'));
}

// Test analyzeLambda offline returns correct message
export async function testAnalyzeLambdaOffline() {
  resetEnv();
  const cfg = await loadConfig({ mode: 'offline' });
  const res = await analyzeLambda(cfg, { live: false });
  assert.ok(res.includes('Offline mode'));
}