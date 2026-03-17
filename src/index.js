import React, { useState, useEffect, useCallback } from 'react'
import { render, Box, Text, useInput, useApp } from 'ink'
import {
  listSkills, listCliTools, syncAllClients,
  toggleSkill, toggleClient, readRegistry,
  CLIENT_LABELS, CLIENT_SKILL_DIRS, PATHS
} from './core/registry.js'

// ─── Color palette ────────────────────────────────────────────────────────────
const C = {
  bg: '#0d1117',
  panel: '#161b22',
  border: '#30363d',
  accent: '#58a6ff',
  green: '#3fb950',
  red: '#f85149',
  yellow: '#e3b341',
  muted: '#8b949e',
  white: '#e6edf3',
  purple: '#bc8cff',
  orange: '#ffa657',
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = ['Skills', 'CLI Tools', 'Clients', 'Sync']

// ─── Components ───────────────────────────────────────────────────────────────

function Header({ activeTab }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color={C.accent}>⬡ skillctl </Text>
        <Text color={C.muted}>— unified MCP skill & CLI manager</Text>
      </Box>
      <Box marginTop={0}>
        {TABS.map((tab, i) => (
          <Box key={tab} marginRight={2}>
            {i === activeTab
              ? <Text bold color={C.bg} backgroundColor={C.accent}> {tab} </Text>
              : <Text color={C.muted}> {tab} </Text>
            }
          </Box>
        ))}
      </Box>
      <Text color={C.border}>{'─'.repeat(60)}</Text>
    </Box>
  )
}

function StatusBadge({ enabled }) {
  return enabled
    ? <Text color={C.green}>● </Text>
    : <Text color={C.muted}>○ </Text>
}

function SkillsTab({ skills, cursor }) {
  if (skills.length === 0) {
    return (
      <Box flexDirection="column" paddingLeft={1}>
        <Text color={C.muted}>No skills found in </Text>
        <Text color={C.yellow}>{PATHS.skills}</Text>
        <Box marginTop={1}>
          <Text color={C.muted}>Add skill directories with SKILL.md to get started.</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={C.muted}>Example: </Text>
          <Text color={C.accent}>~/.skillctl/skills/my-skill/SKILL.md</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} paddingLeft={1}>
        <Text color={C.muted}>{'NAME'.padEnd(22)}</Text>
        <Text color={C.muted}>{'STATUS'.padEnd(10)}</Text>
        <Text color={C.muted}>{'CLIENTS'.padEnd(30)}</Text>
        <Text color={C.muted}>DESCRIPTION</Text>
      </Box>
      {skills.map((skill, i) => {
        const selected = i === cursor
        const bg = selected ? C.panel : undefined
        return (
          <Box key={skill.name} paddingLeft={1} backgroundColor={bg}>
            <Text color={selected ? C.white : C.muted} bold={selected}>
              {selected ? '▸ ' : '  '}
            </Text>
            <Text color={selected ? C.accent : C.white} bold={selected}>
              {skill.name.padEnd(20)}
            </Text>
            <StatusBadge enabled={skill.enabled} />
            <Text color={skill.enabled ? C.green : C.muted}>
              {(skill.enabled ? 'enabled' : 'disabled').padEnd(9)}
            </Text>
            <Text color={C.purple}>
              {(skill.clients?.join(',') || 'all').padEnd(28)}
            </Text>
            <Text color={C.muted}>
              {skill.description?.slice(0, 35) || ''}
            </Text>
          </Box>
        )
      })}
      <Box marginTop={1} paddingLeft={1}>
        <Text color={C.muted}>space: toggle  ↑↓: navigate</Text>
      </Box>
    </Box>
  )
}

