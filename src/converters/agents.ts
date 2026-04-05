import path from 'path';
import { ConversionOptions, ConversionResult, AgentFrontmatter } from '../types';
import { readFile, writeFile, ensureDir } from '../utils/fs';
import {
  parseMarkdown,
  stringifyMarkdown,
  convertAgentFrontmatter,
} from '../frontmatter/transformer';

/**
 * Convert all .claude/agents/*.md → <output>/.opencode/agents/*.md
 */
export async function convertAgents(
  scan: { agents: string[]; projectPath: string },
  options: ConversionOptions,
  result: ConversionResult,
): Promise<void> {
  if (scan.agents.length === 0) return;

  const outDir = path.join(options.outputPath, '.opencode', 'agents');
  if (!options.dryRun) {
    await ensureDir(outDir);
  }

  for (const relPath of scan.agents) {
    const srcPath = path.join(scan.projectPath, relPath);
    const filename = path.basename(relPath);
    const destPath = path.join(outDir, filename);

    const content = await readFile(srcPath);
    if (!content) {
      result.errors.push(`Could not read ${relPath}`);
      continue;
    }

    const { frontmatter, body } = parseMarkdown(content);

    if (Object.keys(frontmatter).length === 0) {
      result.warnings.push(`agents/${filename}: no frontmatter — copied as-is`);
      if (!options.dryRun) {
        await writeFile(destPath, content);
      }
      result.agentsConverted++;
      continue;
    }

    const newFm = convertAgentFrontmatter(
      frontmatter as AgentFrontmatter,
      options.provider,
      filename,
      { ok() {}, skip() {}, warn: (m) => result.warnings.push(m), error: (m) => result.errors.push(m), info() {}, section() {}, step() {}, warnings: result.warnings, errors: result.errors },
    );

    const outContent = stringifyMarkdown(
      newFm as unknown as Record<string, unknown>,
      body,
    );

    if (!options.dryRun) {
      await writeFile(destPath, outContent);
    }

    result.agentsConverted++;
  }
}
