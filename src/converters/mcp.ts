import path from 'path';
import { ConversionOptions, ConversionResult, McpServer, OpenCodeConfig } from '../types';
import { readJson, writeJson, exists } from '../utils/fs';
import { convertSettingsPermissions } from '../frontmatter/transformer';
import { Logger } from '../utils/logger';

/**
 * Convert .mcp.json + .claude/settings.json into a merged opencode.json
 * at the output directory root.
 */
export async function convertMcpAndSettings(
  scan: { hasMcpJson: boolean; hasSettingsJson: boolean; projectPath: string },
  options: ConversionOptions,
  result: ConversionResult,
  log: Logger,
): Promise<void> {
  const outPath = path.join(options.outputPath, 'opencode.json');

  // Load existing opencode.json if present in the OUTPUT directory
  let existing: OpenCodeConfig = { $schema: 'https://opencode.ai/config.json' };
  if (await exists(outPath)) {
    const loaded = await readJson(outPath);
    if (loaded) {
      existing = { $schema: 'https://opencode.ai/config.json', ...loaded };
      log.info('  opencode.json already exists in output — merging');
    }
  }

  // ── MCP servers from .mcp.json ─────────────────────────────────────────────
  if (scan.hasMcpJson) {
    const mcpRaw = await readJson(path.join(scan.projectPath, '.mcp.json'));
    if (mcpRaw) {
      const mcp = convertMcpServers(mcpRaw, log);
      if (Object.keys(mcp).length > 0) {
        existing.mcp = mcp;
        result.mcpServersConverted = Object.keys(mcp).length;
        log.ok(`.mcp.json → opencode.json [mcp] (${result.mcpServersConverted} servers)`);
      }
    }
  }

  // ── Permissions from .claude/settings.json ────────────────────────────────
  if (scan.hasSettingsJson) {
    const settings = await readJson(
      path.join(scan.projectPath, '.claude', 'settings.json'),
    );
    if (settings) {
      // Warn about unsupported features
      if (settings['hooks']) {
        const hookEvents = Object.keys(settings['hooks'] as object);
        result.warnings.push(
          `settings.json hooks [${hookEvents.join(', ')}] have no OpenCode equivalent — see _unsupported/hooks/`,
        );
      }
      if (settings['statusLine']) {
        result.warnings.push('settings.json statusLine has no OpenCode equivalent — ignored');
      }

      const permsRaw = (settings['permissions'] ?? {}) as Record<string, unknown>;
      const allowList = (permsRaw['allow'] ?? []) as string[];
      const denyList = (permsRaw['deny'] ?? []) as string[];

      if (allowList.length > 0 || denyList.length > 0) {
        const perm = convertSettingsPermissions(allowList, denyList, log);
        existing.permission = perm;
        result.permissionsConverted = Object.keys(perm).length;
      }
    }
  }

  if (!options.dryRun) {
    await writeJson(outPath, existing);
  }

  log.ok('opencode.json written');
}

/**
 * Convert raw .mcp.json mcpServers object to OpenCode mcp format.
 */
function convertMcpServers(
  raw: Record<string, unknown>,
  log: Logger,
): Record<string, McpServer> {
  const servers = (raw['mcpServers'] ?? raw) as Record<string, unknown>;
  const out: Record<string, McpServer> = {};

  for (const [name, cfg] of Object.entries(servers)) {
    const c = cfg as Record<string, unknown>;
    const entry = convertSingleServer(name, c, log);
    if (entry) out[name] = entry;
  }

  return out;
}

function convertSingleServer(
  name: string,
  cfg: Record<string, unknown>,
  log: Logger,
): McpServer | null {
  const serverType = String(cfg['type'] ?? '');

  // Remote HTTP server
  if (serverType === 'http' || serverType === 'remote') {
    const url = String(cfg['url'] ?? '');
    if (!url) {
      log.warn(`MCP server "${name}": type is ${serverType} but no url found — skipped`);
      return null;
    }
    const entry: McpServer = { type: 'remote', url };
    if (cfg['headers']) entry.headers = cfg['headers'] as Record<string, string>;
    log.info(`  MCP: ${name} (remote → ${url})`);
    return entry;
  }

  // URL-only (no command) → treat as remote
  if (cfg['url'] && !cfg['command']) {
    const entry: McpServer = { type: 'remote', url: String(cfg['url']) };
    if (cfg['headers']) entry.headers = cfg['headers'] as Record<string, string>;
    log.info(`  MCP: ${name} (remote → ${cfg['url']})`);
    return entry;
  }

  // Local stdio server
  const command = String(cfg['command'] ?? '');
  const args = (cfg['args'] ?? []) as string[];
  const env = (cfg['env'] ?? {}) as Record<string, string>;

  const entry: McpServer = { type: 'local' };

  if (command) {
    entry.command = [command, ...args];
  } else if (args.length > 0) {
    entry.command = args;
  } else {
    log.warn(`MCP server "${name}": no command or url found — skipped`);
    return null;
  }

  if (Object.keys(env).length > 0) {
    entry.environment = env;
  }

  log.info(`  MCP: ${name} (local → ${entry.command?.join(' ')})`);
  return entry;
}
