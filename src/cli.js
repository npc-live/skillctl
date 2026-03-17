#!/usr/bin/env node
import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import {
  listSkills, listCliTools, readRegistry,
  syncAllClients, toggleSkill, toggleClient,
  CLIENT_LABELS, CLIENT_SKILL_DIRS, PATHS,
} from './core/registry.js'
import { searchSkills, installSkill, publishSkill, getToken, REGISTRY_URL } from './core/remote.js'

const [,, command, sub, ...rest] = process.argv

const dim = chalk.gray
const ok = chalk.green
const err = chalk.red
const hi = chalk.cyan
const warn = chalk.yellow

function pad(str, n) { return String(str).padEnd(n) }

const HELP = `
  ${hi('skillctl')} — unified skill manager

  ${dim('Local')}
    list                     list installed skills
    enable <name>            enable a skill
    disable <name>           disable a skill
    sync                     sync skills → all enabled clients

  ${dim('Clients')}
    clients                  list clients and their status
    clients enable <id>      enable a client
    clients disable <id>     disable a client

  ${dim('Registry')}
    search [query]           search skillctl.dev registry
    install <name[@ver]>     install a skill from registry
    publish [dir]            publish a skill to registry

  ${dim('CLI Tools')}
    cli                      list registered CLI tools
`

async function main() {
  switch (command) {

    case 'list': {
      const skills = await listSkills()
      if (!skills.length) {
        console.log(dim(`  No skills found in ${PATHS.skills}`))
        console.log(dim(`  Use 'skillctl install <name>' to install from registry\n`))
        break
      }
      console.log()
      console.log(`  ${dim(pad('NAME', 24))}${dim(pad('STATUS', 12))}${dim(pad('CLIENTS', 28))}${dim('DESCRIPTION')}`)
      for (const s of skills) {
        const status = s.enabled ? ok('● enabled') : dim('○ disabled')
        const clients = (s.clients || ['all']).join(',')
        console.log(`  ${hi(pad(s.name, 24))}${pad(status, 21)}${dim(pad(clients, 28))}${dim(s.description?.slice(0, 40) || '')}`)
      }
      console.log()
      break
    }

    case 'enable': {
      if (!sub) { console.error(err('Usage: skillctl enable <name>')); process.exit(1) }
      await toggleSkill(sub, true)
      console.log(`  ${ok('●')} ${sub} enabled`)
      break
    }

    case 'disable': {
      if (!sub) { console.error(err('Usage: skillctl disable <name>')); process.exit(1) }
      await toggleSkill(sub, false)
      console.log(`  ${dim('○')} ${sub} disabled`)
      break
    }

    case 'sync': {
      console.log()
      const results = await syncAllClients()
      for (const [id, r] of Object.entries(results)) {
        const label = (CLIENT_LABELS[id] || id).padEnd(16)
        if (r.skipped) console.log(`  ${dim('○')} ${dim(label)} skipped`)
        else if (r.ok)  console.log(`  ${ok('✓')} ${pad(label, 16)} ${r.count} skills → ${dim(r.path)}`)
        else            console.log(`  ${err('✗')} ${pad(label, 16)} ${err(r.error)}`)
      }
      console.log()
      break
    }

    case 'clients': {
      // clients enable/disable <id>
      if (sub === 'enable' || sub === 'disable') {
        const id = rest[0]
        if (!id) { console.error(err(`Usage: skillctl clients ${sub} <id>`)); process.exit(1) }
        await toggleClient(id, sub === 'enable')
        const symbol = sub === 'enable' ? ok('●') : dim('○')
        console.log(`  ${symbol} ${id} ${sub}d`)
        break
      }
      // clients list
      const registry = await readRegistry()
      console.log()
      for (const [id, label] of Object.entries(CLIENT_LABELS)) {
        const enabled = registry?.clients?.[id]?.enabled ?? false
        const status = enabled ? ok('● enabled') : dim('○ disabled')
        const skillsDir = CLIENT_SKILL_DIRS[id]
        const entries = await fs.readdir(skillsDir).catch(() => [])
        const skills = (await Promise.all(
          entries.map(async e => {
            const s = await fs.lstat(path.join(skillsDir, e)).catch(() => null)
            return s && (s.isDirectory() || s.isSymbolicLink()) ? e : null
          })
        )).filter(Boolean)
        const countStr = skills.length > 0 ? hi(`(${skills.length})`) : dim('(0)')
        console.log(`  ${hi(pad(label, 20))} ${status}  ${countStr}  ${dim(skillsDir)}`)
        for (const name of skills) {
          console.log(`    ${dim('·')} ${name}`)
        }
        console.log()
      }
      break
    }

    case 'search': {
      const query = sub || ''
      process.stdout.write(dim(`  Searching ${REGISTRY_URL}${query ? ` for "${query}"` : ''}...\n`))
      const { skills, total } = await searchSkills(query)
      if (!total) { console.log(dim('  No skills found.\n')); break }
      console.log()
      console.log(`  ${dim(pad('NAME', 24))}${dim(pad('VERSION', 12))}${dim('DESCRIPTION')}`)
      for (const s of skills) {
        console.log(`  ${hi(pad(s.name, 24))}${dim(pad(s.version, 12))}${s.description || ''}`)
      }
      console.log()
      break
    }

    case 'install': {
      if (!sub) { console.error(err('Usage: skillctl install <name>[@version]')); process.exit(1) }
      const [name, version] = sub.split('@')
      process.stdout.write(dim(`  Installing ${name}${version ? `@${version}` : ''}...\n`))
      const result = await installSkill(name, version)
      console.log(`  ${ok('✓')} ${result.name}@${result.version} → ${dim(result.dir)}`)
      break
    }

    case 'publish': {
      const dir = sub ? path.resolve(sub) : process.cwd()
      const token = getToken()
      if (!token) {
        console.error(err('  Error: SKILLCTL_TOKEN is not set.'))
        process.exit(1)
      }
      process.stdout.write(dim(`  Publishing ${dir}...\n`))
      const result = await publishSkill(dir, token)
      console.log(`  ${ok('✓')} ${result.name}@${result.version} published`)
      break
    }

    case 'cli': {
      const tools = await listCliTools()
      if (!tools.length) { console.log(dim(`  No CLI tools in ${PATHS.cli}\n`)); break }
      console.log()
      console.log(`  ${dim(pad('NAME', 24))}${dim(pad('TYPE', 12))}${dim('TARGET')}`)
      for (const t of tools) {
        const type = t.isSymlink ? warn('symlink') : ok('binary')
        console.log(`  ${pad(t.name, 24)}${pad(type, 20)}${dim(t.linkTarget || t.path)}`)
      }
      console.log()
      break
    }

    default: {
      console.log(HELP)
      break
    }
  }
}

main().catch(e => { console.error(err(`\n  Error: ${e.message}\n`)); process.exit(1) })
