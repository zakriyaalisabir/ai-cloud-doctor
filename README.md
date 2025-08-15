# ai-cloud-doctor

AI-powered AWS analysis CLI tool that provides cost optimization, Lambda tuning, log analysis, and Terraform plan reviews using OpenAI.

## Features

- **Cost Analysis**: AWS Cost Explorer integration with AI-powered optimization recommendations
- **Lambda Optimization**: Performance analysis and tuning suggestions for Lambda functions
- **Log Analysis**: CloudWatch logs analysis with natural language queries
- **Terraform Review**: Security and best practices analysis for Terraform plans
- **Token Tracking**: Complete OpenAI usage tracking with separate input/output/cached token costs
- **Job History**: Detailed logs of all analysis jobs with unique IDs

## Installation

### Option 1: Install from npm (Recommended)
```bash
npm install -g ai-cloud-doctor
```

### Option 2: Install from source
```bash
git clone https://github.com/your-repo/ai-cloud-doctor
cd ai-cloud-doctor
npm install
npm run build
npm link  # Install globally as 'ai-cloud-doctor'
```

## Configuration

Configure credentials and settings:

```bash
ai-cloud-doctor configure
```

Or manually create `~/.ai-cloud-doctor-configs.json`:

```json
{
  "openaiKey": "sk-your-openai-key",
  "model": "gpt-5-nano",
  "serviceTier": "flex",
  "maxTokens": 10000,
  "inputTokenCost": 0.15,
  "outputTokenCost": 0.6,
  "cachedTokenCost": 0.075,
  "reasoningEffort": "low",
  "temperature": 1.0,
  "verbosity": "low",
  "scanPeriod": 30,
  "region": "us-east-1",
  "awsCredentials": {
    "accessKeyId": "AKIA...",
    "secretAccessKey": "...",
    "sessionToken": "..."
  }
}
```

## Usage

### Full Analysis

```bash
ai-cloud-doctor scan --mode auto
```

### Individual Analyzers

```bash
# Cost analysis
ai-cloud-doctor cost --scanPeriod 7

# Lambda optimization
ai-cloud-doctor lambda --question "Find timeout issues"

# Log analysis
ai-cloud-doctor logs --question "Show error patterns"

# Terraform review
ai-cloud-doctor tf --tf-plan ./plan.json
```

### Token Usage Tracking

```bash
ai-cloud-doctor usage
```

Shows detailed job history with separate token costs:

```
Job ID   Name              Model        Date        In     Out    Cached Total   Cost
-------- ----------------- ------------ ----------- ------ ------ ------ ------- --------
a1b2c3d4 cost-analysis     gpt-5-nano   1/15/2024     150     75      0     225  $0.0004
```

## Output Format

All AI analysis uses structured sections:

- 🔍 **ANALYSIS**: Key findings and patterns
- 📊 **TOP COSTS**: Highest cost services
- 💡 **RECOMMENDATIONS**: Optimization suggestions
- ⚡ **QUICK WINS**: Immediate actions

## Files

- `~/.ai-cloud-doctor-configs.json` - Configuration and credentials
- `~/.ai-cloud-doctor-jobs.json` - Job execution logs and token usage

## Modes

- **auto**: Use AWS credentials if available, offline otherwise
- **live**: Force AWS API calls (requires credentials)
- **offline**: Skip AWS calls, provide stub analysis

## Scan Periods

- 1, 7, 30, 120, 365 days for cost and performance analysis

## Requirements

- Node.js 18+
- AWS CLI configured (for live mode)
- OpenAI API key
- AWS credentials (for live analysis)

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request