function CliTab({ tools, cursor }) {
  if (tools.length === 0) {
    return (
      <Box flexDirection="column" paddingLeft={1}>
        <Text color={C.muted}>No CLI tools registered.</Text>
        <Box marginTop={1}>
          <Text color={C.muted}>Directory: </Text>
          <Text color={C.yellow}>{PATHS.cli}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={C.muted}>Binaries here are auto-symlinked to </Text>
          <Text color={C.accent}>/usr/local/bin</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} paddingLeft={1}>
        <Text color={C.muted}>{'NAME'.padEnd(24)}</Text>
        <Text color={C.muted}>{'TYPE'.padEnd(12)}</Text>
        <Text color={C.muted}>TARGET</Text>
      </Box>
      {tools.map((tool, i) => {
        const selected = i === cursor
        return (
          <Box key={tool.name} paddingLeft={1}>
            <Text color={selected ? C.white : C.muted}>{selected ? '▸ ' : '  '}</Text>
            <Text color={selected ? C.accent : C.white} bold={selected}>
              {tool.name.padEnd(22)}
            </Text>
            <Text color={tool.isSymlink ? C.purple : C.orange}>
              {(tool.isSymlink ? '⟶ symlink' : '  binary').padEnd(12)}
            </Text>
            <Text color={C.muted}>
              {tool.linkTarget || tool.path}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}

function ClientsTab({ registry, cursor }) {
  const clients = Object.entries(CLIENT_LABELS)
  return (
    <Box flexDirection="column">
      <Box marginBottom={1} paddingLeft={1}>
        <Text color={C.muted}>{'CLIENT'.padEnd(18)}</Text>
        <Text color={C.muted}>{'STATUS'.padEnd(12)}</Text>
        <Text color={C.muted}>CONFIG PATH</Text>
      </Box>
      {clients.map(([id, label], i) => {
        const selected = i === cursor
        const enabled = registry?.clients?.[id]?.enabled ?? false
        return (
          <Box key={id} paddingLeft={1}>
            <Text color={selected ? C.white : C.muted}>{selected ? '▸ ' : '  '}</Text>
            <Text color={selected ? C.accent : C.white} bold={selected}>
              {label.padEnd(16)}
            </Text>
            <StatusBadge enabled={enabled} />
            <Text color={enabled ? C.green : C.muted}>
              {(enabled ? 'enabled' : 'disabled').padEnd(11)}
            </Text>
            <Text color={C.muted}>
              {CLIENT_SKILL_DIRS[id]}
            </Text>
          </Box>
        )
      })}
      <Box marginTop={1} paddingLeft={1}>
        <Text color={C.muted}>space: toggle client sync  ↑↓: navigate</Text>
      </Box>
    </Box>
  )
}

function SyncTab({ syncResult, syncing }) {
  if (syncing) {
    return (
      <Box paddingLeft={1}>
        <Text color={C.yellow}>⟳ Syncing all clients...</Text>
      </Box>
    )
  }

  if (!syncResult) {
    return (
      <Box flexDirection="column" paddingLeft={1}>
        <Text color={C.muted}>Press </Text>
        <Text color={C.accent}>s</Text>
        <Text color={C.muted}> to sync skills → all enabled clients</Text>
        <Box marginTop={1}>
          <Text color={C.muted}>This will:</Text>
        </Box>
        <Box paddingLeft={2} flexDirection="column">
          <Text color={C.muted}>1. Read enabled skills from ~/.skillctl/skills/</Text>
          <Text color={C.muted}>2. Symlink each skill dir into client's skills/ dir</Text>
          <Text color={C.muted}>3. Existing skills in target dirs are not removed</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Text color={C.green} bold>✓ Sync complete</Text>
      <Box marginTop={1} flexDirection="column">
        {Object.entries(syncResult).map(([client, result]) => (
          <Box key={client}>
            <Text color={result.skipped ? C.muted : result.ok ? C.green : C.red}>
              {result.skipped ? '○' : result.ok ? '✓' : '✗'}
            </Text>
            <Text color={C.white}> {CLIENT_LABELS[client]?.padEnd(16)}</Text>
            {result.skipped && <Text color={C.muted}> skipped (disabled)</Text>}
            {result.ok && <Text color={C.muted}> {result.count} skills → {result.path}</Text>}
            {result.error && <Text color={C.red}> {result.error}</Text>}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function Footer({ tab }) {
  const hints = {
    0: 'tab: switch  space: toggle skill  r: refresh  q: quit',
    1: 'tab: switch  r: refresh  q: quit',
    2: 'tab: switch  space: toggle client  r: refresh  q: quit',
    3: 'tab: switch  s: sync now  q: quit',
  }
  return (
    <Box marginTop={1}>
      <Text color={C.border}>{'─'.repeat(60)}</Text>
      <Text color={C.muted}>{'\n'}{hints[tab]}</Text>
    </Box>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const { exit } = useApp()
  const [tab, setTab] = useState(0)
  const [cursor, setCursor] = useState(0)
  const [skills, setSkills] = useState([])
  const [cliTools, setCliTools] = useState([])
  const [registry, setRegistry] = useState(null)
  const [syncResult, setSyncResult] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [s, c, r] = await Promise.all([listSkills(), listCliTools(), readRegistry()])
    setSkills(s)
    setCliTools(c)
    setRegistry(r)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [])

  const tabLengths = [skills.length, cliTools.length, Object.keys(CLIENT_LABELS).length, 0]

  useInput((input, key) => {
    if (input === 'q') { exit(); return }
    if (key.tab || input === 'l') {
      setTab(t => (t + 1) % TABS.length)
      setCursor(0)
      return
    }
    if (input === 'h') {
      setTab(t => (t - 1 + TABS.length) % TABS.length)
      setCursor(0)
      return
    }
    if (input === 'r') { refresh(); return }

    if (key.upArrow) {
      setCursor(c => Math.max(0, c - 1))
      return
    }
    if (key.downArrow) {
      const max = tabLengths[tab] - 1
      setCursor(c => Math.min(max, c + 1))
      return
    }

    if (input === ' ') {
      if (tab === 0 && skills[cursor]) {
        const skill = skills[cursor]
        toggleSkill(skill.name, !skill.enabled).then(refresh)
      }
      if (tab === 2) {
        const clientId = Object.keys(CLIENT_LABELS)[cursor]
        const current = registry?.clients?.[clientId]?.enabled ?? false
        toggleClient(clientId, !current).then(refresh)
      }
      return
    }

    if (input === 's' && tab === 3) {
      setSyncing(true)
      setSyncResult(null)
      syncAllClients().then(r => {
        setSyncResult(r)
        setSyncing(false)
      })
      return
    }
  })

  if (loading) {
    return (
      <Box>
        <Text color={C.yellow}>⟳ Loading skillctl...</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      <Header activeTab={tab} />
      {tab === 0 && <SkillsTab skills={skills} cursor={cursor} />}
      {tab === 1 && <CliTab tools={cliTools} cursor={cursor} />}
      {tab === 2 && <ClientsTab registry={registry} cursor={cursor} />}
      {tab === 3 && <SyncTab syncResult={syncResult} syncing={syncing} />}
      <Footer tab={tab} />
    </Box>
  )
}

export function startTUI() {
  render(<App />)
}
