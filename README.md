# skillctl

Unified skill manager for AI coding tools. Install skills from the registry, sync them to Claude Code, Cursor, Windsurf, OpenCode, and OpenClaw with a single command.

```bash
npm install -g @harness.farm/skillctl
```

## What is a skill?

A skill is a `SKILL.md` file that extends what an AI coding tool can do. Skills follow the open [AgentSkills](https://agentskills.io) standard and work across all supported clients.

```
my-skill/
├── SKILL.md        # instructions + frontmatter (required)
├── examples/       # optional supporting files
└── scripts/
```

```yaml
# SKILL.md
---
name: my-skill
version: 1.0.0
description: What this skill does and when to use it
---

Your instructions here...
```

## Commands

### Local management

```bash
skillctl list                   # list installed skills
skillctl enable <name>          # enable a skill
skillctl disable <name>         # disable a skill
skillctl sync                   # sync skills to all enabled clients
```

### Clients

```bash
skillctl clients                # show all clients and their status
skillctl clients enable <id>    # enable a client
skillctl clients disable <id>   # disable a client
```

Client IDs: `claude-code`, `cursor`, `windsurf`, `opencode`, `openclaw`

### Registry

```bash
skillctl search                 # browse all skills
skillctl search <query>         # search by name or description
skillctl install <name>         # install latest version
skillctl install <name>@<ver>   # install specific version
skillctl publish [dir]          # publish current dir (or specified dir)
```

### CLI Tools

```bash
skillctl cli                    # list registered CLI tools
```

## How sync works

Skills are stored in `~/.skillctl/skills/`. When you run `skillctl sync`, each enabled skill is symlinked into the skills directory of every enabled client:

| Client | Skills directory |
|--------|-----------------|
| Claude Code | `~/.claude/skills/` |
| Cursor | `~/.cursor/skills/` |
| Windsurf | `~/.codeium/windsurf/skills/` |
| OpenCode | `~/.config/opencode/skills/` |
| OpenClaw | `~/.openclaw/skills/` |

Sync uses a **merge** strategy: skillctl only writes its own skills and never removes skills you created manually in those directories.

## Publishing

Set your publish token, then run publish from a skill directory:

```bash
export SKILLCTL_TOKEN=your_token
skillctl publish ./my-skill
```

The skill directory must contain a `SKILL.md` with `name` and `version` in the frontmatter. Once published, anyone can install it:

```bash
skillctl install my-skill
```

Browse published skills at [skillctl.dev/marketplace](https://skillctl.dev/marketplace).

## Config

Skills and registry state are stored in `~/.skillctl/`:

```
~/.skillctl/
├── skills/          # installed skills
├── cli/             # registered CLI tools
└── registry.yaml    # enabled/disabled state per skill and client
```

## Example workflow

```bash
# Find and install a skill
skillctl search design
skillctl install next-variant

# Sync to all your AI tools
skillctl sync

# Check what's installed
skillctl list

# Disable for a specific client by editing ~/.skillctl/registry.yaml
# or disable the client entirely
skillctl clients disable windsurf
```
