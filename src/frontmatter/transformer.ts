import matter from 'gray-matter';
import { stringify as yamlStringify } from 'yaml';
import { Logger } from '../utils/logger';
import {
  LLMProvider,
  AgentFrontmatter,
  OpenCodeAgentFrontmatter,
  CommandFrontmatter,
  OpenCodeCommandFrontmatter,
  SkillFrontmatter,
  OpenCodeSkillFrontmatter,
} from '../types';

// ─────────────────────────────────────────────────────────────
// Model mapping
// ─────────────────────────────────────────────────────────────

const MODEL_MAP: Record<LLMProvider, Record<string, string>> = {
  anthropic: {
    // Short aliases
    opus: 'anthropic/claude-opus-4-5',
    sonnet: 'anthropic/claude-sonnet-4-5',
    haiku: 'anthropic/claude-haiku-4-5',
    // Versioned aliases (without provider prefix)
    'claude-opus-4-5': 'anthropic/claude-opus-4-5',
    'claude-sonnet-4-5': 'anthropic/claude-sonnet-4-5',
    'claude-haiku-4-5': 'anthropic/claude-haiku-4-5',
    // Dated release IDs
    'claude-opus-4-5-20250514': 'anthropic/claude-opus-4-5',
    'claude-sonnet-4-5-20250514': 'anthropic/claude-sonnet-4-5',
    'claude-haiku-4-5-20250514': 'anthropic/claude-haiku-4-5',
    'claude-sonnet-4-20250514': 'anthropic/claude-sonnet-4-5',
    // Legacy Claude 3 aliases → map to nearest current equivalent
    'claude-3-opus-20240229': 'anthropic/claude-opus-4-5',
    'claude-3-5-sonnet-20241022': 'anthropic/claude-sonnet-4-5',
    'claude-3-5-haiku-20241022': 'anthropic/claude-haiku-4-5',
  },
  openai: {
    'gpt-4o': 'openai/gpt-4o',
    'gpt-4': 'openai/gpt-4',
    'gpt-4-turbo': 'openai/gpt-4-turbo',
    'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',
    'gpt-5': 'openai/gpt-5',
    'gpt-5.1-codex': 'openai/gpt-5.1-codex',
  },
  google: {
    'gemini-pro': 'google/gemini-pro',
    'gemini-flash': 'google/gemini-flash',
    'gemini-1.5-pro': 'google/gemini-1.5-pro',
    'gemini-1.5-flash': 'google/gemini-1.5-flash',
    'gemini-2.0-flash': 'google/gemini-2.0-flash',
    'gemini-2.5-pro': 'google/gemini-2.5-pro',
    'gemini-3-pro': 'google/gemini-3-pro',
  },
};

// Claude Code tool names → OpenCode permission keys
const TOOL_KEY_MAP: Record<string, string> = {
  Write: 'write',
  Edit: 'edit',
  Bash: 'bash',
  Read: 'read',
  Glob: 'glob',
  Grep: 'grep',
  WebSearch: 'webfetch',
  WebFetch: 'webfetch',
  Task: 'task',
  TodoWrite: 'todowrite',
  AskUserQuestion: 'ask',
};

// ─────────────────────────────────────────────────────────────
// Frontmatter parse / stringify helpers
// ─────────────────────────────────────────────────────────────

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
}

/**
 * Parse a markdown file with optional YAML frontmatter.
 */
export function parseMarkdown(content: string): ParsedMarkdown {
  const { data, content: body } = matter(content);
  return { frontmatter: data as Record<string, unknown>, body: body.trimStart() };
}

/**
 * Stringify frontmatter + body back to markdown.
 */
export function stringifyMarkdown(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  if (Object.keys(frontmatter).length === 0) return body;

  // Use yaml package for prettier output (gray-matter sometimes uses flow style)
  const yamlText = yamlStringify(frontmatter, {
    lineWidth: 0,
    defaultKeyType: 'PLAIN',
    defaultStringType: 'PLAIN',
  }).trimEnd();

  return `---\n${yamlText}\n---\n\n${body}`;
}

// ─────────────────────────────────────────────────────────────
// Model mapping
// ─────────────────────────────────────────────────────────────

export function mapModel(
  modelRaw: string,
  provider: LLMProvider,
  log: Logger,
  context: string,
): string {
  if (!modelRaw || modelRaw === 'inherit') return '';

  const mapping = MODEL_MAP[provider] ?? {};
  const mapped = mapping[modelRaw];
  if (mapped) return mapped;

  // Already a full provider/model-id
  if (modelRaw.includes('/')) return modelRaw;

  log.warn(`${context}: unknown model alias "${modelRaw}" — left as-is`);
  return modelRaw;
}

// ─────────────────────────────────────────────────────────────
// Tool list → OpenCode permission dict
// ─────────────────────────────────────────────────────────────

/**
 * Normalize a Claude Code tools field to a comma-separated string.
 * Claude Code frontmatter may use either:
 *   - a YAML list:  [Read, Glob, Bash]  → parsed as string[]
 *   - a string:     "Read, Glob, Bash"
 */
