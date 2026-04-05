#!/usr/bin/env node
import path from 'path';
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';

import { ConversionOptions, ConversionResult } from './types';
import { exists } from './utils/fs';
import { createLogger } from './utils/logger';
import { scanProject, formatScanSummary } from './scanner/scanner';
import { askConversionOptions } from './cli/prompts';
import { convertAgents } from './converters/agents';
import { convertCommands } from './converters/commands';
import { convertSkills } from './converters/skills';
import { convertClaudeMd } from './converters/claude-md';
import { convertMcpAndSettings } from './converters/mcp';
import { convertRules } from './converters/rules';
import { convertHooks } from './converters/hooks';
import { generateReport } from './report/reporter';

const program = new Command();

program
  .name('claude-to-opencode')
  .description('Convert a Claude Code project to OpenCode format')
  .version('1.0.0')
  .requiredOption('-i, --input <path>', 'Path to the Claude Code project root')
  .requiredOption('-o, --output <path>', 'Path to the output OpenCode project directory')
  .option(
    '-p, --provider <provider>',
    'LLM provider for model alias mapping (anthropic|openai|google)',
  )
  .option(
    '-u, --unsupported <strategy>',
    'How to handle unsupported content (copy-and-report|report-only)',
  )
  .option('--dry-run', 'Preview changes without writing any files', false)
  .option('--verbose', 'Print detailed conversion logs', false)
  .option('-y, --yes', 'Skip interactive prompts, use defaults', false)
  .option(
    '--only <items>',
    'Comma-separated list of items to convert (agents,commands,skills,claude-md,mcp,rules,hooks)',
  );

program.parse(process.argv);

const cliOpts = program.opts();

