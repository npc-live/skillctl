import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

export const AGENT_HOME = path.join(os.homedir(), '.skillctl')

export const PATHS = {
  root: AGENT_HOME,
  skills: path.join(AGENT_HOME, 'skills'),
  cli: path.join(AGENT_HOME, 'cli'),
  registry: path.join(AGENT_HOME, 'registry.yaml'),
}

export const CLIENT_SKILL_DIRS = {
  'claude-code': path.join(os.homedir(), '.claude', 'skills'),
  cursor: path.join(os.homedir(), '.cursor', 'skills'),
  windsurf: path.join(os.homedir(), '.codeium', 'windsurf', 'skills'),
  opencode: path.join(os.homedir(), '.config', 'opencode', 'skills'),
  openclaw: path.join(os.homedir(), '.openclaw', 'skills'),
}

export const CLIENT_LABELS = {
  'claude-code': 'Claude Code',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  opencode: 'OpenCode',
  openclaw: 'OpenClaw',
}

export async function ensureAgentHome() {
  await fs.ensureDir(PATHS.skills)
  await fs.ensureDir(PATHS.cli)
  if (!await fs.pathExists(PATHS.registry)) {
    await fs.writeFile(PATHS.registry, stringifyYaml({
      version: 1,
      skills: {},
      clients: {
        'claude-code': { enabled: true },
        cursor: { enabled: true },
        windsurf: { enabled: false },
        opencode: { enabled: true },
        openclaw: { enabled: true },
      }
    }))
  }
}

export async function readRegistry() {
  await ensureAgentHome()
  const raw = await fs.readFile(PATHS.registry, 'utf-8')
  return parseYaml(raw)
}

export async function writeRegistry(data) {
  await fs.writeFile(PATHS.registry, stringifyYaml(data))
}

function parseSkillMd(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  try { return parseYaml(match[1]) } catch { return {} }
}

export async function listSkills() {
  await ensureAgentHome()
  const registry = await readRegistry()
  const entries = await fs.readdir(PATHS.skills).catch(() => [])

  const results = []
  for (const entry of entries) {
    const fullPath = path.join(PATHS.skills, entry)
    const stat = await fs.lstat(fullPath)
    if (!stat.isDirectory() && !stat.isSymbolicLink()) continue

    const skillMdPath = path.join(fullPath, 'SKILL.md')
    if (!await fs.pathExists(skillMdPath)) continue

    const isSymlink = stat.isSymbolicLink()
    let frontmatter = {}
    try {
      const content = await fs.readFile(skillMdPath, 'utf-8')
      frontmatter = parseSkillMd(content)
    } catch {}

    const name = frontmatter.name || entry
    const regEntry = registry.skills?.[name] || {}
    results.push({
      name,
      dir: fullPath,
      isSymlink,
      enabled: regEntry.enabled ?? true,
      clients: regEntry.clients ?? Object.keys(CLIENT_SKILL_DIRS),
      description: frontmatter.description || name,
    })
  }
  return results
}

export async function listCliTools() {
  await ensureAgentHome()
  const files = await fs.readdir(PATHS.cli).catch(() => [])
  return Promise.all(files.map(async (file) => {
    const fullPath = path.join(PATHS.cli, file)
    const stat = await fs.lstat(fullPath)
    const isSymlink = stat.isSymbolicLink()
    let linkTarget = null
    if (isSymlink) linkTarget = await fs.readlink(fullPath)
    return {
      name: file,
      path: fullPath,
      isSymlink,
      linkTarget,
      executable: !!(stat.mode & 0o111),
    }
  }))
}

export async function syncAllClients() {
  const registry = await readRegistry()
  const skills = await listSkills()
  const results = {}

  for (const [clientId, clientConf] of Object.entries(registry.clients || {})) {
    if (!clientConf.enabled) {
      results[clientId] = { skipped: true }
      continue
    }
    const skillsDir = CLIENT_SKILL_DIRS[clientId]
    if (!skillsDir) {
      results[clientId] = { skipped: true }
      continue
    }
    await fs.ensureDir(skillsDir)

    let count = 0
    for (const skill of skills) {
      if (!skill.enabled) continue
      if (skill.clients && !skill.clients.includes(clientId)) continue

      const linkPath = path.join(skillsDir, skill.name)
      const existing = await fs.lstat(linkPath).catch(() => null)
      if (existing) await fs.remove(linkPath)
      await fs.symlink(skill.dir, linkPath)
      count++
    }

    results[clientId] = { ok: true, path: skillsDir, count }
  }

  return results
}

export async function linkCliTool(sourcePath, name) {
  const targetName = name || path.basename(sourcePath)
  const linkPath = path.join(PATHS.cli, targetName)
  await fs.ensureDir(PATHS.cli)
  if (await fs.pathExists(linkPath)) await fs.remove(linkPath)
  await fs.symlink(sourcePath, linkPath)
  return linkPath
}

export async function toggleSkill(name, enabled) {
  const registry = await readRegistry()
  if (!registry.skills) registry.skills = {}
  if (!registry.skills[name]) registry.skills[name] = {}
  registry.skills[name].enabled = enabled
  await writeRegistry(registry)
}

export async function toggleClient(id, enabled) {
  const registry = await readRegistry()
  if (!registry.clients) registry.clients = {}
  if (!registry.clients[id]) registry.clients[id] = {}
  registry.clients[id].enabled = enabled
  await writeRegistry(registry)
}