function normalizeToolsField(value: unknown): string {
  if (!value) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

/**
 * Parse a Claude Code tool list like "Read, Glob, Write, Bash"
 * and produce an OpenCode permission dict.
 *
 * Logic:
 *   - If Write/Edit absent → permission.edit = "deny"
 *   - If Bash absent       → permission.bash = "deny"
 *   - If Read absent       → permission.read = "deny"
 *   - disallowedTools overrides to "deny"
 */
export function toolsToPermission(
  toolsRaw: unknown,
  disallowedRaw: unknown,
): Record<string, string> {
  const perm: Record<string, string> = {};

  const toolsStr = normalizeToolsField(toolsRaw);
  if (toolsStr) {
    const tools = toolsStr.split(',').map(t => t.trim());
    const hasEdit = tools.some(t => t === 'Write' || t === 'Edit');
    const hasBash = tools.includes('Bash');
    const hasRead = tools.includes('Read');

    if (!hasEdit) perm['edit'] = 'deny';
    if (!hasBash) perm['bash'] = 'deny';
    if (!hasRead) perm['read'] = 'deny';
  }

  const disallowedStr = normalizeToolsField(disallowedRaw);
  if (disallowedStr) {
    const disallowed = disallowedStr.split(',').map(t => t.trim());
    for (const tool of disallowed) {
      const key = TOOL_KEY_MAP[tool] ?? tool.toLowerCase();
      perm[key] = 'deny';
    }
  }

  return perm;
}

// ─────────────────────────────────────────────────────────────
// allowed-tools → permission (for commands)
// ─────────────────────────────────────────────────────────────

/**
 * Parse Claude Code "allowed-tools" like:
 *   "Bash(git add:*), Bash(git status:*), Read"
 * → OpenCode permission:
 *   { bash: { "git add*": "allow", "git status*": "allow" }, read: "allow" }
 */
export function parseAllowedTools(allowedRaw: unknown): Record<string, unknown> {
  const perm: Record<string, unknown> = {};
  const allowedStr = normalizeToolsField(allowedRaw);
  if (!allowedStr) return perm;

  const parts = allowedStr.split(',').map(p => p.trim());

  for (const part of parts) {
    // Match "Tool(pattern)"
    const match = part.match(/^(\w+)\((.+)\)$/);
    if (match) {
      const toolRaw = match[1];
      const patternRaw = match[2];
      const toolKey = TOOL_KEY_MAP[toolRaw] ?? toolRaw.toLowerCase();

      // Convert "git add:*" → "git add*"  (colon separator → glob)
      const pattern = patternRaw.replace(/:?\*$/, '*');

      if (!perm[toolKey] || typeof perm[toolKey] === 'string') {
        perm[toolKey] = {};
      }
      (perm[toolKey] as Record<string, string>)[pattern] = 'allow';
    } else {
      // Plain tool name without pattern
      const toolKey = TOOL_KEY_MAP[part] ?? part.toLowerCase();
      perm[toolKey] = 'allow';
    }
  }

  return perm;
}

// ─────────────────────────────────────────────────────────────
// Agent frontmatter conversion
// ─────────────────────────────────────────────────────────────

export function convertAgentFrontmatter(
  fm: AgentFrontmatter,
  provider: LLMProvider,
  filename: string,
  log: Logger,
): OpenCodeAgentFrontmatter {
  const out: OpenCodeAgentFrontmatter = {
    description: '',
    mode: 'all',
  };

  // description
  if (fm.description) {
    out.description = fm.description;
  } else if (fm.name) {
    out.description = `Agent: ${fm.name}`;
    log.warn(`agents/${filename}: no description — used name as fallback`);
  } else {
    out.description = `Agent`;
    log.warn(`agents/${filename}: no description or name — set a description manually`);
  }

  // mode (pass through if already set, otherwise default 'all')
  if (fm.mode) out.mode = fm.mode;

  // model
  const modelRaw = String(fm.model ?? '');
  if (modelRaw && modelRaw !== 'inherit') {
    const mapped = mapModel(modelRaw, provider, log, `agents/${filename}`);
    if (mapped) out.model = mapped;
  }

  // steps (was maxTurns)
  const turns = fm.maxTurns ?? fm.steps;
  if (turns !== undefined) out.steps = Number(turns);

  // temperature / top_p passthrough
  if (fm.temperature !== undefined) out.temperature = fm.temperature;
  if (fm.top_p !== undefined) out.top_p = fm.top_p;

  // tools → permission
  const perm = toolsToPermission(fm.tools, fm.disallowedTools);
  if (Object.keys(perm).length > 0) out.permission = perm;

  // Warn about unsupported fields
  const unsupported: string[] = [];
  if (fm.memory)          unsupported.push(`memory: ${fm.memory}`);
  if (fm.permissionMode)  unsupported.push(`permissionMode: ${fm.permissionMode}`);
  if (fm.effort)          unsupported.push(`effort: ${fm.effort}`);
  if (fm.isolation)       unsupported.push(`isolation: ${fm.isolation}`);
  if (fm.background !== undefined) unsupported.push('background');
  if (fm.color)           unsupported.push(`color: ${fm.color}`);
  if (fm.initialPrompt)   unsupported.push('initialPrompt');
  if (unsupported.length > 0) {
    log.warn(
      `agents/${filename}: fields with no OpenCode equivalent ignored: ${unsupported.join(', ')}`,
    );
  }

  return out;
}

// ─────────────────────────────────────────────────────────────
// Command frontmatter conversion
// ─────────────────────────────────────────────────────────────

export function convertCommandFrontmatter(
  fm: CommandFrontmatter,
  filename: string,
  log: Logger,
): OpenCodeCommandFrontmatter {
  const out: OpenCodeCommandFrontmatter = {};

  if (fm.description) out.description = fm.description;
  if (fm.agent) out.agent = fm.agent;
  if (fm.model) out.model = fm.model;
  if (fm.subtask !== undefined) out.subtask = fm.subtask;

  const allowedTools = fm['allowed-tools'];
  if (allowedTools) {
    const perm = parseAllowedTools(allowedTools);
    if (Object.keys(perm).length > 0) out.permission = perm;
  }

  // Log silently dropped fields
  const dropped: string[] = [];
  if (fm['argument-hint']) dropped.push('argument-hint');
  if (fm.name) dropped.push('name');
  if (fm.tags) dropped.push('tags');
  if (dropped.length > 0) {
    log.info(`commands/${filename}: dropped unsupported fields: ${dropped.join(', ')}`);
  }

  return out;
}

// ─────────────────────────────────────────────────────────────
// Skill frontmatter conversion
// ─────────────────────────────────────────────────────────────

export function convertSkillFrontmatter(
  fm: SkillFrontmatter,
  skillName: string,
  log: Logger,
): OpenCodeSkillFrontmatter {
  // OpenCode skills only accept: name, description, license, compatibility, metadata
  // The 'tools' and 'permission' fields do not exist in OpenCode skill frontmatter.
  const out: OpenCodeSkillFrontmatter = {
    name: fm.name ?? skillName,
    description: fm.description ?? '',
  };

  if (fm.license) out.license = String(fm.license);
  if (fm.compatibility) out.compatibility = String(fm.compatibility);
  if (fm.metadata && typeof fm.metadata === 'object') {
    out.metadata = fm.metadata as Record<string, string>;
  }

  // Log silently dropped fields
  const dropped: string[] = [];
  if (fm['allowed-tools']) dropped.push('allowed-tools (no equivalent in OpenCode skill frontmatter)');
  if (fm['argument-hint']) dropped.push('argument-hint');
  if (fm['user-invocable'] !== undefined) dropped.push('user-invocable');
  if (fm.context) dropped.push('context');
  if (dropped.length > 0) {
    log.warn(`skills/${skillName}: dropped unsupported fields: ${dropped.join(', ')}`);
  }

  return out;
}

// ─────────────────────────────────────────────────────────────
// settings.json permission conversion
// ─────────────────────────────────────────────────────────────

// Parse a Claude Code permission string like:
//   "Bash(git status*)"  => { tool: 'bash', pattern: 'git status*' }
//   "Read(**/.env*)"     => { tool: 'read', pattern: '**/.env*' }
//   "Bash"               => { tool: 'bash', pattern: null }
function parseClaudePermission(
  permStr: string,
): { tool: string; pattern: string | null } {
  const match = permStr.trim().match(/^(\w+)\((.+)\)$/);
  if (match) {
    const toolKey = TOOL_KEY_MAP[match[1]] ?? match[1].toLowerCase();
    return { tool: toolKey, pattern: match[2] };
  }
  const toolKey = TOOL_KEY_MAP[permStr.trim()] ?? permStr.trim().toLowerCase();
  return { tool: toolKey, pattern: null };
}

export function convertSettingsPermissions(
  allowList: string[],
  denyList: string[],
  log: Logger,
): Record<string, unknown> {
  const perm: Record<string, unknown> = {};

  function addPerm(list: string[], verdict: 'allow' | 'deny') {
    for (const entry of list) {
      const { tool, pattern } = parseClaudePermission(entry);
      if (pattern) {
        if (!perm[tool] || typeof perm[tool] === 'string') {
          perm[tool] = {};
        }
        (perm[tool] as Record<string, string>)[pattern] = verdict;
      } else {
        if (typeof perm[tool] === 'object' && perm[tool] !== null) {
          (perm[tool] as Record<string, string>)['*'] = verdict;
        } else {
          perm[tool] = verdict;
        }
      }
    }
  }

  addPerm(allowList, 'allow');
  addPerm(denyList, 'deny');

  if (Object.keys(perm).length > 0) {
    log.ok(
      `.claude/settings.json → opencode.json [permission] (${Object.keys(perm).length} tool rules)`,
    );
  }

  return perm;
}
