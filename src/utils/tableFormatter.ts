import chalk from 'chalk';

export function formatAwsJson(jsonData: string, title?: string): string {
  try {
    const data = JSON.parse(jsonData);
    let formatted = '';
    
    if (title) {
      formatted += chalk.bold.cyan(`\n📊 ${title}\n`);
      formatted += chalk.dim('─'.repeat(Math.min(80, title.length + 10))) + '\n';
    }
    
    // Handle different AWS service data structures
    if (data.ResultsByTime) {
      // Cost Explorer data
      return formatCostExplorerData(data);
    } else if (data.Functions) {
      // Lambda functions data
      return formatLambdaData(data);
    } else if (data.LogGroups) {
      // CloudWatch logs data
      return formatLogsData(data);
    } else {
      // Generic JSON formatting
      return formatGenericJson(data);
    }
  } catch (error) {
    return chalk.red(`Error parsing JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function formatCostExplorerData(data: any): string {
  let formatted = chalk.bold.cyan('\n💰 AWS Cost Analysis\n');
  formatted += chalk.dim('─'.repeat(50)) + '\n';
  
  if (data.ResultsByTime && data.ResultsByTime.length > 0) {
    for (const result of data.ResultsByTime) {
      const period = `${result.TimePeriod.Start} to ${result.TimePeriod.End}`;
      formatted += chalk.bold.white(`\n📅 Period: ${period}\n`);
      
      if (result.Groups && result.Groups.length > 0) {
        formatted += chalk.bold.white('Service'.padEnd(40)) + chalk.bold.white('Cost (USD)') + '\n';
        formatted += chalk.dim('─'.repeat(60)) + '\n';
        
        // Sort by cost descending
        const sortedGroups = result.Groups.sort((a: any, b: any) => 
          parseFloat(b.Metrics.BlendedCost.Amount) - parseFloat(a.Metrics.BlendedCost.Amount)
        );
        
        for (const group of sortedGroups.slice(0, 20)) {
          const service = group.Keys[0];
          const amount = parseFloat(group.Metrics.BlendedCost.Amount);
          
          let serviceColor = chalk.white;
          if (service.includes('EC2')) serviceColor = chalk.yellow;
          else if (service.includes('VPC')) serviceColor = chalk.blue;
          else if (service.includes('Lambda')) serviceColor = chalk.green;
          
          formatted += serviceColor(service.padEnd(40)) + 
                      chalk.cyan(`$${amount.toFixed(2)}`) + '\n';
        }
      }
    }
  }
  
  return formatted;
}

function formatLambdaData(data: any): string {
  let formatted = chalk.bold.yellow('\n⚡ Lambda Functions\n');
  formatted += chalk.dim('─'.repeat(120)) + '\n';
  
  if (data.Functions && data.Functions.length > 0) {
    formatted += chalk.bold.white('Function Name'.padEnd(30)) + 
                chalk.bold.white('Runtime'.padEnd(12)) + 
                chalk.bold.white('Mem'.padEnd(6)) + 
                chalk.bold.white('Timeout'.padEnd(8)) + 
                chalk.bold.white('Arch'.padEnd(8)) + 
                chalk.bold.white('Created'.padEnd(12)) + 
                chalk.bold.white('Modified') + '\n';
    formatted += chalk.dim('─'.repeat(120)) + '\n';
    
    for (const func of data.Functions.slice(0, 15)) {
      const name = func.FunctionName.length > 27 ? func.FunctionName.substring(0, 27) + '...' : func.FunctionName;
      const arch = func.Architectures ? func.Architectures[0] : 'x86_64';
      const created = new Date(func.LastModified).toISOString().split('T')[0];
      const modified = new Date(func.LastModified).toISOString().split('T')[0];
      
      let runtimeColor = chalk.white;
      if (func.Runtime.includes('python')) runtimeColor = chalk.green;
      else if (func.Runtime.includes('node')) runtimeColor = chalk.yellow;
      
      let archColor = chalk.white;
      if (arch === 'arm64') archColor = chalk.green;
      else archColor = chalk.yellow;
      
      formatted += chalk.cyan(name.padEnd(30)) + 
                  runtimeColor(func.Runtime.padEnd(12)) + 
                  chalk.white(func.MemorySize.toString().padEnd(6)) + 
                  chalk.white(func.Timeout.toString().padEnd(8)) + 
                  archColor(arch.padEnd(8)) + 
                  chalk.dim(created.padEnd(12)) + 
                  chalk.dim(modified) + '\n';
    }
  }
  
  if (data.Metrics && data.Metrics.MetricDataResults) {
    formatted += chalk.bold.yellow('\n📊 Metrics Summary\n');
    formatted += chalk.dim('─'.repeat(30)) + '\n';
    
    for (const metric of data.Metrics.MetricDataResults) {
      formatted += chalk.white(`${metric.Label}: `) + 
                  chalk.cyan(`${metric.Values.length} data points`) + '\n';
    }
  }
  
  return formatted;
}

function formatLogsData(data: any): string {
  let formatted = chalk.bold.blue('\n📋 CloudWatch Log Groups\n');
  formatted += chalk.dim('─'.repeat(50)) + '\n';
  
  if (data.LogGroups && data.LogGroups.length > 0) {
    formatted += chalk.bold.white('Log Group'.padEnd(50)) + 
                chalk.bold.white('Size (bytes)'.padEnd(15)) + 
                chalk.bold.white('Retention') + '\n';
    formatted += chalk.dim('─'.repeat(80)) + '\n';
    
    for (const group of data.LogGroups) {
      const name = group.logGroupName.length > 47 ? group.logGroupName.substring(0, 47) + '...' : group.logGroupName;
      const size = group.storedBytes || 0;
      const retention = group.retentionInDays || 'Never expires';
      
      let sizeColor = chalk.white;
      if (size > 50000000) sizeColor = chalk.red; // > 50MB
      else if (size > 10000000) sizeColor = chalk.yellow; // > 10MB
      else if (size > 0) sizeColor = chalk.green;
      else sizeColor = chalk.dim;
      
      formatted += chalk.cyan(name.padEnd(50)) + 
                  sizeColor(size.toLocaleString().padEnd(15)) + 
                  chalk.white(retention.toString()) + '\n';
    }
  }
  
  if (data.Query) {
    formatted += chalk.bold.blue('\n🔍 Suggested Query\n');
    formatted += chalk.dim('─'.repeat(30)) + '\n';
    formatted += chalk.cyan(data.Query) + '\n';
  }
  
  return formatted;
}

function formatGenericJson(data: any): string {
  return chalk.white(JSON.stringify(data, null, 2));
}

export function formatMultipleTables(content: string): string {
  return formatAwsJson(content);
}