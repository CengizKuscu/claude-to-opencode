import path from 'path';
import { ConversionResult, UnsupportedFile } from '../types';
import { writeFile } from '../utils/fs';

/**
 * Generate a MIGRATION-REPORT.md at the output path root.
 */
export async function generateReport(
  result: ConversionResult,
  inputPath: string,
  outputPath: string,
  dryRun: boolean,
): Promise<void> {
  const lines: string[] = [];
  const now = new Date().toISOString().split('T')[0];

  lines.push('# Migration Report: Claude Code → OpenCode');
  lines.push('');
  lines.push(`Generated: ${now}  `);
  lines.push(`Source: \`${inputPath}\`  `);
  lines.push(`Output: \`${outputPath}\``);
  lines.push('');

  // ── Summary ─────────────────────────────────────────────────────────────────
  lines.push('## Summary');
  lines.push('');
  lines.push('| Item | Count |');
  lines.push('|---|---|');
  lines.push(`| Agents converted | ${result.agentsConverted} |`);
  lines.push(`| Commands converted | ${result.commandsConverted} |`);
  lines.push(`| Skills converted | ${result.skillsConverted} |`);
  lines.push(`| CLAUDE.md @includes inlined | ${result.claudeMdInlined} |`);
  lines.push(`| MCP servers | ${result.mcpServersConverted} |`);
  lines.push(`| Permission rules | ${result.permissionsConverted} |`);
  lines.push(`| Unsupported files | ${result.unsupportedFiles.length} |`);
  lines.push(`| Warnings | ${result.warnings.length} |`);
  lines.push(`| Errors | ${result.errors.length} |`);
  lines.push('');

  // ── Converted (what worked) ──────────────────────────────────────────────
  lines.push('## What Was Converted Automatically');
  lines.push('');
  lines.push('| Source | Destination | Notes |');
  lines.push('|---|---|---|');
  lines.push(
    '| `.claude/agents/*.md` | `.opencode/agents/*.md` | Frontmatter keys remapped (model, maxTurns→steps, tools→permission) |',
  );
  lines.push(
    '| `.claude/commands/*.md` | `.opencode/commands/*.md` | `allowed-tools` → `permission`, unsupported fields dropped |',
  );
  lines.push(
    '| `.claude/skills/*/SKILL.md` | `.opencode/skills/*/SKILL.md` | `allowed-tools` → `tools`, Claude-specific fields dropped |',
  );
  lines.push(
    '| `CLAUDE.md` | `CLAUDE.md` | `@filepath` includes inlined into document body |',
  );
  lines.push(
    '| `.mcp.json` | `opencode.json [mcp]` | MCP server definitions converted to OpenCode format |',
  );
  lines.push(
    '| `.claude/settings.json [permissions]` | `opencode.json [permission]` | Allow/deny rules converted |',
  );
  lines.push('');

  // ── Unsupported items ────────────────────────────────────────────────────
  if (result.unsupportedFiles.length > 0) {
    lines.push('## Unsupported Content — Manual Action Required');
    lines.push('');
    lines.push(
      'The following files have no direct OpenCode equivalent. They have been copied to `_unsupported/` for reference.',
    );
    lines.push('');

    // Group by type
    const byType: Record<string, UnsupportedFile[]> = {};
    for (const f of result.unsupportedFiles) {
      if (!byType[f.type]) byType[f.type] = [];
      byType[f.type].push(f);
    }

    if (byType['hook']?.length || byType['statusline']?.length) {
      lines.push('### Hooks');
      lines.push('');
      lines.push(
        'Claude Code hooks run on lifecycle events (`SessionStart`, `PreToolUse`, `Stop`, etc.).  ',
      );
      lines.push('OpenCode has **no hook system**. Each script needs manual handling:');
      lines.push('');

      for (const f of [...(byType['hook'] ?? []), ...(byType['statusline'] ?? [])]) {
        const filename = path.basename(f.sourcePath);
        lines.push(`#### \`${filename}\``);
        lines.push('');
        lines.push(`**Reason**: ${f.reason}  `);
        lines.push(`**Copied to**: \`_unsupported/hooks/${filename}\``);
        lines.push('');
        lines.push('**Recommended action**:');
        lines.push('');
        for (const suggLine of f.suggestion.split('\n')) {
          lines.push(suggLine.startsWith('  ') ? suggLine : `> ${suggLine}`);
        }
        lines.push('');
      }
    }

    if (byType['rule']?.length) {
      lines.push('### Path-Scoped Rules');
      lines.push('');
      lines.push(
        "Claude Code's `paths:` frontmatter in rules files automatically injects rules when working on specific file globs.  ",
      );
      lines.push('OpenCode has **no path-scoped rule injection**.');
      lines.push('');
      lines.push('**Recommended approach**: Inline these rules into `CLAUDE.md` under a dedicated section.');
      lines.push('');

      for (const f of byType['rule']) {
        const filename = path.basename(f.sourcePath);
        lines.push(`- \`${f.sourcePath}\` → copied to \`_unsupported/rules/${filename}\``);
      }
      lines.push('');

      lines.push('**How to migrate manually**:');
      lines.push('');
      lines.push('1. Open each rule file in `_unsupported/rules/`');
      lines.push('2. Add the content to `CLAUDE.md` under a `## Code Rules` section');
      lines.push('3. Organize by file type/path so the AI understands the context');
      lines.push('');
    }

    if (byType['settings-local']?.length) {
      lines.push('### Local Settings');
      lines.push('');
      for (const f of byType['settings-local']) {
        lines.push(`- \`${f.sourcePath}\`: ${f.reason}`);
        lines.push(`  - ${f.suggestion}`);
      }
      lines.push('');
    }
  }

  // ── Warnings ─────────────────────────────────────────────────────────────
  if (result.warnings.length > 0) {
    lines.push('## Warnings');
    lines.push('');
    for (const w of result.warnings) {
      lines.push(`- ${w}`);
    }
    lines.push('');
  }

  // ── Errors ───────────────────────────────────────────────────────────────
  if (result.errors.length > 0) {
    lines.push('## Errors');
    lines.push('');
    for (const e of result.errors) {
      lines.push(`- ❌ ${e}`);
    }
    lines.push('');
  }

  // ── Frontmatter mapping reference ─────────────────────────────────────────
  lines.push('## Frontmatter Mapping Reference');
  lines.push('');
  lines.push('### Agents');
  lines.push('');
  lines.push('| Claude Code | OpenCode | Notes |');
  lines.push('|---|---|---|');
  lines.push('| `model: opus` | `model: anthropic/claude-opus-4-5` | Full provider/model-id |');
  lines.push('| `model: sonnet` | `model: anthropic/claude-sonnet-4-5` | |');
  lines.push('| `model: haiku` | `model: anthropic/claude-haiku-4-5` | |');
  lines.push('| `model: inherit` | *(removed)* | Uses session default |');
  lines.push('| `maxTurns: 20` | `steps: 20` | Renamed |');
  lines.push('| `tools: Read, Glob` *(no Write/Edit)* | `permission: { edit: deny }` | |');
  lines.push('| `tools: Read, Glob` *(no Bash)* | `permission: { bash: deny }` | |');
  lines.push('| `disallowedTools: Bash` | `permission: { bash: deny }` | |');
  lines.push('| `name: xxx` | *(removed)* | Derived from filename |');
  lines.push('| `memory: user` | *(removed, warning issued)* | No OpenCode equivalent |');
  lines.push('');
  lines.push('### Commands');
  lines.push('');
  lines.push('| Claude Code | OpenCode | Notes |');
  lines.push('|---|---|---|');
  lines.push('| `allowed-tools: Bash(git add:*)` | `permission: bash: git add*: allow` | |');
  lines.push('| `argument-hint: [msg]` | *(removed)* | No OpenCode equivalent |');
  lines.push('| `tags: [...]` | *(removed)* | No OpenCode equivalent |');
  lines.push('| `$ARGUMENTS` in body | `$ARGUMENTS` | Kept as-is |');
  lines.push('| `` !`shell cmd` `` in body | `` !`shell cmd` `` | Kept as-is |');
  lines.push('');
  lines.push('### Skills');
  lines.push('');
  lines.push('| Claude Code | OpenCode | Notes |');
  lines.push('|---|---|---|');
  lines.push('| `allowed-tools: Read, Write` | `tools: { read: true, write: true }` | |');
  lines.push('| `user-invocable: true` | *(removed)* | No equivalent |');
  lines.push('| `context: fork` | *(removed)* | No equivalent |');
  lines.push('| `argument-hint: ...` | *(removed)* | No equivalent |');
  lines.push('| `name: xxx` | *(removed)* | Derived from directory name |');
  lines.push('');

  const reportPath = path.join(outputPath, 'MIGRATION-REPORT.md');
  if (!dryRun) {
    await writeFile(reportPath, lines.join('\n'));
  }
}
