#!/usr/bin/env node

// src/cli.js
import path3 from "path";

// node_modules/chalk/source/vendor/ansi-styles/index.js
var ANSI_BACKGROUND_OFFSET = 10;
var wrapAnsi16 = (offset = 0) => (code) => `\x1B[${code + offset}m`;
var wrapAnsi256 = (offset = 0) => (code) => `\x1B[${38 + offset};5;${code}m`;
var wrapAnsi16m = (offset = 0) => (red, green, blue) => `\x1B[${38 + offset};2;${red};${green};${blue}m`;
var styles = {
  modifier: {
    reset: [0, 0],
    // 21 isn't widely supported and 22 does the same thing
    bold: [1, 22],
    dim: [2, 22],
    italic: [3, 23],
    underline: [4, 24],
    overline: [53, 55],
    inverse: [7, 27],
    hidden: [8, 28],
    strikethrough: [9, 29]
  },
  color: {
    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],
    // Bright color
    blackBright: [90, 39],
    gray: [90, 39],
    // Alias of `blackBright`
    grey: [90, 39],
    // Alias of `blackBright`
    redBright: [91, 39],
    greenBright: [92, 39],
    yellowBright: [93, 39],
    blueBright: [94, 39],
    magentaBright: [95, 39],
    cyanBright: [96, 39],
    whiteBright: [97, 39]
  },
  bgColor: {
    bgBlack: [40, 49],
    bgRed: [41, 49],
    bgGreen: [42, 49],
    bgYellow: [43, 49],
    bgBlue: [44, 49],
    bgMagenta: [45, 49],
    bgCyan: [46, 49],
    bgWhite: [47, 49],
    // Bright color
    bgBlackBright: [100, 49],
    bgGray: [100, 49],
    // Alias of `bgBlackBright`
    bgGrey: [100, 49],
    // Alias of `bgBlackBright`
    bgRedBright: [101, 49],
    bgGreenBright: [102, 49],
    bgYellowBright: [103, 49],
    bgBlueBright: [104, 49],
    bgMagentaBright: [105, 49],
    bgCyanBright: [106, 49],
    bgWhiteBright: [107, 49]
  }
};
var modifierNames = Object.keys(styles.modifier);
var foregroundColorNames = Object.keys(styles.color);
var backgroundColorNames = Object.keys(styles.bgColor);
var colorNames = [...foregroundColorNames, ...backgroundColorNames];
function assembleStyles() {
  const codes = /* @__PURE__ */ new Map();
  for (const [groupName, group] of Object.entries(styles)) {
    for (const [styleName, style] of Object.entries(group)) {
      styles[styleName] = {
        open: `\x1B[${style[0]}m`,
        close: `\x1B[${style[1]}m`
      };
      group[styleName] = styles[styleName];
      codes.set(style[0], style[1]);
    }
    Object.defineProperty(styles, groupName, {
      value: group,
      enumerable: false
    });
  }
  Object.defineProperty(styles, "codes", {
    value: codes,
    enumerable: false
  });
  styles.color.close = "\x1B[39m";
  styles.bgColor.close = "\x1B[49m";
  styles.color.ansi = wrapAnsi16();
  styles.color.ansi256 = wrapAnsi256();
  styles.color.ansi16m = wrapAnsi16m();
  styles.bgColor.ansi = wrapAnsi16(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi256 = wrapAnsi256(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi16m = wrapAnsi16m(ANSI_BACKGROUND_OFFSET);
  Object.defineProperties(styles, {
    rgbToAnsi256: {
      value(red, green, blue) {
        if (red === green && green === blue) {
          if (red < 8) {
            return 16;
          }
          if (red > 248) {
            return 231;
          }
          return Math.round((red - 8) / 247 * 24) + 232;
        }
        return 16 + 36 * Math.round(red / 255 * 5) + 6 * Math.round(green / 255 * 5) + Math.round(blue / 255 * 5);
      },
      enumerable: false
    },
    hexToRgb: {
      value(hex) {
        const matches = /[a-f\d]{6}|[a-f\d]{3}/i.exec(hex.toString(16));
        if (!matches) {
          return [0, 0, 0];
        }
        let [colorString] = matches;
        if (colorString.length === 3) {
          colorString = [...colorString].map((character) => character + character).join("");
        }
        const integer = Number.parseInt(colorString, 16);
        return [
          /* eslint-disable no-bitwise */
          integer >> 16 & 255,
          integer >> 8 & 255,
          integer & 255
          /* eslint-enable no-bitwise */
        ];
      },
      enumerable: false
    },
    hexToAnsi256: {
      value: (hex) => styles.rgbToAnsi256(...styles.hexToRgb(hex)),
      enumerable: false
    },
    ansi256ToAnsi: {
      value(code) {
        if (code < 8) {
          return 30 + code;
        }
        if (code < 16) {
          return 90 + (code - 8);
        }
        let red;
        let green;
        let blue;
        if (code >= 232) {
          red = ((code - 232) * 10 + 8) / 255;
          green = red;
          blue = red;
        } else {
          code -= 16;
          const remainder = code % 36;
          red = Math.floor(code / 36) / 5;
          green = Math.floor(remainder / 6) / 5;
          blue = remainder % 6 / 5;
        }
        const value = Math.max(red, green, blue) * 2;
        if (value === 0) {
          return 30;
        }
        let result = 30 + (Math.round(blue) << 2 | Math.round(green) << 1 | Math.round(red));
        if (value === 2) {
          result += 60;
        }
        return result;
      },
      enumerable: false
    },
    rgbToAnsi: {
      value: (red, green, blue) => styles.ansi256ToAnsi(styles.rgbToAnsi256(red, green, blue)),
      enumerable: false
    },
    hexToAnsi: {
      value: (hex) => styles.ansi256ToAnsi(styles.hexToAnsi256(hex)),
      enumerable: false
    }
  });
  return styles;
}
var ansiStyles = assembleStyles();
var ansi_styles_default = ansiStyles;

// node_modules/chalk/source/vendor/supports-color/index.js
import process2 from "node:process";
import os from "node:os";
import tty from "node:tty";
function hasFlag(flag, argv = globalThis.Deno ? globalThis.Deno.args : process2.argv) {
  const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
  const position = argv.indexOf(prefix + flag);
  const terminatorPosition = argv.indexOf("--");
  return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}
var { env } = process2;
var flagForceColor;
if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) {
  flagForceColor = 0;
} else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
  flagForceColor = 1;
}
function envForceColor() {
  if ("FORCE_COLOR" in env) {
    if (env.FORCE_COLOR === "true") {
      return 1;
    }
    if (env.FORCE_COLOR === "false") {
      return 0;
    }
    return env.FORCE_COLOR.length === 0 ? 1 : Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);
  }
}
function translateLevel(level) {
  if (level === 0) {
    return false;
  }
  return {
    level,
    hasBasic: true,
    has256: level >= 2,
    has16m: level >= 3
  };
}
function _supportsColor(haveStream, { streamIsTTY, sniffFlags = true } = {}) {
  const noFlagForceColor = envForceColor();
  if (noFlagForceColor !== void 0) {
    flagForceColor = noFlagForceColor;
  }
  const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;
  if (forceColor === 0) {
    return 0;
  }
  if (sniffFlags) {
    if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
      return 3;
    }
    if (hasFlag("color=256")) {
      return 2;
    }
  }
  if ("TF_BUILD" in env && "AGENT_NAME" in env) {
    return 1;
  }
  if (haveStream && !streamIsTTY && forceColor === void 0) {
    return 0;
  }
  const min = forceColor || 0;
  if (env.TERM === "dumb") {
    return min;
  }
  if (process2.platform === "win32") {
    const osRelease = os.release().split(".");
    if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
      return Number(osRelease[2]) >= 14931 ? 3 : 2;
    }
    return 1;
  }
  if ("CI" in env) {
    if (["GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI"].some((key) => key in env)) {
      return 3;
    }
    if (["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some((sign) => sign in env) || env.CI_NAME === "codeship") {
      return 1;
    }
    return min;
  }
  if ("TEAMCITY_VERSION" in env) {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
  }
  if (env.COLORTERM === "truecolor") {
    return 3;
  }
  if (env.TERM === "xterm-kitty") {
    return 3;
  }
  if (env.TERM === "xterm-ghostty") {
    return 3;
  }
  if (env.TERM === "wezterm") {
    return 3;
  }
  if ("TERM_PROGRAM" in env) {
    const version = Number.parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
    switch (env.TERM_PROGRAM) {
      case "iTerm.app": {
        return version >= 3 ? 3 : 2;
      }
      case "Apple_Terminal": {
        return 2;
      }
    }
  }
  if (/-256(color)?$/i.test(env.TERM)) {
    return 2;
  }
  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
    return 1;
  }
  if ("COLORTERM" in env) {
    return 1;
  }
  return min;
}
function createSupportsColor(stream, options = {}) {
  const level = _supportsColor(stream, {
    streamIsTTY: stream && stream.isTTY,
    ...options
  });
  return translateLevel(level);
}
var supportsColor = {
  stdout: createSupportsColor({ isTTY: tty.isatty(1) }),
  stderr: createSupportsColor({ isTTY: tty.isatty(2) })
};
var supports_color_default = supportsColor;

