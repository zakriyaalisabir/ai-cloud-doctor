# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2025-01-10

### Added
- Improved analysis output formatting with clean section display
- Enhanced lambda analyzer with better table parsing
- Colored token usage summary in usage command
- Better error handling and user feedback

### Changed
- Lambda analysis results now display in readable format instead of raw markdown
- Usage command shows colored totals for better visibility
- Improved configure command flow and parameter ordering

### Fixed
- Lambda analyzer table parsing for better readability
- Console output formatting across all analyzers

## [0.2.0] - 2025-01-10

### Added
- Separate token cost tracking for input, output, and cached tokens
- Configurable OpenAI parameters: service tier, reasoning effort, temperature, verbosity
- Enhanced configure command with logical parameter grouping
- Cached token extraction from OpenAI API responses
- Improved cost calculation accuracy with per-token-type pricing

### Changed
- Configure command now prompts in logical order (API key, model, service tier, etc.)
- Token cost configuration moved from per-1K to per-1M tokens for easier pricing
- Job logs now stored in separate `~/.ai-cloud-doctor-jobs.json` file
- Usage table includes cached tokens column

### Fixed
- OpenAI provider now uses all configured parameters
- Cost calculation uses actual token type pricing instead of flat rate

## [0.1.0] - 2025-01-08

### Added
- Initial release of AI Cloud Doctor CLI
- Cost analysis with AWS Cost Explorer integration
- Lambda function optimization analysis
- CloudWatch logs analysis with natural language queries
- Terraform plan security and best practices review
- OpenAI token usage tracking and job history
- Multiple analysis modes: auto, live, offline
- Configurable scan periods: 1, 7, 30, 120, 365 days
- AWS CLI profile setup automation
- Comprehensive configuration management

### Features
- **Cost Analyzer**: Identifies top costs and optimization opportunities
- **Lambda Analyzer**: Performance tuning and cold start optimization
- **Logs Analyzer**: Error pattern detection and log insights
- **Terraform Analyzer**: Security risks and best practices validation
- **Token Tracker**: Complete OpenAI usage monitoring with cost breakdown
- **Job History**: Detailed execution logs with unique job IDs