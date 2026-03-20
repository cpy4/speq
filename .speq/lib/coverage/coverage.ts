#!/usr/bin/env node

import * as fs from 'fs';
import { exec } from 'child_process';
import { analyze, analyzeLinearIssues } from './analyzer.js';
import { renderTerminal } from './renderer/terminal.js';
import { renderHtml } from './renderer/html.js';
import type { CoverageOptions } from './types.js';

function parseArgs(): CoverageOptions {
  const args = process.argv.slice(2);
  const options: CoverageOptions = {
    gapsOnly: false,
    verbose: false,
    html: false,
    output: undefined,
    linear: false,
    linearTeam: undefined
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--html':
      case '-h':
        options.html = true;
        break;
      case '--gaps-only':
      case '-g':
        options.gapsOnly = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--linear':
        options.linear = true;
        break;
      case '--linear-team':
        options.linearTeam = args[++i];
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }
  
  return options;
}

function printHelp(): void {
  console.log(`
speq coverage - Analyze spec coverage

Usage: speq coverage [options]

Options:
  --html, -h           Generate HTML report
  --gaps-only, -g      Show only gaps
  --verbose, -v        Show detailed gap information
  --output, -o <path>  Output file path (for HTML)
  --linear             Include Linear issue coverage
  --linear-team <key> Filter Linear issues by team key
  --help              Show this help message
`.trim());
}

function openInBrowser(filePath: string): void {
  const fullPath = `file://${filePath}`;
  console.log(`Open in browser: ${fullPath}`);
  
  let command: string;
  switch (process.platform) {
    case 'darwin':
      command = `open "${fullPath}"`;
      break;
    case 'win32':
      command = `start "" "${fullPath}"`;
      break;
    default:
      command = `xdg-open "${fullPath}"`;
  }
  
  try {
    exec(command);
  } catch {
    console.log(`(Could not auto-open browser. Open manually: ${fullPath})`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs();
  const report = analyze();
  
  if (!report) {
    process.exit(1);
  }
  
  if (options.linear) {
    const linearReport = await analyzeLinearIssues(options.linearTeam);
    if (linearReport) {
      report.linearCoverage = linearReport;
    }
  }
  
  if (options.html) {
    const html = renderHtml(report);
    const outputPath = options.output || 'speq-coverage.html';
    
    fs.writeFileSync(outputPath, html);
    console.log(`HTML report written to: ${outputPath}`);
    openInBrowser(outputPath);
  } else {
    const output = renderTerminal(report, options);
    console.log(output);
  }
  
  process.exit(0);
}

main();
