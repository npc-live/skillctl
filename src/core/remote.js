import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import { execa } from 'execa'
import { parse as parseYaml } from 'yaml'
import { PATHS } from './registry.js'

export const REGISTRY_URL = 'https://api.skillctl.dev'

export function getToken() {
  return process.env.SKILLCTL_TOKEN || null
}

export async function searchSkills(query = '') {
  const url = query
    ? `${REGISTRY_URL}/v1/skills?q=${encodeURIComponent(query)}`
    : `${REGISTRY_URL}/v1/skills`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Registry error: ${res.status}`)
  return res.json()
}

export async function getSkillInfo(name) {
  const res = await fetch(`${REGISTRY_URL}/v1/skills/${name}`)
  if (!res.ok) throw new Error(`Skill not found: ${name}`)
  return res.json()
}

export async function installSkill(name, version) {
  const meta = await getSkillInfo(name)
  const ver = version || meta.version
  const tmpFile = path.join(os.tmpdir(), `${name}-${ver}.tar.gz`)
  const destDir = path.join(PATHS.skills, name)

  const res = await fetch(`${REGISTRY_URL}/v1/skills/${name}/${ver}.tar.gz`)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)

  const buffer = await res.arrayBuffer()
  await fs.writeFile(tmpFile, Buffer.from(buffer))

  await fs.ensureDir(destDir)
  await execa('tar', ['-xzf', tmpFile, '-C', destDir, '--strip-components=1'])
  await fs.remove(tmpFile)

  return { name, version: ver, dir: destDir }
}

export async function publishSkill(skillDir, token) {
  const skillMdPath = path.join(skillDir, 'SKILL.md')
  if (!await fs.pathExists(skillMdPath)) {
    throw new Error(`No SKILL.md found in ${skillDir}`)
  }

  const content = await fs.readFile(skillMdPath, 'utf-8')
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) throw new Error('No frontmatter found in SKILL.md')

  const meta = parseYaml(match[1])
  if (!meta.name) throw new Error('"name" is required in SKILL.md frontmatter')
  if (!meta.version) throw new Error('"version" is required in SKILL.md frontmatter')

  const tmpFile = path.join(os.tmpdir(), `${meta.name}-${meta.version}.tar.gz`)
  await execa('tar', ['-czf', tmpFile, '-C', path.dirname(skillDir), path.basename(skillDir)])

  const buffer = await fs.readFile(tmpFile)
  await fs.remove(tmpFile)

  const params = new URLSearchParams({
    version: meta.version,
    description: meta.description || '',
    author: meta.author || '',
  })

  const res = await fetch(`${REGISTRY_URL}/v1/skills/${meta.name}?${params}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/gzip',
    },
    body: buffer,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Publish failed: ${res.status}`)
  }
  return res.json()
}
