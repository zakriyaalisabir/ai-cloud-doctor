# ai-cloud-doctor

`ai-cloud-doctor` is a simple CLI tool that provides basic health checks for AWS accounts and Terraform plans using only built‑in Node.js APIs.  It avoids third party dependencies so it can run in restricted or offline environments.

The tool does **not** make any changes to your AWS infrastructure; instead it reads configuration and credentials from a local JSON file (`~/.ai-cloud-doctor-configs.json`) or environment variables.  It then outputs recommendations or stub analyses.

## Installation

Clone the repository and run:

```bash
cd ai-cloud-doctor
npm install
npm run build
npm link  # optional, to install globally as `ai-cloud-doctor`
```

After linking, you can invoke the CLI with `ai-cloud-doctor`.

## Configuration

To avoid reentering credentials every run, store your OpenAI and AWS credentials in a JSON file in your home directory:

```json
{
  "openaiKey": "sk-your-openai-key",
  "region": "us-east-1",
  "awsCredentials": {
    "accessKeyId": "AKIA...",
    "secretAccessKey": "....",
    "sessionToken": "..."
  }
}
```

Save this file as `~/.ai-cloud-doctor-configs.json`.  The CLI will read this file automatically.  You can also override any value via environment variables (`OPENAI_API_KEY`, `AWS_ACCESS_KEY_ID`, etc.) or command line flags.

## Usage

### Full scan

Run all checks (cost, terraform, lambda, logs) in auto mode:

```bash
ai-cloud-doctor scan --mode auto
```

### Terraform plan doctor

Explain risks in a Terraform plan (stub implementation):

```bash
ai-cloud-doctor tf --tf-plan ./plan.json
```

### Cost analysis (stub)

```bash
ai-cloud-doctor cost
```

### Lambda tuning (stub)

```bash
ai-cloud-doctor lambda
```

### Natural‑language log query (stub)

```bash
ai-cloud-doctor logs --question "Top functions by timeout errors in last hour"
```

### Offline mode

Use `--mode offline` to prevent any attempt to access AWS services.  This is the default when no AWS credentials are available.

## Development

This project is written in TypeScript and compiled to ES modules in the `dist` directory.

To run the unit tests:

```bash
npm test
```

Tests use Node.js built‑in test runner (`node --test`) and target the compiled output.