async function main() {
  const inputPath = path.resolve(cliOpts['input'] as string);
  const outputPath = path.resolve(cliOpts['output'] as string);
  const dryRun = cliOpts['dryRun'] as boolean;
  const verbose = cliOpts['verbose'] as boolean;
  const skipPrompts = cliOpts['yes'] as boolean;
  const onlyFilter = cliOpts['only']
    ? (cliOpts['only'] as string).split(',').map((s: string) => s.trim())
    : null;

  const log = createLogger(verbose, dryRun);

  log.section('claude-to-opencode');
  if (dryRun) {
    console.log(chalk.yellow('  DRY RUN — no files will be written\n'));
  }

  // ── Validate input ──────────────────────────────────────────────────────────
  if (!(await exists(inputPath))) {
    console.error(chalk.red(`\nError: Input path does not exist: ${inputPath}`));
    process.exit(1);
  }

  // ── Scan project ────────────────────────────────────────────────────────────
  const scanSpinner = ora('Scanning project...').start();
  const scan = await scanProject(inputPath);
  scanSpinner.succeed('Scan complete');

  console.log('');
  console.log(formatScanSummary(scan));
  console.log('');

  if (!scan.hasClaudeDir) {
    console.error(
      chalk.red(
        'No .claude/ directory found — this does not appear to be a Claude Code project.',
      ),
    );
    process.exit(1);
  }

  // ── Interactive prompts (unless --yes) ─────────────────────────────────────
  let provider = (cliOpts['provider'] as string | undefined) ?? undefined;
  let unsupportedStrategy = (cliOpts['unsupported'] as string | undefined) ?? undefined;

  const outputExists = await exists(outputPath);

  if (skipPrompts) {
    provider = provider ?? 'anthropic';
    unsupportedStrategy = unsupportedStrategy ?? 'copy-and-report';
    if (outputExists) {
      log.info('Output directory exists — overwriting (--yes flag set)');
    }
  } else {
    const answers = await askConversionOptions(
      { inputPath, outputPath, dryRun, verbose },
      outputExists,
    );

    if (!answers.confirmOverwrite) {
      console.log(chalk.yellow('\nAborted.'));
      process.exit(0);
    }

    provider = provider ?? answers.provider;
    unsupportedStrategy = unsupportedStrategy ?? answers.unsupportedStrategy;
  }

  // ── Build final options ─────────────────────────────────────────────────────
  const options: ConversionOptions = {
    inputPath,
    outputPath,
    provider: (provider ?? 'anthropic') as ConversionOptions['provider'],
    unsupportedStrategy: (unsupportedStrategy ??
      'copy-and-report') as ConversionOptions['unsupportedStrategy'],
    dryRun,
    verbose,
  };

  // ── Run converters ──────────────────────────────────────────────────────────
  const result: ConversionResult = {
    agentsConverted: 0,
    commandsConverted: 0,
    skillsConverted: 0,
    claudeMdInlined: 0,
    mcpServersConverted: 0,
    permissionsConverted: 0,
    unsupportedFiles: [],
    warnings: [],
    errors: [],
  };

  const should = (name: string) => !onlyFilter || onlyFilter.includes(name);

  // MCP + settings → opencode.json
  if (should('mcp')) {
    const spinner = ora('Converting MCP servers and permissions...').start();
    try {
      await convertMcpAndSettings(scan, options, result, log);
      spinner.succeed(`MCP/settings → opencode.json`);
    } catch (e) {
      spinner.fail('MCP/settings conversion failed');
      result.errors.push(`mcp: ${String(e)}`);
    }
  }

  // Agents
  if (should('agents') && scan.agents.length > 0) {
    const spinner = ora(`Converting ${scan.agents.length} agents...`).start();
    try {
      await convertAgents(scan, options, result);
      spinner.succeed(`Agents: ${result.agentsConverted} converted`);
    } catch (e) {
      spinner.fail('Agents conversion failed');
      result.errors.push(`agents: ${String(e)}`);
    }
  }

  // Commands
  if (should('commands') && scan.commands.length > 0) {
    const spinner = ora(`Converting ${scan.commands.length} commands...`).start();
    try {
      await convertCommands(scan, options, result, log);
      spinner.succeed(`Commands: ${result.commandsConverted} converted`);
    } catch (e) {
      spinner.fail('Commands conversion failed');
      result.errors.push(`commands: ${String(e)}`);
    }
  }

  // Skills
  if (should('skills') && scan.skills.length > 0) {
    const spinner = ora(`Converting ${scan.skills.length} skills...`).start();
    try {
      await convertSkills(scan, options, result, log);
      spinner.succeed(`Skills: ${result.skillsConverted} converted`);
    } catch (e) {
      spinner.fail('Skills conversion failed');
      result.errors.push(`skills: ${String(e)}`);
    }
  }

  // CLAUDE.md
  if (should('claude-md') && scan.hasClaudeMd) {
    const spinner = ora('Converting CLAUDE.md (inlining @includes)...').start();
    try {
      await convertClaudeMd(scan, options, result, log);
      spinner.succeed(
        `CLAUDE.md converted (${result.claudeMdInlined} @includes inlined)`,
      );
    } catch (e) {
      spinner.fail('CLAUDE.md conversion failed');
      result.errors.push(`claude-md: ${String(e)}`);
    }
  }

  // Rules
  if (should('rules') && scan.rules.length > 0) {
    const spinner = ora(`Processing ${scan.rules.length} rules...`).start();
    try {
      await convertRules(scan, options, result, log);
      const unsupported = result.unsupportedFiles.filter(f => f.type === 'rule').length;
      spinner.succeed(`Rules: ${unsupported} flagged as unsupported`);
    } catch (e) {
      spinner.fail('Rules processing failed');
      result.errors.push(`rules: ${String(e)}`);
    }
  }

  // Hooks
  if (should('hooks') && scan.hooks.length > 0) {
    const spinner = ora(`Processing ${scan.hooks.length} hooks...`).start();
    try {
      await convertHooks(scan, options, result, log);
      const unsupported = result.unsupportedFiles.filter(f => f.type === 'hook').length;
      spinner.succeed(`Hooks: ${unsupported} flagged as unsupported`);
    } catch (e) {
      spinner.fail('Hooks processing failed');
      result.errors.push(`hooks: ${String(e)}`);
    }
  }

  // ── Generate report ─────────────────────────────────────────────────────────
  {
    const spinner = ora('Generating MIGRATION-REPORT.md...').start();
    try {
      await generateReport(result, inputPath, outputPath, dryRun);
      spinner.succeed('MIGRATION-REPORT.md written');
    } catch (e) {
      spinner.fail('Report generation failed');
      result.errors.push(`report: ${String(e)}`);
    }
  }

  // ── Final summary ───────────────────────────────────────────────────────────
  console.log('');
  console.log(chalk.bold('─────────────────────────────────────────'));
  console.log(chalk.bold('  Conversion Summary'));
  console.log(chalk.bold('─────────────────────────────────────────'));

  const line = (label: string, value: number | string) => {
    console.log(`  ${chalk.dim(label.padEnd(30))} ${value}`);
  };

  line('Agents converted:', result.agentsConverted);
  line('Commands converted:', result.commandsConverted);
  line('Skills converted:', result.skillsConverted);
  line('CLAUDE.md @includes inlined:', result.claudeMdInlined);
  line('MCP servers:', result.mcpServersConverted);
  line('Permission rules:', result.permissionsConverted);

  if (result.unsupportedFiles.length > 0) {
    line('Unsupported (manual):', chalk.yellow(String(result.unsupportedFiles.length)));
  }

  if (result.warnings.length > 0) {
    line('Warnings:', chalk.yellow(String(result.warnings.length)));
    if (verbose) {
      for (const w of result.warnings) {
        console.log(chalk.yellow(`    ⚠  ${w}`));
      }
    }
  }

  if (result.errors.length > 0) {
    line('Errors:', chalk.red(String(result.errors.length)));
    for (const e of result.errors) {
      console.log(chalk.red(`    ✗  ${e}`));
    }
  }

  console.log('');

  if (dryRun) {
    console.log(chalk.yellow('  Dry run — no files were written.'));
  } else {
    console.log(
      chalk.green(`  Output: ${outputPath}`),
    );
    if (result.unsupportedFiles.length > 0) {
      console.log(
        chalk.dim(`  Unsupported files: ${outputPath}/_unsupported/`),
      );
    }
    console.log(chalk.dim(`  Report: ${outputPath}/MIGRATION-REPORT.md`));
  }

  console.log('');

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(chalk.red('\nFatal error:'), err);
  process.exit(1);
});
