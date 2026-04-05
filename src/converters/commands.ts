import path from 'path';
import { ConversionOptions, ConversionResult, CommandFrontmatter } from '../types';
import { readFile, writeFile, ensureDir } from '../utils/fs';
import {
  parseMarkdown,
  stringifyMarkdown,
  convertCommandFrontmatter,
} from '../frontmatter/transformer';
import { Logger } from '../utils/logger';

/**
 * Convert all .claude/commands/*.md → <output>/.opencode/commands/*.md
 */
export async function convertCommands(
  scan: { commands: string[]; projectPath: string },
  options: ConversionOptions,
  result: ConversionResult,
  log: Logger,
): Promise<void> {
  if (scan.commands.length === 0) return;

  const outDir = path.join(options.outputPath, '.opencode', 'commands');
  if (!options.dryRun) {
    await ensureDir(outDir);
  }

  for (const relPath of scan.commands) {
    const srcPath = path.join(scan.projectPath, relPath);
    const filename = path.basename(relPath);
    const destPath = path.join(outDir, filename);

    const content = await readFile(srcPath);
    if (!content) {
      result.errors.push(`Could not read ${relPath}`);
      continue;
    }

    const { frontmatter, body } = parseMarkdown(content);

    const newFm = convertCommandFrontmatter(
      frontmatter as CommandFrontmatter,
      filename,
      log,
    );

    const outContent = stringifyMarkdown(
      newFm as unknown as Record<string, unknown>,
      body,
    );

    if (!options.dryRun) {
      await writeFile(destPath, outContent);
    }

    log.info(`  command: ${filename} → .opencode/commands/${filename}`);
    result.commandsConverted++;
  }
}
