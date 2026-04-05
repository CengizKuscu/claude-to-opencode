# claude-to-opencode

> **Uyarı:** Bu deneysel bir çalışmadır ve ciddi testlerden geçmemiştir. Kullanmadan önce bunu göz önünde bulundurun. **Dönüştürücüyü çalıştırmadan önce mutlaka projenizin yedeğini alın** — çıktının doğruluğu veya eksiksizliği konusunda herhangi bir garanti verilmemektedir.

[Claude Code](https://claude.ai/code) projelerini [OpenCode](https://opencode.ai) formatına dönüştüren CLI aracı.

Agent'lar, command'lar, skill'ler, `CLAUDE.md`, MCP sunucuları ve izin ayarlarını otomatik olarak dönüştürür. Desteklenmeyen içerikler (hook'lar, path bazlı rule'lar) migration raporu ile belgelenir.

**Dokümantasyon:**
- Claude Code: https://docs.anthropic.com/en/docs/claude-code/overview
- OpenCode: https://opencode.ai/docs

> English version: [README.md](./README.md)

---

## İçindekiler

- [Gereksinimler](#gereksinimler)
- [Kurulum](#kurulum)
- [Hızlı başlangıç](#hızlı-başlangıç)
- [Nasıl çalışır](#nasıl-çalışır)
- [CLI seçenekleri](#cli-seçenekleri)
- [Örnekler](#örnekler)
- [Çıktı yapısı](#çıktı-yapısı)
- [Neler dönüştürülür](#neler-dönüştürülür)
- [Frontmatter eşleme referansı](#frontmatter-eşleme-referansı)

---

## Gereksinimler

- **Node.js** 18 veya üzeri
- **npm** 9 veya üzeri

---

## Kurulum

```bash
git clone https://github.com/your-username/claude-to-opencode-ts.git
cd claude-to-opencode-ts
npm install
npm run build
npm link
```

`npm link` komutu `claude-to-opencode` komutunu global olarak kaydeder; böylece her dizinden çalıştırabilirsiniz.

Kaldırmak için:

```bash
npm unlink -g claude-to-opencode
```

**`npm link` olmadan direkt çalıştırmak için:**

```bash
node /path/to/claude-to-opencode-ts/dist/index.js --input ./projem --output ./cikti
```

---

## Hızlı başlangıç

```bash
# 1. Önce projenizin yedeğini alın
cp -r ./claude-projem ./claude-projem.bak

# 2. Dönüştürücüyü çalıştırın (etkileşimli mod — provider ve strateji sorar)
claude-to-opencode --input ./claude-projem --output ./opencode-projem

# 3. Migration raporunu inceleyin
cat ./opencode-projem/MIGRATION-REPORT.md
```

---

## Nasıl çalışır

Dönüştürücü, girdi dizinini Claude Code proje yapısı için tarar ve her bileşeni OpenCode karşılığına dönüştürür:

1. **Agent'lar** (`.claude/agents/*.md`) — frontmatter alanları OpenCode kurallarına göre yeniden eşlenir. Model alias'ları tam nitelikli provider ID'lerine çözülür. `tools` ve `disallowedTools` alanları OpenCode `permission` sözlüğüne çevrilir. OpenCode karşılığı olmayan alanlar (ör. `permissionMode`, `memory`, `effort`) uyarı verilerek kaldırılır.

2. **Command'lar** (`.claude/commands/*.md`) — `Bash(git add:*)` gibi `allowed-tools` kalıpları OpenCode'un `permission` formatına dönüştürülür. Desteklenmeyen alanlar (`argument-hint`, `tags`, `name`) sessizce kaldırılır.

3. **Skill'ler** (`.claude/skills/*/SKILL.md`) — yalnızca `name` ve `description` korunur. OpenCode skill frontmatter'ı `tools` veya `permission` alanlarını desteklemediğinden `allowed-tools` ve diğer Claude'a özgü alanlar uyarı verilerek kaldırılır.

4. **CLAUDE.md** — OpenCode `@filepath` include direktiflerini doğrudan ayrıştırmadığından bu referanslar çıktı dosyasına gömülür.

5. **MCP sunucuları** (`.mcp.json`) — sunucu tanımları Claude Code formatından (`command` + `args` + `env`) OpenCode formatına (`command` dizisi + `environment`) dönüştürülür. Uzak HTTP/SSE sunucuları otomatik olarak işlenir.

6. **İzinler** (`.claude/settings.json`) — `allow` ve `deny` izin listeleri `opencode.json` içindeki OpenCode `permission` bloğuna dönüştürülür. `Bash(npm run *)` gibi kalıplar `{ bash: { "npm run *": "allow" } }` biçimine çevrilir.

7. **Hook'lar ve path bazlı rule'lar** — bunların OpenCode karşılığı yoktur. `--unsupported` stratejisine bağlı olarak ya `_unsupported/` dizinine kopyalanır ya da yalnızca migration raporunda belgelenir.

---

## CLI seçenekleri

```
claude-to-opencode --input <path> --output <path> [seçenekler]
```

| Flag | Açıklama |
|---|---|
| `-i, --input <path>` | Claude Code proje kök dizini **(zorunlu)** |
| `-o, --output <path>` | Dönüştürülmüş OpenCode projesi için çıktı dizini **(zorunlu)** |
| `-p, --provider <provider>` | Model alias çözümlemesi için LLM sağlayıcı: `anthropic` (varsayılan), `openai`, `google` |
| `-u, --unsupported <strateji>` | Desteklenmeyen içerikler için strateji: `copy-and-report` (varsayılan), `report-only` |
| `--dry-run` | Dosya yazmadan tüm değişiklikleri önizle |
| `--verbose` | Dosya bazında ayrıntılı dönüşüm logları göster |
| `-y, --yes` | Etkileşimli soruları atla, varsayılanları kullan |
| `--only <öğeler>` | Yalnızca belirtilen öğeleri dönüştür (virgülle ayrılmış): `agents`, `commands`, `skills`, `claude-md`, `mcp`, `rules`, `hooks` |
| `-V, --version` | Sürüm numarasını göster |
| `-h, --help` | Yardımı göster |

### `--provider`

Kısa model alias'larının tam nitelikli model ID'lerine nasıl çözüleceğini belirler:

| Alias | `anthropic` | `openai` | `google` |
|---|---|---|---|
| `opus` | `anthropic/claude-opus-4-5` | — | — |
| `sonnet` | `anthropic/claude-sonnet-4-5` | — | — |
| `haiku` | `anthropic/claude-haiku-4-5` | — | — |
| `gpt-4o` | — | `openai/gpt-4o` | — |
| `gemini-2.5-pro` | — | — | `google/gemini-2.5-pro` |

Model ID'si zaten `/` içeriyorsa (ör. `anthropic/claude-opus-4-5`) olduğu gibi aktarılır. Bilinmeyen alias'lar uyarı verilerek aynen bırakılır.

### `--unsupported`

- `copy-and-report` (varsayılan) — hook'lar ve path bazlı rule'lar çıktı dizinindeki `_unsupported/` klasörüne kopyalanır ve `MIGRATION-REPORT.md`'de belgelenir.
- `report-only` — desteklenmeyen dosyalar yalnızca raporda belgelenir, kopyalanmaz.

### `--only`

Belirli dönüştürücüleri seçerek çalıştırır. Migration'ın yalnızca bir bölümünü yeniden çalıştırmak istediğinizde kullanışlıdır:

```bash
# Yalnızca MCP ve izin dönüşümünü yeniden çalıştır
claude-to-opencode -i ./proje -o ./cikti --only mcp --yes
```

Kullanılabilir değerler: `agents`, `commands`, `skills`, `claude-md`, `mcp`, `rules`, `hooks`

---

## Örnekler

```bash
# Etkileşimli mod — provider ve üzerine yazma stratejisini sorar
claude-to-opencode --input ./projem --output ./projem-opencode

# Dry run: dosya yazmadan her şeyi önizle
claude-to-opencode -i ./projem -o ./cikti --yes --dry-run --verbose

# Yalnızca agent ve command'ları dönüştür
claude-to-opencode -i ./projem -o ./cikti --yes --only agents,commands

# OpenAI model alias çözümlemesini kullan
claude-to-opencode -i ./projem -o ./cikti --provider openai --yes

# Report-only modu: desteklenmeyen dosyaları kopyalama
claude-to-opencode -i ./projem -o ./cikti --unsupported report-only --yes
```

---

## Çıktı yapısı

```
<output>/
├── .opencode/
│   ├── agents/          # Dönüştürülmüş agent dosyaları
│   ├── commands/        # Dönüştürülmüş command dosyaları
│   └── skills/          # Dönüştürülmüş skill dosyaları (alt dizin isimleri korunur)
├── _unsupported/
│   ├── hooks/           # Kopyalanmış hook script'leri (manuel migration gerekir)
│   └── rules/           # Kopyalanmış path-scoped rule'lar (manuel migration gerekir)
├── CLAUDE.md            # @include referansları gömülmüş haliyle
├── opencode.json        # MCP sunucuları + izinler
└── MIGRATION-REPORT.md  # Uyarıların, hataların ve manuel aksiyon gerektiren öğelerin tam listesi
```

---

## Neler dönüştürülür

| Claude Code | OpenCode | Notlar |
|---|---|---|
| `.claude/agents/*.md` | `.opencode/agents/*.md` | Frontmatter yeniden eşlenir; model alias'ları çözülür; `tools` → `permission` |
| `.claude/commands/*.md` | `.opencode/commands/*.md` | `allowed-tools` → `permission`; desteklenmeyen alanlar kaldırılır |
| `.claude/skills/*/SKILL.md` | `.opencode/skills/*/SKILL.md` | Yalnızca `name`/`description` korunur; `allowed-tools` ve diğer Claude'a özgü alanlar kaldırılır |
| `CLAUDE.md` | `CLAUDE.md` | `@filepath` include'ları gömülür |
| `.mcp.json` | `opencode.json [mcp]` | MCP sunucu tanımları OpenCode formatına dönüştürülür |
| `.claude/settings.json [permissions]` | `opencode.json [permission]` | Allow/deny kuralları dönüştürülür |

### Otomatik dönüştürülemeyen içerikler

| Claude Code | Durum |
|---|---|
| `.claude/hooks/*.sh` | `_unsupported/hooks/` altına kopyalanır; migration raporunda belgelenir |
| `.claude/rules/*.md` (`paths:` içerenler) | `_unsupported/rules/` altına kopyalanır; migration raporunda belgelenir |
| `settings.json [hooks]` | Yalnızca raporda belgelenir |
| `settings.json [statusLine]` | Yalnızca raporda belgelenir |

---

## Frontmatter eşleme referansı

### Agent'lar

| Claude Code alanı | OpenCode alanı | Notlar |
|---|---|---|
| `description` | `description` | Korunur; yoksa `name` kullanılır |
| `model: opus` | `model: anthropic/claude-opus-4-5` | Alias `--provider`'a göre çözülür |
| `model: sonnet` | `model: anthropic/claude-sonnet-4-5` | |
| `model: haiku` | `model: anthropic/claude-haiku-4-5` | |
| `model: inherit` | *(kaldırılır)* | Oturum varsayılanını kullanır |
| `maxTurns: 20` | `steps: 20` | |
| `tools: Read, Glob` (Write/Edit yok) | `permission: { edit: "deny" }` | |
| `tools: Read, Glob` (Bash yok) | `permission: { bash: "deny" }` | |
| `disallowedTools: Bash` | `permission: { bash: "deny" }` | |
| `name` | *(kaldırılır)* | Dosya adından türetilir |
| `memory` | *(kaldırılır, uyarı)* | OpenCode karşılığı yok |
| `permissionMode` | *(kaldırılır, uyarı)* | OpenCode karşılığı yok |
| `effort` | *(kaldırılır, uyarı)* | OpenCode karşılığı yok |
| `isolation` | *(kaldırılır, uyarı)* | OpenCode karşılığı yok |
| `background` | *(kaldırılır, uyarı)* | OpenCode karşılığı yok |
| `color` | *(kaldırılır, uyarı)* | OpenCode karşılığı yok |
| `initialPrompt` | *(kaldırılır, uyarı)* | OpenCode karşılığı yok |

### Command'lar

| Claude Code alanı | OpenCode alanı | Notlar |
|---|---|---|
| `description` | `description` | Korunur |
| `allowed-tools: Bash(git add:*)` | `permission: { bash: { "git add*": "allow" } }` | Kalıp sözdizimi dönüştürülür |
| `allowed-tools: Read` | `permission: { read: "allow" }` | Sade araç adı |
| `agent` | `agent` | Korunur |
| `model` | `model` | Korunur |
| `subtask` | `subtask` | Korunur |
| `argument-hint` | *(kaldırılır)* | |
| `tags` | *(kaldırılır)* | |
| `name` | *(kaldırılır)* | |

### Skill'ler

| Claude Code alanı | OpenCode alanı | Notlar |
|---|---|---|
| `name` | `name` | Korunur |
| `description` | `description` | Korunur |
| `license` | `license` | Korunur |
| `compatibility` | `compatibility` | Korunur |
| `metadata` | `metadata` | Korunur |
| `allowed-tools` | *(kaldırılır, uyarı)* | OpenCode skill frontmatter'ında `tools`/`permission` alanı yok |
| `user-invocable` | *(kaldırılır)* | |
| `context` | *(kaldırılır)* | |
| `argument-hint` | *(kaldırılır)* | |

### MCP sunucuları

| Claude Code (`.mcp.json`) | OpenCode (`opencode.json`) |
|---|---|
| `command` + `args` | `command: [command, ...args]` |
| `env` | `environment` |
| `type: "http"` + `url` | `type: "remote"` + `url` |
| `type: "sse"` + `url` | `type: "remote"` + `url` |
| `headers` | `headers` |

### Settings izinleri

| Claude Code (`.claude/settings.json`) | OpenCode (`opencode.json`) |
|---|---|
| `permissions.allow: ["Bash(npm run *)"]` | `permission: { bash: { "npm run *": "allow" } }` |
| `permissions.deny: ["Bash(curl *)"]` | `permission: { bash: { "curl *": "deny" } }` |
| `permissions.allow: ["Read"]` | `permission: { read: "allow" }` |
