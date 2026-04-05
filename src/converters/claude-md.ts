import path from 'path';
import { ConversionOptions, ConversionResult } from '../types';
import { readFile, writeFile } from '../utils/fs';
import { Logger } from '../utils/logger';

const INCLUDE_PATTERN = /^@(\.claude\/[^\s]+|[^\s]+\.(md|txt|json))$/;

/**
 * Process CLAUDE.md:
 *   1. Resolve all @filepath includes → inline the file content
 *   2. Write CLAUDE.md to the output directory
 */
export async function convertClaudeMd(
  scan: { hasClaudeMd: boolean; claudeMdIncludes: string[]; projectPath: string },
  options: ConversionOptions,
  result: ConversionResult,
  log: Logger,
): Promise<void> {
  if (!scan.hasClaudeMd) return;

  const srcPath = path.join(scan.projectPath, 'CLAUDE.md');
  const destPath = path.join(options.outputPath, 'CLAUDE.md');

  const content = await readFile(srcPath);
  if (!content) {
    result.errors.push('Could not read CLAUDE.md');
    return;
  }

  const processed = await inlineIncludes(content, scan.projectPath, result, log);

  if (!options.dryRun) {
    await writeFile(destPath, processed);
  }

  log.info(`  CLAUDE.md → ${path.relative(options.outputPath, destPath)}`);
}

/**
 * Walk through CLAUDE.md content line by line.
 * When a line matches `@filepath`, replace it with the file's content
 * wrapped in a comment block indicating the source.
 */
async function inlineIncludes(
  content: string,
  projectPath: string,
  result: ConversionResult,
  log: Logger,
): Promise<string> {
  const lines = content.split('\n');
  const output: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(INCLUDE_PATTERN);

    if (match) {
      const includePath = match[1];
      const absPath = path.join(projectPath, includePath);
      const included = await readFile(absPath);

      if (included) {
        output.push(`<!-- included from ${includePath} -->`);
        output.push('');
        output.push(included.trimEnd());
        output.push('');
        output.push(`<!-- end of ${includePath} -->`);
        result.claudeMdInlined++;
        log.info(`  @include inlined: ${includePath}`);
      } else {
        // File not found — keep the original line with a warning comment
        output.push(
          `<!-- WARNING: could not inline ${includePath} — file not found -->`,
        );
        output.push(line);
        result.warnings.push(
          `CLAUDE.md: @include "${includePath}" not found — left as comment`,
        );
      }
    } else {
      output.push(line);
    }
  }

  return output.join('\n');
}
