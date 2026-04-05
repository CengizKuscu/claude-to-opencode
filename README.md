# claude-to-opencode

> **Warning:** This is an experimental tool and has not been through rigorous testing. Use at your own risk. **Always back up your project before running the converter** — no guarantees are made about the correctness or completeness of the output.

A CLI tool that migrates [Claude Code](https://claude.ai/code) projects to [OpenCode](https://opencode.ai) format.

Automatically converts agents, commands, skills, `CLAUDE.md`, MCP servers, and permission settings. Unsupported content (hooks, path-scoped rules) is copied aside and documented in a migration report.

**Documentation:**
- Claude Code: https://docs.anthropic.com/en/docs/claude-code/overview
- OpenCode: https://opencode.ai/docs

> Turkish version: [README_TR.md](./README_TR.md)

---

## Table of contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [CLI options](#cli-options)
- [Examples](#examples)
- [Output structure](#output-structure)
- [What gets converted](#what-gets-converted)
- [Frontmatter mapping reference](#frontmatter-mapping-reference)

---

## Requirements

- **Node.js** 18 or later
- **npm** 9 or later

---

## Installation

```bash
git clone https://github.com/your-username/claude-to-opencode-ts.git
cd claude-to-opencode-ts
npm install
npm run build
npm link
```

`npm link` registers the `claude-to-opencode` command globally so you can run it from any directory.

To uninstall:

```bash
npm unlink -g claude-to-opencode
```

**Without `npm link` (run directly):**

```bash
node /path/to/claude-to-opencode-ts/dist/index.js --input ./my-project --output ./output
```

---

## Quick start

```bash
# 1. Back up your project first
cp -r ./my-claude-project ./my-claude-project.bak

# 2. Run the converter (interactive mode — prompts for provider and strategy)
claude-to-opencode --input ./my-claude-project --output ./my-opencode-project

# 3. Review the migration report
cat ./my-opencode-project/MIGRATION-REPORT.md
```

---

## How it works

The converter scans the input directory for Claude Code project structure and converts each component to its OpenCode equivalent:

1. **Agents** (`.claude/agents/*.md`) — frontmatter fields are remapped to OpenCode conventions. Model aliases are resolved to fully-qualified provider IDs. The `tools` and `disallowedTools` fields are translated into an OpenCode `permission` dict. Fields with no OpenCode equivalent (e.g. `permissionMode`, `memory`, `effort`) are dropped with a warning.

2. **Commands** (`.claude/commands/*.md`) — `allowed-tools` patterns like `Bash(git add:*)` are converted to OpenCode's `permission` format. Unsupported fields (`argument-hint`, `tags`, `name`) are silently dropped.

3. **Skills** (`.claude/skills/*/SKILL.md`) — only `name` and `description` are preserved. OpenCode skill frontmatter does not support `tools` or `permission` fields, so `allowed-tools` and other Claude-specific fields are dropped with a warning.

4. **CLAUDE.md** — `@filepath` include directives are inlined directly into the output file, since OpenCode does not parse them natively.

5. **MCP servers** (`.mcp.json`) — server definitions are converted from Claude Code format (`command` + `args` + `env`) to OpenCode format (single `command` array + `environment`). Remote HTTP/SSE servers are handled automatically.

6. **Permissions** (`.claude/settings.json`) — `allow` and `deny` permission lists are converted to OpenCode's `permission` block in `opencode.json`. Patterns like `Bash(npm run *)` become `{ bash: { "npm run *": "allow" } }`.

7. **Hooks and path-scoped rules** — these have no OpenCode equivalent. Depending on the `--unsupported` strategy, they are either copied to `_unsupported/` or just documented in the migration report.

---

## CLI options

```
claude-to-opencode --input <path> --output <path> [options]
```

| Flag | Description |
|---|---|
| `-i, --input <path>` | Claude Code project root directory **(required)** |
| `-o, --output <path>` | Output directory for the converted OpenCode project **(required)** |
| `-p, --provider <provider>` | LLM provider for model alias resolution: `anthropic` (default), `openai`, `google` |
| `-u, --unsupported <strategy>` | How to handle unsupported content: `copy-and-report` (default), `report-only` |
| `--dry-run` | Preview all changes without writing any files |
| `--verbose` | Print detailed per-file conversion logs |
| `-y, --yes` | Skip interactive prompts and use defaults |
| `--only <items>` | Convert only specific items (comma-separated): `agents`, `commands`, `skills`, `claude-md`, `mcp`, `rules`, `hooks` |
| `-V, --version` | Print version number |
| `-h, --help` | Show help |

### `--provider`

Controls how bare model aliases are resolved to fully-qualified model IDs:

| Alias | `anthropic` | `openai` | `google` |
|---|---|---|---|
| `opus` | `anthropic/claude-opus-4-5` | — | — |
| `sonnet` | `anthropic/claude-sonnet-4-5` | — | — |
| `haiku` | `anthropic/claude-haiku-4-5` | — | — |
| `gpt-4o` | — | `openai/gpt-4o` | — |
| `gemini-2.5-pro` | — | — | `google/gemini-2.5-pro` |

If a model ID already contains a `/` (e.g. `anthropic/claude-opus-4-5`), it is passed through unchanged. Unknown aliases are left as-is with a warning.

### `--unsupported`

- `copy-and-report` (default) — hooks and path-scoped rules are copied to `_unsupported/` in the output directory and documented in `MIGRATION-REPORT.md`.
- `report-only` — unsupported files are only documented in the report, not copied.

### `--only`

Selectively run specific converters. Useful when you want to re-run only part of a migration:

```bash
# Re-run only the MCP and permissions conversion
claude-to-opencode -i ./project -o ./output --only mcp --yes
```

Available values: `agents`, `commands`, `skills`, `claude-md`, `mcp`, `rules`, `hooks`

---

## Examples

```bash
# Interactive mode — prompts for provider and overwrite strategy
claude-to-opencode --input ./my-project --output ./my-project-opencode

# Dry run: preview everything without writing files
claude-to-opencode -i ./my-project -o ./output --yes --dry-run --verbose

# Convert only agents and commands
claude-to-opencode -i ./my-project -o ./output --yes --only agents,commands

# Use OpenAI model alias resolution
claude-to-opencode -i ./my-project -o ./output --provider openai --yes

# Report-only mode: don't copy unsupported files
claude-to-opencode -i ./my-project -o ./output --unsupported report-only --yes
```

---

## Output structure

```
<output>/
├── .opencode/
│   ├── agents/          # Converted agent files
│   ├── commands/        # Converted command files
│   └── skills/          # Converted skill files (subdirectory names preserved)
├── _unsupported/
│   ├── hooks/           # Copied hook scripts (require manual migration)
│   └── rules/           # Copied path-scoped rules (require manual migration)
├── CLAUDE.md            # With @include references inlined
├── opencode.json        # MCP servers + permissions
└── MIGRATION-REPORT.md  # Full list of warnings, errors, and items needing manual action
```

---

## What gets converted

| Claude Code | OpenCode | Notes |
|---|---|---|
| `.claude/agents/*.md` | `.opencode/agents/*.md` | Frontmatter remapped; model aliases resolved; `tools` → `permission` |
| `.claude/commands/*.md` | `.opencode/commands/*.md` | `allowed-tools` → `permission`; unsupported fields dropped |
| `.claude/skills/*/SKILL.md` | `.opencode/skills/*/SKILL.md` | Only `name`/`description` kept; `allowed-tools` and other Claude-specific fields dropped |
| `CLAUDE.md` | `CLAUDE.md` | `@filepath` includes inlined |
| `.mcp.json` | `opencode.json [mcp]` | MCP server definitions converted to OpenCode format |
| `.claude/settings.json [permissions]` | `opencode.json [permission]` | Allow/deny rules converted |

### Content that cannot be converted automatically

| Claude Code | Status |
|---|---|
| `.claude/hooks/*.sh` | Copied to `_unsupported/hooks/`; documented in migration report |
| `.claude/rules/*.md` (containing `paths:`) | Copied to `_unsupported/rules/`; documented in migration report |
| `settings.json [hooks]` | Documented in report only |
| `settings.json [statusLine]` | Documented in report only |

---

## Frontmatter mapping reference

### Agents

| Claude Code field | OpenCode field | Notes |
|---|---|---|
| `description` | `description` | Preserved; falls back to `name` if missing |
| `model: opus` | `model: anthropic/claude-opus-4-5` | Alias resolved per `--provider` |
| `model: sonnet` | `model: anthropic/claude-sonnet-4-5` | |
| `model: haiku` | `model: anthropic/claude-haiku-4-5` | |
| `model: inherit` | *(dropped)* | Uses session default |
| `maxTurns: 20` | `steps: 20` | |
| `tools: Read, Glob` (no Write/Edit) | `permission: { edit: "deny" }` | |
| `tools: Read, Glob` (no Bash) | `permission: { bash: "deny" }` | |
| `disallowedTools: Bash` | `permission: { bash: "deny" }` | |
| `name` | *(dropped)* | Derived from filename |
| `memory` | *(dropped, warning)* | No OpenCode equivalent |
| `permissionMode` | *(dropped, warning)* | No OpenCode equivalent |
| `effort` | *(dropped, warning)* | No OpenCode equivalent |
| `isolation` | *(dropped, warning)* | No OpenCode equivalent |
| `background` | *(dropped, warning)* | No OpenCode equivalent |
| `color` | *(dropped, warning)* | No OpenCode equivalent |
| `initialPrompt` | *(dropped, warning)* | No OpenCode equivalent |

### Commands

| Claude Code field | OpenCode field | Notes |
|---|---|---|
| `description` | `description` | Preserved |
| `allowed-tools: Bash(git add:*)` | `permission: { bash: { "git add*": "allow" } }` | Pattern syntax converted |
| `allowed-tools: Read` | `permission: { read: "allow" }` | Plain tool name |
| `agent` | `agent` | Preserved |
| `model` | `model` | Preserved |
| `subtask` | `subtask` | Preserved |
| `argument-hint` | *(dropped)* | |
| `tags` | *(dropped)* | |
| `name` | *(dropped)* | |

### Skills

| Claude Code field | OpenCode field | Notes |
|---|---|---|
| `name` | `name` | Preserved |
| `description` | `description` | Preserved |
| `license` | `license` | Preserved |
| `compatibility` | `compatibility` | Preserved |
| `metadata` | `metadata` | Preserved |
| `allowed-tools` | *(dropped, warning)* | No `tools`/`permission` in OpenCode skill frontmatter |
| `user-invocable` | *(dropped)* | |
| `context` | *(dropped)* | |
| `argument-hint` | *(dropped)* | |

### MCP servers

| Claude Code (`.mcp.json`) | OpenCode (`opencode.json`) |
|---|---|
| `command` + `args` | `command: [command, ...args]` |
| `env` | `environment` |
| `type: "http"` + `url` | `type: "remote"` + `url` |
| `type: "sse"` + `url` | `type: "remote"` + `url` |
| `headers` | `headers` |

### Settings permissions

| Claude Code (`.claude/settings.json`) | OpenCode (`opencode.json`) |
|---|---|
| `permissions.allow: ["Bash(npm run *)"]` | `permission: { bash: { "npm run *": "allow" } }` |
| `permissions.deny: ["Bash(curl *)"]` | `permission: { bash: { "curl *": "deny" } }` |
| `permissions.allow: ["Read"]` | `permission: { read: "allow" }` |
