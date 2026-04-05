import path from 'path';
import { ConversionOptions, ConversionResult, UnsupportedFile } from '../types';
import { readFile, writeFile, copyFile, ensureDir } from '../utils/fs';
import { Logger } from '../utils/logger';

interface HookMeta {
  event: string;
  purpose: string;
  suggestion: string;
}

/**
 * Detect the likely hook event and purpose from filename or content.
 */
function detectHookMeta(filename: string, content: string): HookMeta {
  const name = filename.toLowerCase();

  if (name.includes('session-start') || name.includes('session_start')) {
    return {
      event: 'SessionStart',
      purpose: 'Loads project state, git context, sprint info at session startup',
      suggestion: `Convert to a custom command that the user runs manually at session start,
  or document the state it sets up and maintain it manually in your session notes.`,
    };
  }
  if (name.includes('session-stop') || name.includes('stop')) {
    return {
      event: 'Stop',
      purpose: 'Archives session state and logs commits on session end',
      suggestion: `Convert to a custom /session-end command that the user invokes before closing.`,
    };
  }
  if (name.includes('pre-compact') || name.includes('compact')) {
    return {
      event: 'PreCompact',
      purpose: 'Dumps session state before context compression',
      suggestion: `OpenCode does not compact context. Instead, maintain a session-state file 
  and reference it in your prompts to preserve context across sessions.`,
    };
  }
  if (name.includes('validate-commit') || name.includes('commit')) {
    return {
      event: 'PreToolUse (Bash — git commit)',
      purpose: 'Validates design docs and blocks invalid commits',
      suggestion: `Install as a Git hook instead:
    cp _unsupported/hooks/${filename} .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
  Remove the Claude Code JSON stdin parsing (first section) and adapt the exit codes.`,
    };
  }
  if (name.includes('validate-push') || name.includes('push')) {
    return {
      event: 'PreToolUse (Bash — git push)',
      purpose: 'Warns before pushing to protected branches',
      suggestion: `Install as a Git hook:
    cp _unsupported/hooks/${filename} .git/hooks/pre-push && chmod +x .git/hooks/pre-push`,
    };
  }
  if (name.includes('validate-asset') || name.includes('asset')) {
    return {
      event: 'PostToolUse (Write/Edit)',
      purpose: 'Validates asset naming conventions after file writes',
      suggestion: `Convert to a /audit-assets command that runs periodically,
  or integrate into your CI/CD pipeline.`,
    };
  }
  if (name.includes('detect-gap') || name.includes('gap')) {
    return {
      event: 'SessionStart',
      purpose: 'Detects documentation gaps and suggests next steps',
      suggestion: `Convert to a /detect-gaps command or include gap detection in your /start command.`,
    };
  }
  if (name.includes('log-agent') || name.includes('agent')) {
    return {
      event: 'SubagentStart',
      purpose: 'Logs subagent invocations for audit',
      suggestion: `OpenCode does not expose subagent lifecycle events. 
  Manual audit logging is not currently achievable without platform support.`,
    };
  }
  if (name.includes('statusline') || name.includes('status')) {
    return {
      event: 'StatusLine',
      purpose: 'Provides status bar content (context%, model, epic breadcrumb)',
      suggestion: `OpenCode has no status bar hook. The information is no longer available
  in real-time. Consider maintaining a session-state file as a substitute.`,
    };
  }

  // Generic fallback
  const eventHint = content.includes('PreToolUse')
    ? 'PreToolUse'
    : content.includes('PostToolUse')
    ? 'PostToolUse'
    : content.includes('SessionStart')
    ? 'SessionStart'
    : 'Unknown';

  return {
    event: eventHint,
    purpose: 'Custom hook script',
    suggestion: `Review the script and determine whether it can be converted to a custom
  OpenCode command or a native Git hook.`,
  };
}

/**
 * Handle .claude/hooks/* — no OpenCode equivalent.
 * Strategy: copy to _unsupported/hooks/ and add to report.
 */
export async function convertHooks(
  scan: { hooks: string[]; projectPath: string },
  options: ConversionOptions,
  result: ConversionResult,
  log: Logger,
): Promise<void> {
  if (scan.hooks.length === 0) return;

  const unsupportedDir = path.join(options.outputPath, '_unsupported', 'hooks');

  if (options.unsupportedStrategy === 'copy-and-report' && !options.dryRun) {
    await ensureDir(unsupportedDir);
  }

  for (const relPath of scan.hooks) {
    const srcPath = path.join(scan.projectPath, relPath);
    const filename = path.basename(relPath);
    const content = await readFile(srcPath);
    const meta = detectHookMeta(filename, content ?? '');

    const unsupported: UnsupportedFile = {
      sourcePath: relPath,
      type: filename.includes('statusline') ? 'statusline' : 'hook',
      reason: `Claude Code hook event "${meta.event}" has no OpenCode equivalent`,
      suggestion: meta.suggestion,
    };
    result.unsupportedFiles.push(unsupported);

    if (options.unsupportedStrategy === 'copy-and-report') {
      if (!options.dryRun) {
        await copyFile(srcPath, path.join(unsupportedDir, filename));
      }
      log.warn(`hooks/${filename} → _unsupported/hooks/ (${meta.event} — no OpenCode equivalent)`);
    } else {
      log.warn(`hooks/${filename}: skipped (${meta.event} — no OpenCode equivalent)`);
    }
  }
}
