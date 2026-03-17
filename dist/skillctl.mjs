// src/index.js
import React, { useState, useEffect, useCallback } from "react";
import { render, Box, Text, useInput, useApp } from "ink";

// src/core/registry.js
import fs from "fs-extra";
import path from "path";
import os from "os";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
var AGENT_HOME = path.join(os.homedir(), ".skillctl");
var PATHS = {
  root: AGENT_HOME,
  skills: path.join(AGENT_HOME, "skills"),
  cli: path.join(AGENT_HOME, "cli"),
  registry: path.join(AGENT_HOME, "registry.yaml")
};
var CLIENT_SKILL_DIRS = {
  "claude-code": path.join(os.homedir(), ".claude", "skills"),
  cursor: path.join(os.homedir(), ".cursor", "skills"),
  windsurf: path.join(os.homedir(), ".codeium", "windsurf", "skills"),
  opencode: path.join(os.homedir(), ".config", "opencode", "skills"),
  openclaw: path.join(os.homedir(), ".openclaw", "skills")
};
var CLIENT_LABELS = {
  "claude-code": "Claude Code",
  cursor: "Cursor",
  windsurf: "Windsurf",
  opencode: "OpenCode",
  openclaw: "OpenClaw"
};
async function ensureAgentHome() {
  await fs.ensureDir(PATHS.skills);
  await fs.ensureDir(PATHS.cli);
  if (!await fs.pathExists(PATHS.registry)) {
    await fs.writeFile(PATHS.registry, stringifyYaml({
      version: 1,
      skills: {},
      clients: {
        "claude-code": { enabled: true },
        cursor: { enabled: true },
        windsurf: { enabled: false },
        opencode: { enabled: true },
        openclaw: { enabled: true }
      }
    }));
  }
}
async function readRegistry() {
  await ensureAgentHome();
  const raw = await fs.readFile(PATHS.registry, "utf-8");
  return parseYaml(raw);
}
async function writeRegistry(data) {
  await fs.writeFile(PATHS.registry, stringifyYaml(data));
}
function parseSkillMd(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  try {
    return parseYaml(match[1]);
  } catch {
    return {};
  }
}
async function listSkills() {
  await ensureAgentHome();
  const registry = await readRegistry();
  const entries = await fs.readdir(PATHS.skills).catch(() => []);
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(PATHS.skills, entry);
    const stat = await fs.lstat(fullPath);
    if (!stat.isDirectory() && !stat.isSymbolicLink()) continue;
    const skillMdPath = path.join(fullPath, "SKILL.md");
    if (!await fs.pathExists(skillMdPath)) continue;
    const isSymlink = stat.isSymbolicLink();
    let frontmatter = {};
    try {
      const content = await fs.readFile(skillMdPath, "utf-8");
      frontmatter = parseSkillMd(content);
    } catch {
    }
    const name = frontmatter.name || entry;
    const regEntry = registry.skills?.[name] || {};
    results.push({
      name,
      dir: fullPath,
      isSymlink,
      enabled: regEntry.enabled ?? true,
      clients: regEntry.clients ?? Object.keys(CLIENT_SKILL_DIRS),
      description: frontmatter.description || name
    });
  }
  return results;
}
async function listCliTools() {
  await ensureAgentHome();
  const files = await fs.readdir(PATHS.cli).catch(() => []);
  return Promise.all(files.map(async (file) => {
    const fullPath = path.join(PATHS.cli, file);
    const stat = await fs.lstat(fullPath);
    const isSymlink = stat.isSymbolicLink();
    let linkTarget = null;
    if (isSymlink) linkTarget = await fs.readlink(fullPath);
    return {
      name: file,
      path: fullPath,
      isSymlink,
      linkTarget,
      executable: !!(stat.mode & 73)
    };
  }));
}
async function syncAllClients() {
  const registry = await readRegistry();
  const skills = await listSkills();
  const results = {};
  for (const [clientId, clientConf] of Object.entries(registry.clients || {})) {
    if (!clientConf.enabled) {
      results[clientId] = { skipped: true };
      continue;
    }
    const skillsDir = CLIENT_SKILL_DIRS[clientId];
    if (!skillsDir) {
      results[clientId] = { skipped: true };
      continue;
    }
    await fs.ensureDir(skillsDir);
    let count = 0;
    for (const skill of skills) {
      if (!skill.enabled) continue;
      if (skill.clients && !skill.clients.includes(clientId)) continue;
      const linkPath = path.join(skillsDir, skill.name);
      const existing = await fs.lstat(linkPath).catch(() => null);
      if (existing) await fs.remove(linkPath);
      await fs.symlink(skill.dir, linkPath);
      count++;
    }
    results[clientId] = { ok: true, path: skillsDir, count };
  }
  return results;
}
async function toggleSkill(name, enabled) {
  const registry = await readRegistry();
  if (!registry.skills) registry.skills = {};
  if (!registry.skills[name]) registry.skills[name] = {};
  registry.skills[name].enabled = enabled;
  await writeRegistry(registry);
}
async function toggleClient(id, enabled) {
  const registry = await readRegistry();
  if (!registry.clients) registry.clients = {};
  if (!registry.clients[id]) registry.clients[id] = {};
  registry.clients[id].enabled = enabled;
  await writeRegistry(registry);
}