// node_modules/chalk/source/utilities.js
function stringReplaceAll(string, substring, replacer) {
  let index = string.indexOf(substring);
  if (index === -1) {
    return string;
  }
  const substringLength = substring.length;
  let endIndex = 0;
  let returnValue = "";
  do {
    returnValue += string.slice(endIndex, index) + substring + replacer;
    endIndex = index + substringLength;
    index = string.indexOf(substring, endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}
function stringEncaseCRLFWithFirstIndex(string, prefix, postfix, index) {
  let endIndex = 0;
  let returnValue = "";
  do {
    const gotCR = string[index - 1] === "\r";
    returnValue += string.slice(endIndex, gotCR ? index - 1 : index) + prefix + (gotCR ? "\r\n" : "\n") + postfix;
    endIndex = index + 1;
    index = string.indexOf("\n", endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}

// node_modules/chalk/source/index.js
var { stdout: stdoutColor, stderr: stderrColor } = supports_color_default;
var GENERATOR = /* @__PURE__ */ Symbol("GENERATOR");
var STYLER = /* @__PURE__ */ Symbol("STYLER");
var IS_EMPTY = /* @__PURE__ */ Symbol("IS_EMPTY");
var levelMapping = [
  "ansi",
  "ansi",
  "ansi256",
  "ansi16m"
];
var styles2 = /* @__PURE__ */ Object.create(null);
var applyOptions = (object, options = {}) => {
  if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
    throw new Error("The `level` option should be an integer from 0 to 3");
  }
  const colorLevel = stdoutColor ? stdoutColor.level : 0;
  object.level = options.level === void 0 ? colorLevel : options.level;
};
var chalkFactory = (options) => {
  const chalk2 = (...strings) => strings.join(" ");
  applyOptions(chalk2, options);
  Object.setPrototypeOf(chalk2, createChalk.prototype);
  return chalk2;
};
function createChalk(options) {
  return chalkFactory(options);
}
Object.setPrototypeOf(createChalk.prototype, Function.prototype);
for (const [styleName, style] of Object.entries(ansi_styles_default)) {
  styles2[styleName] = {
    get() {
      const builder = createBuilder(this, createStyler(style.open, style.close, this[STYLER]), this[IS_EMPTY]);
      Object.defineProperty(this, styleName, { value: builder });
      return builder;
    }
  };
}
styles2.visible = {
  get() {
    const builder = createBuilder(this, this[STYLER], true);
    Object.defineProperty(this, "visible", { value: builder });
    return builder;
  }
};
var getModelAnsi = (model, level, type, ...arguments_) => {
  if (model === "rgb") {
    if (level === "ansi16m") {
      return ansi_styles_default[type].ansi16m(...arguments_);
    }
    if (level === "ansi256") {
      return ansi_styles_default[type].ansi256(ansi_styles_default.rgbToAnsi256(...arguments_));
    }
    return ansi_styles_default[type].ansi(ansi_styles_default.rgbToAnsi(...arguments_));
  }
  if (model === "hex") {
    return getModelAnsi("rgb", level, type, ...ansi_styles_default.hexToRgb(...arguments_));
  }
  return ansi_styles_default[type][model](...arguments_);
};
var usedModels = ["rgb", "hex", "ansi256"];
for (const model of usedModels) {
  styles2[model] = {
    get() {
      const { level } = this;
      return function(...arguments_) {
        const styler = createStyler(getModelAnsi(model, levelMapping[level], "color", ...arguments_), ansi_styles_default.color.close, this[STYLER]);
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    }
  };
  const bgModel = "bg" + model[0].toUpperCase() + model.slice(1);
  styles2[bgModel] = {
    get() {
      const { level } = this;
      return function(...arguments_) {
        const styler = createStyler(getModelAnsi(model, levelMapping[level], "bgColor", ...arguments_), ansi_styles_default.bgColor.close, this[STYLER]);
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    }
  };
}
var proto = Object.defineProperties(() => {
}, {
  ...styles2,
  level: {
    enumerable: true,
    get() {
      return this[GENERATOR].level;
    },
    set(level) {
      this[GENERATOR].level = level;
    }
  }
});
var createStyler = (open, close, parent) => {
  let openAll;
  let closeAll;
  if (parent === void 0) {
    openAll = open;
    closeAll = close;
  } else {
    openAll = parent.openAll + open;
    closeAll = close + parent.closeAll;
  }
  return {
    open,
    close,
    openAll,
    closeAll,
    parent
  };
};
var createBuilder = (self, _styler, _isEmpty) => {
  const builder = (...arguments_) => applyStyle(builder, arguments_.length === 1 ? "" + arguments_[0] : arguments_.join(" "));
  Object.setPrototypeOf(builder, proto);
  builder[GENERATOR] = self;
  builder[STYLER] = _styler;
  builder[IS_EMPTY] = _isEmpty;
  return builder;
};
var applyStyle = (self, string) => {
  if (self.level <= 0 || !string) {
    return self[IS_EMPTY] ? "" : string;
  }
  let styler = self[STYLER];
  if (styler === void 0) {
    return string;
  }
  const { openAll, closeAll } = styler;
  if (string.includes("\x1B")) {
    while (styler !== void 0) {
      string = stringReplaceAll(string, styler.close, styler.open);
      styler = styler.parent;
    }
  }
  const lfIndex = string.indexOf("\n");
  if (lfIndex !== -1) {
    string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
  }
  return openAll + string + closeAll;
};
Object.defineProperties(createChalk.prototype, styles2);
var chalk = createChalk();
var chalkStderr = createChalk({ level: stderrColor ? stderrColor.level : 0 });
var source_default = chalk;

// src/core/registry.js
import fs from "fs-extra";
import path from "path";
import os2 from "os";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
var AGENT_HOME = path.join(os2.homedir(), ".skillctl");
var PATHS = {
  root: AGENT_HOME,
  skills: path.join(AGENT_HOME, "skills"),
  cli: path.join(AGENT_HOME, "cli"),
  registry: path.join(AGENT_HOME, "registry.yaml")
};
var CLIENT_SKILL_DIRS = {
  "claude-code": path.join(os2.homedir(), ".claude", "skills"),
  cursor: path.join(os2.homedir(), ".cursor", "skills"),
  windsurf: path.join(os2.homedir(), ".codeium", "windsurf", "skills"),
  opencode: path.join(os2.homedir(), ".config", "opencode", "skills"),
  openclaw: path.join(os2.homedir(), ".openclaw", "skills")
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

// src/core/remote.js
import fs2 from "fs-extra";
import path2 from "path";
import os3 from "os";
import { execa } from "execa";
import { parse as parseYaml2 } from "yaml";
var REGISTRY_URL = "https://api.skillctl.dev";
function getToken() {
  return process.env.SKILLCTL_TOKEN || null;
}
async function searchSkills(query = "") {
  const url = query ? `${REGISTRY_URL}/v1/skills?q=${encodeURIComponent(query)}` : `${REGISTRY_URL}/v1/skills`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Registry error: ${res.status}`);
  return res.json();
}
async function getSkillInfo(name) {
  const res = await fetch(`${REGISTRY_URL}/v1/skills/${name}`);
  if (!res.ok) throw new Error(`Skill not found: ${name}`);
  return res.json();
}
async function installSkill(name, version) {
  const meta = await getSkillInfo(name);
  const ver = version || meta.version;
  const tmpFile = path2.join(os3.tmpdir(), `${name}-${ver}.tar.gz`);
  const destDir = path2.join(PATHS.skills, name);
  const res = await fetch(`${REGISTRY_URL}/v1/skills/${name}/${ver}.tar.gz`);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = await res.arrayBuffer();
  await fs2.writeFile(tmpFile, Buffer.from(buffer));
  await fs2.ensureDir(destDir);
  await execa("tar", ["-xzf", tmpFile, "-C", destDir, "--strip-components=1"]);
  await fs2.remove(tmpFile);
  return { name, version: ver, dir: destDir };
}
async function publishSkill(skillDir, token) {
  const skillMdPath = path2.join(skillDir, "SKILL.md");
  if (!await fs2.pathExists(skillMdPath)) {
    throw new Error(`No SKILL.md found in ${skillDir}`);
  }
  const content = await fs2.readFile(skillMdPath, "utf-8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error("No frontmatter found in SKILL.md");
  const meta = parseYaml2(match[1]);
  if (!meta.name) throw new Error('"name" is required in SKILL.md frontmatter');
  if (!meta.version) throw new Error('"version" is required in SKILL.md frontmatter');
  const tmpFile = path2.join(os3.tmpdir(), `${meta.name}-${meta.version}.tar.gz`);
  await execa("tar", ["-czf", tmpFile, "-C", path2.dirname(skillDir), path2.basename(skillDir)]);
  const buffer = await fs2.readFile(tmpFile);
  await fs2.remove(tmpFile);
  const params = new URLSearchParams({
    version: meta.version,
    description: meta.description || "",
    author: meta.author || ""
  });
  const res = await fetch(`${REGISTRY_URL}/v1/skills/${meta.name}?${params}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/gzip"
    },
    body: buffer
  });
  if (!res.ok) {
    const err2 = await res.json().catch(() => ({}));
    throw new Error(err2.error || `Publish failed: ${res.status}`);
  }
  return res.json();
}

// src/cli.js
var [, , command, sub, ...rest] = process.argv;
var dim = source_default.gray;
var ok = source_default.green;
var err = source_default.red;
var hi = source_default.cyan;
var warn = source_default.yellow;
function pad(str, n) {
  return String(str).padEnd(n);
}
var HELP = `
  ${hi("skillctl")} \u2014 unified skill manager

  ${dim("Local")}
    list                     list installed skills
    enable <name>            enable a skill
    disable <name>           disable a skill
    sync                     sync skills \u2192 all enabled clients

  ${dim("Clients")}
    clients                  list clients and their status
    clients enable <id>      enable a client
    clients disable <id>     disable a client

  ${dim("Registry")}
    search [query]           search skillctl.dev registry
    install <name[@ver]>     install a skill from registry
    publish [dir]            publish a skill to registry

  ${dim("CLI Tools")}
    cli                      list registered CLI tools
`;
async function main() {
  switch (command) {
    case "list": {
      const skills = await listSkills();
      if (!skills.length) {
        console.log(dim(`  No skills found in ${PATHS.skills}`));
        console.log(dim(`  Use 'skillctl install <name>' to install from registry
`));
        break;
      }
      console.log();
      console.log(`  ${dim(pad("NAME", 24))}${dim(pad("STATUS", 12))}${dim(pad("CLIENTS", 28))}${dim("DESCRIPTION")}`);
      for (const s of skills) {
        const status = s.enabled ? ok("\u25CF enabled") : dim("\u25CB disabled");
        const clients = (s.clients || ["all"]).join(",");
        console.log(`  ${hi(pad(s.name, 24))}${pad(status, 21)}${dim(pad(clients, 28))}${dim(s.description?.slice(0, 40) || "")}`);
      }
      console.log();
      break;
    }
    case "enable": {
      if (!sub) {
        console.error(err("Usage: skillctl enable <name>"));
        process.exit(1);
      }
      await toggleSkill(sub, true);
      console.log(`  ${ok("\u25CF")} ${sub} enabled`);
      break;
    }
    case "disable": {
      if (!sub) {
        console.error(err("Usage: skillctl disable <name>"));
        process.exit(1);
      }
      await toggleSkill(sub, false);
      console.log(`  ${dim("\u25CB")} ${sub} disabled`);
      break;
    }
    case "sync": {
      console.log();
      const results = await syncAllClients();
      for (const [id, r] of Object.entries(results)) {
        const label = (CLIENT_LABELS[id] || id).padEnd(16);
        if (r.skipped) console.log(`  ${dim("\u25CB")} ${dim(label)} skipped`);
        else if (r.ok) console.log(`  ${ok("\u2713")} ${pad(label, 16)} ${r.count} skills \u2192 ${dim(r.path)}`);
        else console.log(`  ${err("\u2717")} ${pad(label, 16)} ${err(r.error)}`);
      }
      console.log();
      break;
    }
    case "clients": {
      if (sub === "enable" || sub === "disable") {
        const id = rest[0];
        if (!id) {
          console.error(err(`Usage: skillctl clients ${sub} <id>`));
          process.exit(1);
        }
        await toggleClient(id, sub === "enable");
        const symbol = sub === "enable" ? ok("\u25CF") : dim("\u25CB");
        console.log(`  ${symbol} ${id} ${sub}d`);
        break;
      }
      const registry = await readRegistry();
      console.log();
      console.log(`  ${dim(pad("CLIENT", 20))}${dim(pad("STATUS", 12))}${dim("SKILLS DIR")}`);
      for (const [id, label] of Object.entries(CLIENT_LABELS)) {
        const enabled = registry?.clients?.[id]?.enabled ?? false;
        const status = enabled ? ok("\u25CF enabled") : dim("\u25CB disabled");
        console.log(`  ${pad(label, 20)}${pad(status, 21)}${dim(CLIENT_SKILL_DIRS[id])}`);
      }
      console.log();
      break;
    }
    case "search": {
      const query = sub || "";
      process.stdout.write(dim(`  Searching ${REGISTRY_URL}${query ? ` for "${query}"` : ""}...
`));
      const { skills, total } = await searchSkills(query);
      if (!total) {
        console.log(dim("  No skills found.\n"));
        break;
      }
      console.log();
      console.log(`  ${dim(pad("NAME", 24))}${dim(pad("VERSION", 12))}${dim("DESCRIPTION")}`);
      for (const s of skills) {
        console.log(`  ${hi(pad(s.name, 24))}${dim(pad(s.version, 12))}${s.description || ""}`);
      }
      console.log();
      break;
    }
    case "install": {
      if (!sub) {
        console.error(err("Usage: skillctl install <name>[@version]"));
        process.exit(1);
      }
      const [name, version] = sub.split("@");
      process.stdout.write(dim(`  Installing ${name}${version ? `@${version}` : ""}...
`));
      const result = await installSkill(name, version);
      console.log(`  ${ok("\u2713")} ${result.name}@${result.version} \u2192 ${dim(result.dir)}`);
      break;
    }
    case "publish": {
      const dir = sub ? path3.resolve(sub) : process.cwd();
      const token = getToken();
      if (!token) {
        console.error(err("  Error: SKILLCTL_TOKEN is not set."));
        process.exit(1);
      }
      process.stdout.write(dim(`  Publishing ${dir}...
`));
      const result = await publishSkill(dir, token);
      console.log(`  ${ok("\u2713")} ${result.name}@${result.version} published`);
      break;
    }
    case "cli": {
      const tools = await listCliTools();
      if (!tools.length) {
        console.log(dim(`  No CLI tools in ${PATHS.cli}
`));
        break;
      }
      console.log();
      console.log(`  ${dim(pad("NAME", 24))}${dim(pad("TYPE", 12))}${dim("TARGET")}`);
      for (const t of tools) {
        const type = t.isSymlink ? warn("symlink") : ok("binary");
        console.log(`  ${pad(t.name, 24)}${pad(type, 20)}${dim(t.linkTarget || t.path)}`);
      }
      console.log();
      break;
    }
    default: {
      console.log(HELP);
      break;
    }
  }
}
main().catch((e) => {
  console.error(err(`
  Error: ${e.message}
`));
  process.exit(1);
});
