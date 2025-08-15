# ai-cloud-doctor

AI-powered AWS analysis CLI tool that provides cost optimization, Lambda tuning, log analysis, and Terraform plan reviews using OpenAI.

## Features

- **Cost Analysis**: AWS Cost Explorer integration with AI-powered optimization recommendations
- **Lambda Optimization**: Performance analysis and tuning suggestions for Lambda functions
- **Log Analysis**: CloudWatch logs analysis with natural language queries
- **Terraform Review**: Security and best practices analysis for Terraform plans
- **IAM Analysis**: Users, roles, groups, and policies security assessment
- **Trusted Advisor**: AWS optimization recommendations and best practices
- **Security Hub**: Security findings and compliance analysis
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
# Cost analysis - AWS Cost Explorer integration
ai-cloud-doctor cost --scanPeriod 7                              # Last 7 days cost analysis
ai-cloud-doctor cost --question "Which services cost the most?"   # Custom cost question
ai-cloud-doctor cost --region us-west-2 --scanPeriod 30          # Specific region, 30 days

# Lambda optimization - Performance and cost tuning
ai-cloud-doctor lambda --question "Find timeout issues"           # Identify timeout problems
ai-cloud-doctor lambda --question "Which functions have high memory usage?" # Memory optimization
ai-cloud-doctor lambda --scanPeriod 7 --question "Show cold start problems" # Cold start analysis

# Log analysis - CloudWatch logs with natural language
ai-cloud-doctor logs --question "Show error patterns"             # General error detection
ai-cloud-doctor logs --question "Find API Gateway 5xx errors"     # Specific service errors
ai-cloud-doctor logs --question "Show database connection issues" # Database troubleshooting

# Terraform review - Security and best practices
ai-cloud-doctor tf --tf-plan ./plan.json                         # Basic plan analysis
ai-cloud-doctor tf --tf-plan ./plan.json --question "Focus on security risks" # Security focus
ai-cloud-doctor tf --tf-plan ./plan.json --question "Check IAM permissions"   # IAM validation
ai-cloud-doctor tf --tf-plan ./plan.json --question "Validate network security" # Network security

# IAM analysis - Users, roles, and permissions audit
ai-cloud-doctor iam --question "Find overprivileged users"        # Permission audit
ai-cloud-doctor iam --question "Check for unused roles"           # Cleanup recommendations
ai-cloud-doctor iam --question "Analyze policy attachments"       # Policy analysis

# Trusted Advisor - AWS optimization recommendations
ai-cloud-doctor advisor --question "Focus on cost optimization"   # Cost savings focus
ai-cloud-doctor advisor --question "Show security recommendations" # Security improvements

# Security Hub - Security findings and compliance
ai-cloud-doctor security --question "Show critical findings"      # High-priority issues
ai-cloud-doctor security --question "Check compliance status"     # Compliance monitoring
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

**Cost Analysis:**
- 🔍 **ANALYSIS**: Key findings and patterns
- 📊 **TOP COSTS**: Highest cost services
- 💡 **RECOMMENDATIONS**: Optimization suggestions
- ⚡ **QUICK WINS**: Immediate actions

**Lambda Analysis:**
- ⚠️ **PERFORMANCE ISSUES**: Function optimization needs
- ⚙️ **OPTIMIZATIONS**: Performance improvements
- 💰 **COST SAVINGS**: Resource optimization
- ⚡ **QUICK FIXES**: Immediate improvements

**IAM Analysis:**
- 🚨 **SECURITY RISKS**: Permission vulnerabilities
- 🔑 **ACCESS ISSUES**: User/role problems
- 💡 **RECOMMENDATIONS**: Security improvements
- ⚡ **IMMEDIATE ACTIONS**: Priority fixes

**Security Hub:**
- 🚨 **CRITICAL FINDINGS**: High-priority security issues
- 🔒 **COMPLIANCE ISSUES**: Standards violations
- 🛡️ **SECURITY RECOMMENDATIONS**: Remediation steps
- ⚡ **IMMEDIATE ACTIONS**: Urgent security fixes

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
