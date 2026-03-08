# Spec-Driven Development (SDD) System

A portable, tool-agnostic system for structured software development using AI assistants. Inspired by Kiro's spec-driven workflow.

## Architecture: Thin Pointers + On-Demand Rules

**CLAUDE.md / AGENTS.md should stay under ~100 lines.** They load into _every_ interaction, burning context even when you're just fixing a typo. Instead, this system uses a **thin-pointer architecture**:

```
CLAUDE.md / AGENTS.md           ← Thin (~20 lines). Tells AI that SDD exists.
   └── reads on demand ──→  sdd/RULES.md    ← Full rules (~280 lines). Only loaded during spec work.
       triggered by ──→  .claude/commands/   ← Slash commands: /spec, /design, /tasks, /bugfix, /steering
                         .cursor/rules/      ← Cursor rules with conditional activation
```

The AI only loads the full SDD rules when you actually invoke a spec workflow — not on every chat.

## Quick Start

### 1. Copy the `sdd/` folder into your project root

### 2. Run the setup script

```bash
# Interactive — asks which tools you use
./sdd/setup.sh

# Or specify tools directly
./sdd/setup.sh claude-code cursor

# Or install everything
./sdd/setup.sh --all
```

This installs slash commands, rules, and appends a thin (~10 line) SDD section to your CLAUDE.md / AGENTS.md.

### 3. Generate steering docs and create your first spec
```
/steering                                              ← generate project context
/spec Add user authentication with OAuth2              ← start a feature spec
```

### Manual setup (if you prefer)

**Claude Code** — `cp -r sdd/integrations/claude-code/commands/* .claude/commands/` then append `sdd/integrations/claude-code/CLAUDE.md.snippet` to your CLAUDE.md.

**Cursor** — `cp -r sdd/integrations/cursor/commands/* .cursor/commands/` and `cp -r sdd/integrations/cursor/rules/* .cursor/rules/`.

**OpenCode** — `cp -r sdd/integrations/opencode/commands/* .opencode/commands/` then append the AGENTS.md snippet. Optionally add `"instructions": ["sdd/RULES.md"]` to your `opencode.json` for auto-loading rules.

**Zed + Claude Code agent** — Uses `.claude/commands/` directly. Just set up Claude Code integration.

**Zed first-party agent** — No file-based slash commands. Append `sdd/integrations/agents-md/AGENTS.md.snippet` to AGENTS.md. Type workflow commands as natural language ("Create a spec for...").

**Chat-based LLMs** — Paste the relevant standalone prompt from `sdd/prompts/` into conversation.

## How It Works

Three-phase workflow with mandatory approval gates:

```
[User Prompt] → Requirements → (LGTM) → Design → (LGTM) → Tasks → (LGTM) → Implementation
```

| Phase | File | Format |
|-------|------|--------|
| Requirements | `requirements.md` | EARS notation user stories + acceptance criteria |
| Design | `design.md` | Architecture, Mermaid diagrams, data models, testing strategy |
| Tasks | `tasks.md` | Ordered implementation checklist with requirement traceability |

## Commands

| Command | Claude Code | Cursor | OpenCode | Zed (Claude) | Zed (native) / Chat |
|---------|-------------|--------|----------|---------------|----------------------|
| Feature spec | `/spec [desc]` | `/spec` + desc | `/spec` (prompts for $FEATURE) | `/spec [desc]` | "Create a spec for [desc]" |
| Design-first | `/design-first [desc]` | `/design-first` + desc | `/design-first` (prompts) | `/design-first [desc]` | "Design first: [desc]" |
| Bugfix spec | `/bugfix [desc]` | `/bugfix` + desc | `/bugfix` (prompts for $BUG) | `/bugfix [desc]` | "Bugfix spec for [desc]" |
| Generate tasks | `/tasks [name]` | `/tasks` + name | `/tasks` (prompts) | `/tasks [name]` | "Generate tasks for [spec]" |
| Steering docs | `/steering` | `/steering` | `/steering` | `/steering` | "Generate steering docs" |

> **Cursor**: Type `/spec` to insert the prompt, then add your description in the same message.
> **OpenCode**: Commands use `$NAME` placeholders — OpenCode will prompt you to fill in each argument.

## File Structure

```
your-project/
├── sdd/                              # SDD system (commit to repo)
│   ├── RULES.md                      # Full rules (read on-demand by AI)
│   ├── prompts/                      # Standalone prompts for chat-based LLMs
│   ├── templates/steering/           # Steering doc templates
│   └── integrations/                 # Tool-specific configs (used by setup.sh)
├── .specs/                           # YOUR generated specs (commit to repo)
│   ├── steering/                     # product.md, tech.md, structure.md
│   └── specs/{feature-name}/         # requirements.md, design.md, tasks.md
├── .claude/commands/                 # Claude Code + Zed (Claude agent) slash commands
├── .cursor/
│   ├── commands/                     # Cursor slash commands
│   └── rules/sdd.mdc                # Conditional rule (activates on spec work)
├── .opencode/commands/               # OpenCode slash commands
└── CLAUDE.md / AGENTS.md             # Thin pointer (~10 lines referencing sdd/RULES.md)
```

## Keeping sdd/ Up to Date

Since `sdd/` is copied into each project, you need a way to pull updates when the system evolves.

### Self-update from GitHub

Every project that has `sdd/` includes an update script:

```bash
# Update sdd/ and re-run setup interactively
./sdd/update.sh

# Update and re-run setup for specific tools
./sdd/update.sh claude-code cursor

# Update files only, skip setup
./sdd/update.sh --no-setup
```

This shallow-clones the latest speq repo from GitHub, replaces `sdd/`, and re-runs setup to refresh slash commands and rules.

## Tips

- **Commit everything** — specs, steering docs, and the sdd/ folder all belong in version control
- **One spec per feature** — keep specs focused and atomic
- **Edit specs directly** — they're just markdown
- **Reference specs in chat** — "implement task 3 from the auth spec"
- **Custom steering docs** — add any `.md` file to `.specs/steering/` for domain rules
