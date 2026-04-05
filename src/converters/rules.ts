import path from 'path';
import { ConversionOptions, ConversionResult, UnsupportedFile } from '../types';
import { readFile, writeFile, ensureDir } from '../utils/fs';
import { Logger } from '../utils/logger';

const RULE_SUGGESTIONS: Record<string, string> = {
  default: `OpenCode has no path-scoped rule injection. Options:
  1. Inline the rules into CLAUDE.md under a relevant section
  2. Reference them in your main system prompt
  3. Add them as project-level instructions in opencode.json`,
};

/**
 * Handle .claude/rules/*.md — no OpenCode equivalent.
 * Strategy: copy to _unsupported/rules/ and add to report.
 */
export async function convertRules(
  scan: { rules: string[]; projectPath: string },
  options: ConversionOptions,
  result: ConversionResult,
  log: Logger,
): Promise<void> {
  if (scan.rules.length === 0) return;

  const unsupportedDir = path.join(options.outputPath, '_unsupported', 'rules');

  if (options.unsupportedStrategy === 'copy-and-report' && !options.dryRun) {
    await ensureDir(unsupportedDir);
  }

  for (const relPath of scan.rules) {
    const srcPath = path.join(scan.projectPath, relPath);
    const filename = path.basename(relPath);

    // Try to extract the paths: frontmatter for context
    const content = await readFile(srcPath);
    const pathsContext = content ? extractPathsFromRule(content) : [];

    const unsupported: UnsupportedFile = {
      sourcePath: relPath,
      type: 'rule',
      reason: `Claude Code path-scoped rules (paths: ${pathsContext.join(', ') || 'N/A'}) have no OpenCode equivalent`,
      suggestion: RULE_SUGGESTIONS['default'],
    };
    result.unsupportedFiles.push(unsupported);

    if (options.unsupportedStrategy === 'copy-and-report') {
      if (!options.dryRun && content) {
        await writeFile(path.join(unsupportedDir, filename), addUnsupportedHeader(content, unsupported.reason));
      }
      log.warn(`rules/${filename} → _unsupported/rules/ (no OpenCode equivalent)`);
    } else {
      log.warn(`rules/${filename}: skipped — no OpenCode equivalent (see MIGRATION-REPORT.md)`);
    }
  }
}

/**
 * Extract the paths: array from a rule file's YAML frontmatter.
 */
function extractPathsFromRule(content: string): string[] {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return [];
  const yamlBlock = match[1];
  const pathsMatch = yamlBlock.match(/paths:\s*\n((?:\s+- .+\n?)+)/);
  if (!pathsMatch) return [];
  return pathsMatch[1]
    .split('\n')
    .map(l => l.replace(/^\s+- /, '').trim())
    .filter(Boolean);
}

/**
 * Prepend a warning comment to the file content.
 */
function addUnsupportedHeader(content: string, reason: string): string {
  return `<!-- UNSUPPORTED: ${reason} -->\n<!-- See MIGRATION-REPORT.md for manual migration steps -->\n\n${content}`;
}
