import path from 'path';
import { ScanResult } from '../types';
import { exists, listFiles, listDirs, readFile } from '../utils/fs';

/**
 * Scan a Claude Code project root and return an inventory of what's present.
 */
export async function scanProject(projectPath: string): Promise<ScanResult> {
  const p = (rel: string) => path.join(projectPath, rel);

  const result: ScanResult = {
    projectPath,
    hasClaudeDir: false,
    agents: [],
    commands: [],
    skills: [],
    rules: [],
    hooks: [],
    hasMcpJson: false,
    hasSettingsJson: false,
    hasClaudeMd: false,
    claudeMdIncludes: [],
  };

  // Top-level checks
  result.hasClaudeDir = await exists(p('.claude'));
  result.hasMcpJson = await exists(p('.mcp.json'));
  result.hasClaudeMd = await exists(p('CLAUDE.md'));
  result.hasSettingsJson = await exists(p('.claude/settings.json'));

  // Agents
  const agentFiles = await listFiles(p('.claude/agents'), /\.md$/i);
  result.agents = agentFiles.map(f => path.relative(projectPath, f));

  // Commands
  const commandFiles = await listFiles(p('.claude/commands'), /\.md$/i);
  result.commands = commandFiles
    .filter(f => !path.basename(f).toLowerCase().startsWith('readme'))
    .map(f => path.relative(projectPath, f));

  // Skills — each skill is a SKILL.md in a subdirectory
  const skillDirs = await listDirs(p('.claude/skills'));
  for (const dir of skillDirs) {
    const skillFile = path.join(dir, 'SKILL.md');
    if (await exists(skillFile)) {
      result.skills.push(path.relative(projectPath, skillFile));
    }
  }

  // Rules
  const ruleFiles = await listFiles(p('.claude/rules'), /\.md$/i);
  result.rules = ruleFiles.map(f => path.relative(projectPath, f));

  // Hooks
  const hookFiles = await listFiles(p('.claude/hooks'), /\.(sh|py|js|ts)$/i);
  result.hooks = hookFiles.map(f => path.relative(projectPath, f));

  // CLAUDE.md @include references
  if (result.hasClaudeMd) {
    const content = await readFile(p('CLAUDE.md'));
    if (content) {
      result.claudeMdIncludes = extractIncludes(content);
    }
  }

  return result;
}

/**
 * Extract all @filepath include references from CLAUDE.md content.
 * Matches lines like: @.claude/docs/coding-standards.md
 */
export function extractIncludes(content: string): string[] {
  const includes: string[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Match @path at start of line (not inside code blocks)
    const match = trimmed.match(/^@(\.claude\/[^\s]+|[^\s]+\.(md|txt|json))$/);
    if (match) {
      includes.push(match[1]);
    }
  }
  return [...new Set(includes)]; // deduplicate
}

/**
 * Print a human-readable summary of the scan result.
 */
export function formatScanSummary(scan: ScanResult): string {
  const lines: string[] = [];

  lines.push(`Project: ${scan.projectPath}`);
  lines.push('');

  if (!scan.hasClaudeDir) {
    lines.push('  ⚠  No .claude/ directory found — this may not be a Claude Code project');
    return lines.join('\n');
  }

  const ok = (label: string, count: number) =>
    count > 0 ? `  ✓  ${label}: ${count}` : `  –  ${label}: 0`;
  const warn = (label: string, count: number) =>
    count > 0 ? `  ⚠  ${label}: ${count} (no OpenCode equivalent)` : '';

  lines.push(ok('Agents', scan.agents.length));
  lines.push(ok('Commands', scan.commands.length));
  lines.push(ok('Skills', scan.skills.length));
  if (scan.hasClaudeMd) {
    lines.push(
      `  ✓  CLAUDE.md${scan.claudeMdIncludes.length > 0 ? ` (${scan.claudeMdIncludes.length} @include references)` : ''}`,
    );
  }
  if (scan.hasMcpJson) lines.push('  ✓  .mcp.json');
  if (scan.hasSettingsJson) lines.push('  ✓  .claude/settings.json (permissions)');

  const rulesLine = warn('Rules', scan.rules.length);
  if (rulesLine) lines.push(rulesLine);
  const hooksLine = warn('Hooks', scan.hooks.length);
  if (hooksLine) lines.push(hooksLine);

  return lines.join('\n');
}
