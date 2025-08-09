import chalk from 'chalk';
import { formatMultipleTables } from './tableFormatter.js';

export function formatCostAnalysis(rawOutput: string): string {
  const content = rawOutput.replace(/^### Cost\n/, '');
  
  // Split into table data and AI analysis
  const parts = content.split('\n\n');
  const tableData = parts[0];
  const aiAnalysis = parts.slice(1).join('\n\n');
  
  let formatted = formatMultipleTables(tableData);
  
  if (aiAnalysis) {
    formatted += chalk.bold.yellow('\n💡 AI Analysis:\n');
    formatted += chalk.dim('─'.repeat(50)) + '\n';
    formatted += chalk.white(aiAnalysis);
  }
  
  return formatted;
}

export function formatLambdaAnalysis(rawOutput: string): string {
  const content = rawOutput.replace(/^### Lambda\n/, '');
  
  // Split into table data and AI analysis
  const parts = content.split('\n\n');
  const tableData = parts[0];
  const aiAnalysis = parts.slice(1).join('\n\n');
  
  let formatted = formatMultipleTables(tableData);
  
  if (aiAnalysis) {
    formatted += chalk.bold.yellow('\n💡 AI Analysis:\n');
    formatted += chalk.dim('─'.repeat(50)) + '\n';
    formatted += chalk.white(aiAnalysis);
  }
  
  return formatted;
}

export function formatLogsAnalysis(rawOutput: string): string {
  const content = rawOutput.replace(/^### Logs\n/, '');
  
  // Split into table data and AI analysis
  const parts = content.split('\n\n');
  const tableData = parts[0];
  const aiAnalysis = parts.slice(1).join('\n\n');
  
  let formatted = formatMultipleTables(tableData);
  
  if (aiAnalysis) {
    formatted += chalk.bold.yellow('\n💡 AI Analysis:\n');
    formatted += chalk.dim('─'.repeat(50)) + '\n';
    formatted += chalk.white(aiAnalysis);
  }
  
  return formatted;
}