// src/index.js
import { jsx, jsxs } from "react/jsx-runtime";
var C = {
  bg: "#0d1117",
  panel: "#161b22",
  border: "#30363d",
  accent: "#58a6ff",
  green: "#3fb950",
  red: "#f85149",
  yellow: "#e3b341",
  muted: "#8b949e",
  white: "#e6edf3",
  purple: "#bc8cff",
  orange: "#ffa657"
};
var TABS = ["Skills", "CLI Tools", "Clients", "Sync"];
function Header({ activeTab }) {
  return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [
    /* @__PURE__ */ jsxs(Box, { children: [
      /* @__PURE__ */ jsx(Text, { bold: true, color: C.accent, children: "\u2B21 skillctl " }),
      /* @__PURE__ */ jsx(Text, { color: C.muted, children: "\u2014 unified MCP skill & CLI manager" })
    ] }),
    /* @__PURE__ */ jsx(Box, { marginTop: 0, children: TABS.map((tab, i) => /* @__PURE__ */ jsx(Box, { marginRight: 2, children: i === activeTab ? /* @__PURE__ */ jsxs(Text, { bold: true, color: C.bg, backgroundColor: C.accent, children: [
      " ",
      tab,
      " "
    ] }) : /* @__PURE__ */ jsxs(Text, { color: C.muted, children: [
      " ",
      tab,
      " "
    ] }) }, tab)) }),
    /* @__PURE__ */ jsx(Text, { color: C.border, children: "\u2500".repeat(60) })
  ] });
}
function StatusBadge({ enabled }) {
  return enabled ? /* @__PURE__ */ jsx(Text, { color: C.green, children: "\u25CF " }) : /* @__PURE__ */ jsx(Text, { color: C.muted, children: "\u25CB " });
}
function SkillsTab({ skills, cursor }) {
  if (skills.length === 0) {
    return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", paddingLeft: 1, children: [
      /* @__PURE__ */ jsx(Text, { color: C.muted, children: "No skills found in " }),
      /* @__PURE__ */ jsx(Text, { color: C.yellow, children: PATHS.skills }),
      /* @__PURE__ */ jsx(Box, { marginTop: 1, children: /* @__PURE__ */ jsx(Text, { color: C.muted, children: "Add skill directories with SKILL.md to get started." }) }),
      /* @__PURE__ */ jsxs(Box, { marginTop: 1, children: [
        /* @__PURE__ */ jsx(Text, { color: C.muted, children: "Example: " }),
        /* @__PURE__ */ jsx(Text, { color: C.accent, children: "~/.skillctl/skills/my-skill/SKILL.md" })
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", children: [
    /* @__PURE__ */ jsxs(Box, { marginBottom: 1, paddingLeft: 1, children: [
      /* @__PURE__ */ jsx(Text, { color: C.muted, children: "NAME".padEnd(22) }),
      /* @__PURE__ */ jsx(Text, { color: C.muted, children: "STATUS".padEnd(10) }),
      /* @__PURE__ */ jsx(Text, { color: C.muted, children: "CLIENTS".padEnd(30) }),
      /* @__PURE__ */ jsx(Text, { color: C.muted, children: "DESCRIPTION" })
    ] }),
    skills.map((skill, i) => {
      const selected = i === cursor;
      const bg = selected ? C.panel : void 0;
      return /* @__PURE__ */ jsxs(Box, { paddingLeft: 1, backgroundColor: bg, children: [
        /* @__PURE__ */ jsx(Text, { color: selected ? C.white : C.muted, bold: selected, children: selected ? "\u25B8 " : "  " }),
        /* @__PURE__ */ jsx(Text, { color: selected ? C.accent : C.white, bold: selected, children: skill.name.padEnd(20) }),
        /* @__PURE__ */ jsx(StatusBadge, { enabled: skill.enabled }),
        /* @__PURE__ */ jsx(Text, { color: skill.enabled ? C.green : C.muted, children: (skill.enabled ? "enabled" : "disabled").padEnd(9) }),
        /* @__PURE__ */ jsx(Text, { color: C.purple, children: (skill.clients?.join(",") || "all").padEnd(28) }),
        /* @__PURE__ */ jsx(Text, { color: C.muted, children: skill.description?.slice(0, 35) || "" })
      ] }, skill.name);
    }),
    /* @__PURE__ */ jsx(Box, { marginTop: 1, paddingLeft: 1, children: /* @__PURE__ */ jsx(Text, { color: C.muted, children: "space: toggle  \u2191\u2193: navigate" }) })
  ] });
}
function CliTab({ tools, cursor }) {
  if (tools.length === 0) {
    return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", paddingLeft: 1, children: [
      /* @__PURE__ */ jsx(Text, { color: C.muted, children: "No CLI tools registered." }),
      /* @__PURE__ */ jsxs(Box, { marginTop: 1, children: [
        /* @__PURE__ */ jsx(Text, { color: C.muted, children: "Directory: " }),
        /* @__PURE__ */ jsx(Text, { color: C.yellow, children: PATHS.cli })
      ] }),
      /* @__PURE__ */ jsxs(Box, { marginTop: 1, children: [
        /* @__PURE__ */ jsx(Text, { color: C.muted, children: "Binaries here are auto-symlinked to " }),
        /* @__PURE__ */ jsx(Text, { color: C.accent, children: "/usr/local/bin" })
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", children: [
    /* @__PURE__ */ jsxs(Box, { marginBottom: 1, paddingLeft: 1, children: [
      /* @__PURE__ */ jsx(Text, { color: C.muted, children: "NAME".padEnd(24) }),
      /* @__PURE__ */ jsx(Text, { color: C.muted, children: "TYPE".padEnd(12) }),
      /* @__PURE__ */ jsx(Text, { color: C.muted, children: "TARGET" })
    ] }),
    tools.map((tool, i) => {
      const selected = i === cursor;
      return /* @__PURE__ */ jsxs(Box, { paddingLeft: 1, children: [
        /* @__PURE__ */ jsx(Text, { color: selected ? C.white : C.muted, children: selected ? "\u25B8 " : "  " }),
        /* @__PURE__ */ jsx(Text, { color: selected ? C.accent : C.white, bold: selected, children: tool.name.padEnd(22) }),
        /* @__PURE__ */ jsx(Text, { color: tool.isSymlink ? C.purple : C.orange, children: (tool.isSymlink ? "\u27F6 symlink" : "  binary").padEnd(12) }),
        /* @__PURE__ */ jsx(Text, { color: C.muted, children: tool.linkTarget || tool.path })
      ] }, tool.name);
    })
  ] });
}
function ClientsTab({ registry, cursor }) {
  const clients = Object.entries(CLIENT_LABELS);
  return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", children: [
    /* @__PURE__ */ jsxs(Box, { marginBottom: 1, paddingLeft: 1, children: [
      /* @__PURE__ */ jsx(Text, { color: C.muted, children: "CLIENT".padEnd(18) }),
      /* @__PURE__ */ jsx(Text, { color: C.muted, children: "STATUS".padEnd(12) }),
      /* @__PURE__ */ jsx(Text, { color: C.muted, children: "CONFIG PATH" })
    ] }),
    clients.map(([id, label], i) => {
      const selected = i === cursor;
      const enabled = registry?.clients?.[id]?.enabled ?? false;
      return /* @__PURE__ */ jsxs(Box, { paddingLeft: 1, children: [
        /* @__PURE__ */ jsx(Text, { color: selected ? C.white : C.muted, children: selected ? "\u25B8 " : "  " }),
        /* @__PURE__ */ jsx(Text, { color: selected ? C.accent : C.white, bold: selected, children: label.padEnd(16) }),
        /* @__PURE__ */ jsx(StatusBadge, { enabled }),
        /* @__PURE__ */ jsx(Text, { color: enabled ? C.green : C.muted, children: (enabled ? "enabled" : "disabled").padEnd(11) }),
        /* @__PURE__ */ jsx(Text, { color: C.muted, children: CLIENT_SKILL_DIRS[id] })
      ] }, id);
    }),
    /* @__PURE__ */ jsx(Box, { marginTop: 1, paddingLeft: 1, children: /* @__PURE__ */ jsx(Text, { color: C.muted, children: "space: toggle client sync  \u2191\u2193: navigate" }) })
  ] });
}
function SyncTab({ syncResult, syncing }) {
  if (syncing) {
    return /* @__PURE__ */ jsx(Box, { paddingLeft: 1, children: /* @__PURE__ */ jsx(Text, { color: C.yellow, children: "\u27F3 Syncing all clients..." }) });
  }
  if (!syncResult) {
    return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", paddingLeft: 1, children: [
      /* @__PURE__ */ jsx(Text, { color: C.muted, children: "Press " }),
      /* @__PURE__ */ jsx(Text, { color: C.accent, children: "s" }),
      /* @__PURE__ */ jsx(Text, { color: C.muted, children: " to sync skills \u2192 all enabled clients" }),
      /* @__PURE__ */ jsx(Box, { marginTop: 1, children: /* @__PURE__ */ jsx(Text, { color: C.muted, children: "This will:" }) }),
      /* @__PURE__ */ jsxs(Box, { paddingLeft: 2, flexDirection: "column", children: [
        /* @__PURE__ */ jsx(Text, { color: C.muted, children: "1. Read enabled skills from ~/.skillctl/skills/" }),
        /* @__PURE__ */ jsx(Text, { color: C.muted, children: "2. Symlink each skill dir into client's skills/ dir" }),
        /* @__PURE__ */ jsx(Text, { color: C.muted, children: "3. Existing skills in target dirs are not removed" })
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", paddingLeft: 1, children: [
    /* @__PURE__ */ jsx(Text, { color: C.green, bold: true, children: "\u2713 Sync complete" }),
    /* @__PURE__ */ jsx(Box, { marginTop: 1, flexDirection: "column", children: Object.entries(syncResult).map(([client, result]) => /* @__PURE__ */ jsxs(Box, { children: [
      /* @__PURE__ */ jsx(Text, { color: result.skipped ? C.muted : result.ok ? C.green : C.red, children: result.skipped ? "\u25CB" : result.ok ? "\u2713" : "\u2717" }),
      /* @__PURE__ */ jsxs(Text, { color: C.white, children: [
        " ",
        CLIENT_LABELS[client]?.padEnd(16)
      ] }),
      result.skipped && /* @__PURE__ */ jsx(Text, { color: C.muted, children: " skipped (disabled)" }),
      result.ok && /* @__PURE__ */ jsxs(Text, { color: C.muted, children: [
        " ",
        result.count,
        " skills \u2192 ",
        result.path
      ] }),
      result.error && /* @__PURE__ */ jsxs(Text, { color: C.red, children: [
        " ",
        result.error
      ] })
    ] }, client)) })
  ] });
}
function Footer({ tab }) {
  const hints = {
    0: "tab: switch  space: toggle skill  r: refresh  q: quit",
    1: "tab: switch  r: refresh  q: quit",
    2: "tab: switch  space: toggle client  r: refresh  q: quit",
    3: "tab: switch  s: sync now  q: quit"
  };
  return /* @__PURE__ */ jsxs(Box, { marginTop: 1, children: [
    /* @__PURE__ */ jsx(Text, { color: C.border, children: "\u2500".repeat(60) }),
    /* @__PURE__ */ jsxs(Text, { color: C.muted, children: [
      "\n",
      hints[tab]
    ] })
  ] });
}
function App() {
  const { exit } = useApp();
  const [tab, setTab] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [skills, setSkills] = useState([]);
  const [cliTools, setCliTools] = useState([]);
  const [registry, setRegistry] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    const [s, c, r] = await Promise.all([listSkills(), listCliTools(), readRegistry()]);
    setSkills(s);
    setCliTools(c);
    setRegistry(r);
    setLoading(false);
  }, []);
  useEffect(() => {
    refresh();
  }, []);
  const tabLengths = [skills.length, cliTools.length, Object.keys(CLIENT_LABELS).length, 0];
  useInput((input, key) => {
    if (input === "q") {
      exit();
      return;
    }
    if (key.tab || input === "l") {
      setTab((t) => (t + 1) % TABS.length);
      setCursor(0);
      return;
    }
    if (input === "h") {
      setTab((t) => (t - 1 + TABS.length) % TABS.length);
      setCursor(0);
      return;
    }
    if (input === "r") {
      refresh();
      return;
    }
    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.downArrow) {
      const max = tabLengths[tab] - 1;
      setCursor((c) => Math.min(max, c + 1));
      return;
    }
    if (input === " ") {
      if (tab === 0 && skills[cursor]) {
        const skill = skills[cursor];
        toggleSkill(skill.name, !skill.enabled).then(refresh);
      }
      if (tab === 2) {
        const clientId = Object.keys(CLIENT_LABELS)[cursor];
        const current = registry?.clients?.[clientId]?.enabled ?? false;
        toggleClient(clientId, !current).then(refresh);
      }
      return;
    }
    if (input === "s" && tab === 3) {
      setSyncing(true);
      setSyncResult(null);
      syncAllClients().then((r) => {
        setSyncResult(r);
        setSyncing(false);
      });
      return;
    }
  });
  if (loading) {
    return /* @__PURE__ */ jsx(Box, { children: /* @__PURE__ */ jsx(Text, { color: C.yellow, children: "\u27F3 Loading skillctl..." }) });
  }
  return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", paddingX: 1, paddingY: 0, children: [
    /* @__PURE__ */ jsx(Header, { activeTab: tab }),
    tab === 0 && /* @__PURE__ */ jsx(SkillsTab, { skills, cursor }),
    tab === 1 && /* @__PURE__ */ jsx(CliTab, { tools: cliTools, cursor }),
    tab === 2 && /* @__PURE__ */ jsx(ClientsTab, { registry, cursor }),
    tab === 3 && /* @__PURE__ */ jsx(SyncTab, { syncResult, syncing }),
    /* @__PURE__ */ jsx(Footer, { tab })
  ] });
}
render(/* @__PURE__ */ jsx(App, {}));
