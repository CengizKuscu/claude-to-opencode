// Shared types for the claude-to-opencode converter

export interface ScanResult {
  projectPath: string;
  hasClaudeDir: boolean;
  agents: string[];       // paths relative to project
  commands: string[];
  skills: string[];       // paths to SKILL.md files
  rules: string[];
  hooks: string[];
  hasMcpJson: boolean;
  hasSettingsJson: boolean;
  hasClaudeMd: boolean;
  claudeMdIncludes: string[]; // @filepath references found in CLAUDE.md
}

export interface ConversionOptions {
  inputPath: string;
  outputPath: string;
  provider: LLMProvider;
  unsupportedStrategy: UnsupportedStrategy;
  dryRun: boolean;
  verbose: boolean;
}

export type LLMProvider = 'anthropic' | 'openai' | 'google';
export type UnsupportedStrategy = 'copy-and-report' | 'report-only';

export interface ConversionResult {
  agentsConverted: number;
  commandsConverted: number;
  skillsConverted: number;
  claudeMdInlined: number;
  mcpServersConverted: number;
  permissionsConverted: number;
  unsupportedFiles: UnsupportedFile[];
  warnings: string[];
  errors: string[];
}

export interface UnsupportedFile {
  sourcePath: string;
  type: 'rule' | 'hook' | 'statusline' | 'settings-local';
  reason: string;
  suggestion: string;
}

export interface AgentFrontmatter {
  name?: string;
  description?: string;
  tools?: string | string[];
  disallowedTools?: string | string[];
  model?: string;
  maxTurns?: number;
  steps?: number;
  mode?: string;
  temperature?: number;
  top_p?: number;
  // Claude Code-specific fields with no OpenCode equivalent:
  memory?: string;
  permissionMode?: string;
  effort?: string;
  isolation?: string;
  background?: boolean;
  color?: string;
  initialPrompt?: string;
  [key: string]: unknown;
}

export interface OpenCodeAgentFrontmatter {
  description: string;
  mode: string;
  model?: string;
  steps?: number;
  temperature?: number;
  top_p?: number;
  permission?: Record<string, unknown>;
}

export interface CommandFrontmatter {
  description?: string;
  'allowed-tools'?: string | string[];
  'argument-hint'?: string;
  name?: string;
  tags?: string[];
  agent?: string;
  model?: string;
  subtask?: boolean;
  [key: string]: unknown;
}

export interface OpenCodeCommandFrontmatter {
  description?: string;
  agent?: string;
  model?: string;
  subtask?: boolean;
  permission?: Record<string, unknown>;
}

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  'argument-hint'?: string;
  'user-invocable'?: boolean;
  'allowed-tools'?: string | string[];
  context?: string;
  [key: string]: unknown;
}

export interface OpenCodeSkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
}

export interface McpServer {
  type: 'local' | 'remote';
  command?: string[];
  url?: string;
  environment?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface OpenCodeConfig {
  $schema: string;
  mcp?: Record<string, McpServer>;
  permission?: Record<string, unknown>;
  [key: string]: unknown;
}
