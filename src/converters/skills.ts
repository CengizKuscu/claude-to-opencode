import path from 'path';
import { ConversionOptions, ConversionResult, SkillFrontmatter } from '../types';
import { readFile, writeFile, ensureDir } from '../utils/fs';
import {
  parseMarkdown,
  stringifyMarkdown,
  convertSkillFrontmatter,
} from '../frontmatter/transformer';
import { Logger } from '../utils/logger';

/**
 * Convert all .claude/skills/<name>/SKILL.md → <output>/.opencode/skills/<name>/SKILL.md
 *
 * Preserves the subdirectory structure so skill names are unchanged.
 * Converts frontmatter: removes Claude Code-specific fields, maps tools.
 */
export async function convertSkills(
  scan: { skills: string[]; projectPath: string },
  options: ConversionOptions,
  result: ConversionResult,
  log: Logger,
): Promise<void> {
  if (scan.skills.length === 0) return;

  for (const relPath of scan.skills) {
    // relPath is like ".claude/skills/brainstorm/SKILL.md"
    const srcPath = path.join(scan.projectPath, relPath);

    // Compute skill name from directory
    const parts = relPath.split(path.sep);
    // Find 'skills' segment index
    const skillsIdx = parts.indexOf('skills');
    const skillName = skillsIdx >= 0 ? parts[skillsIdx + 1] : path.basename(path.dirname(relPath));

    // Output: .opencode/skills/<name>/SKILL.md
    const destPath = path.join(
      options.outputPath,
      '.opencode',
      'skills',
      skillName,
      'SKILL.md',
    );

    const content = await readFile(srcPath);
    if (!content) {
      result.errors.push(`Could not read ${relPath}`);
      continue;
    }

    const { frontmatter, body } = parseMarkdown(content);

    const newFm = convertSkillFrontmatter(
      frontmatter as SkillFrontmatter,
      skillName,
      log,
    );

    const outContent = stringifyMarkdown(
      newFm as unknown as Record<string, unknown>,
      body,
    );

    if (!options.dryRun) {
      await ensureDir(path.dirname(destPath));
      await writeFile(destPath, outContent);
    }

    log.info(`  skill: ${skillName} → .opencode/skills/${skillName}/SKILL.md`);
    result.skillsConverted++;
  }
}
