#!/usr/bin/env -S node --experimental-strip-types
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type Skill = {
  name: string;
  baseName: string;
  description: string;
  path: string;
  realPath: string;
  dir: string;
  root: string;
  realRoot: string;
  scope: string;
  enabled: boolean;
  descChars: number;
  lineChars: number;
  lineBytes: number;
  bodyHash: string;
  bodyKey: string;
  descKey: string;
};

type Usage = {
  toolCall: number;
  fileRead: number;
  slash: number;
};

type Budget = {
  model: string;
  contextTokens: number;
  contextSource: string;
  budgetPercent: number;
  budgetTokens: number;
  renderedTokens: number;
  charsPerToken: number;
  budgetUsedRatio: number;
  contextUsedRatio: number;
  remainingBudgetTokens: number;
};

const home = os.homedir();
const argv = process.argv.slice(2);
const args = new Set(argv);

function argValue(name: string, fallback: string): string {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
}

const months = Number(argValue("--months", "3"));
const noLogs = args.has("--no-logs");
const json = args.has("--json");
const includeAll = args.has("--all");
const model = argValue("--model", "claude-opus-4-7");
const budgetPercent = Number(argValue("--budget-percent", "2"));
const contextTokensOverride = argValue("--context-tokens", "");
const charsPerToken = Number(argValue("--chars-per-token", "4"));
const maxLogBytes = Number(argValue("--max-log-mb", "300")) * 1024 * 1024;
const cutoffMs = Date.now() - Math.max(0, months) * 31 * 24 * 60 * 60 * 1000;
const extraRoots = argv.flatMap((arg, index) =>
  arg === "--root" && argv[index + 1] ? [argv[index + 1]] : [],
);

function expandHome(input: string): string {
  return input.replace(/^~(?=$|\/)/, home);
}

function exists(input: string): boolean {
  try {
    fs.accessSync(input);
    return true;
  } catch {
    return false;
  }
}

function numberArg(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function defaultContextTokens(modelName: string): number {
  const m = modelName.toLowerCase();
  if (m.includes("haiku")) return 200_000;
  if (m.includes("sonnet")) return 200_000;
  if (m.includes("opus")) return 200_000;
  return 200_000;
}

function claudeModelContext(modelName: string): { tokens: number; source: string } {
  const override = numberArg(contextTokensOverride, 0);
  if (override > 0) return { tokens: override, source: "--context-tokens" };
  return { tokens: defaultContextTokens(modelName), source: `fallback:${modelName}` };
}

function walkFiles(root: string, predicate: (file: string) => boolean, maxDepth = 10): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    let real = dir;
    try {
      real = fs.realpathSync(dir);
    } catch {
      return;
    }
    if (seen.has(real)) return;
    seen.add(real);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        let stat: fs.Stats;
        try {
          stat = fs.statSync(file);
        } catch {
          continue;
        }
        if (stat.isDirectory()) walk(file, depth + 1);
      } else if (entry.isFile() && predicate(file)) {
        out.push(file);
      }
    }
  }
  if (exists(root)) walk(root, 0);
  return out;
}

function sanitizeSingleLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function parseYamlScalar(raw: string): string {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseFrontmatter(file: string): { name?: string; description?: string; body: string } | null {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  const fm: string[] = [];
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      end = i;
      break;
    }
    fm.push(lines[i] ?? "");
  }
  if (end < 0) return null;
  let name: string | undefined;
  let description: string | undefined;
  for (let i = 0; i < fm.length; i++) {
    const line = fm[i] ?? "";
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1];
    const raw = match[2] ?? "";
    if (key === "name") name = sanitizeSingleLine(parseYamlScalar(raw));
    if (key === "description") {
      if (raw.trim() === "|" || raw.trim() === ">") {
        const block: string[] = [];
        for (let j = i + 1; j < fm.length; j++) {
          if (/^[A-Za-z0-9_-]+:\s*/.test(fm[j] ?? "")) break;
          block.push((fm[j] ?? "").replace(/^\s{2}/, ""));
        }
        description = sanitizeSingleLine(block.join(" "));
      } else {
        description = sanitizeSingleLine(parseYamlScalar(raw));
      }
    }
  }
  return { name, description, body: lines.slice(end + 1).join("\n") };
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeWords(input: string): string {
  return input
    .toLowerCase()
    .replace(/[`"'’().,;:!?/\\[\]{}_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSet(input: string): Set<string> {
  return new Set(normalizeWords(input).split(" ").filter((word) => word.length >= 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

function skillRootScope(root: string): string {
  const n = root.split(path.sep).join("/");
  if (n.includes("/.claude/plugins/cache/")) return "claude-plugin";
  if (n.includes("/.claude/skills")) return "claude";
  if (n.includes("/.claude/projects/") && n.includes("/.claude/skills")) return "project";
  if (n.match(/\/\.claude\/skills/)) return "project";
  return "extra";
}

function deletePriority(skill: Skill): number {
  // Lower = keep. Personal claude skills win over plugin cache (which the plugin can recreate).
  if (skill.scope === "claude") return 1;
  if (skill.scope === "claude-plugin") return 2;
  if (skill.scope === "project") return 3;
  return 4;
}

function preferredKeepSkill(list: Skill[]): Skill {
  return [...list].sort((a, b) => {
    const byPriority = deletePriority(a) - deletePriority(b);
    if (byPriority !== 0) return byPriority;
    return a.realPath.length - b.realPath.length || a.realPath.localeCompare(b.realPath);
  })[0]!;
}

function displayPathPriority(skill: Skill): number {
  if (skill.path === skill.realPath) return 0;
  return 1;
}

function preferredDisplaySkill(a: Skill, b: Skill): Skill {
  const byDisplay = displayPathPriority(a) - displayPathPriority(b);
  if (byDisplay < 0) return a;
  if (byDisplay > 0) return b;
  return a.path.length <= b.path.length ? a : b;
}

function pluginPrefixFor(file: string): string | null {
  // Match ~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/skills/<name>/SKILL.md
  const parts = file.split(path.sep);
  const cache = parts.indexOf("cache");
  if (cache < 0) return null;
  const skillsIdx = parts.indexOf("skills", cache + 1);
  if (skillsIdx < 0) return null;
  // <plugin> is at cache+2 (cache+1 = marketplace)
  return parts[cache + 2] ?? null;
}

function marketplaceFor(file: string): string | null {
  const parts = file.split(path.sep);
  const cache = parts.indexOf("cache");
  if (cache < 0) return null;
  return parts[cache + 1] ?? null;
}

function configState(): { disabledPlugins: Set<string> } {
  const disabledPlugins = new Set<string>();
  const settingsFiles = [
    path.join(home, ".claude/settings.json"),
    path.join(home, ".claude/settings.local.json"),
  ];
  const merged: Record<string, boolean> = {};
  for (const file of settingsFiles) {
    if (!exists(file)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      const enabled = parsed?.enabledPlugins;
      if (enabled && typeof enabled === "object") {
        for (const [key, value] of Object.entries(enabled)) {
          if (typeof value === "boolean") merged[key] = value;
        }
      }
    } catch {}
  }
  for (const [key, value] of Object.entries(merged)) {
    if (value === false) disabledPlugins.add(key);
  }
  return { disabledPlugins };
}

function disabledPluginMatches(disabledKey: string, plugin: string, marketplace: string | null): boolean {
  // disabledKey is "plugin@marketplace"
  const [p, m] = disabledKey.split("@");
  if (p !== plugin) return false;
  if (!m) return true;
  return marketplace == null || m === marketplace;
}

function discoverRoots(): string[] {
  const rootsByRealPath = new Map<string, string>();
  const candidates: string[] = [path.join(home, ".claude/skills")];

  // Walk plugin caches: ~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/skills
  const cacheBase = path.join(home, ".claude/plugins/cache");
  if (exists(cacheBase)) {
    for (const mp of fs.readdirSync(cacheBase, { withFileTypes: true })) {
      if (!mp.isDirectory()) continue;
      const mpPath = path.join(cacheBase, mp.name);
      for (const plug of fs.readdirSync(mpPath, { withFileTypes: true })) {
        if (!plug.isDirectory()) continue;
        const plugPath = path.join(mpPath, plug.name);
        for (const ver of fs.readdirSync(plugPath, { withFileTypes: true })) {
          if (!ver.isDirectory()) continue;
          const skillRoot = path.join(plugPath, ver.name, "skills");
          if (exists(skillRoot)) candidates.push(skillRoot);
        }
      }
    }
  }

  // Project-scoped skills (best-effort): ~/.claude/projects/<encoded>/.claude/skills
  // Most projects keep skills in their own working dir, not under ~/.claude/projects,
  // but check anyway in case a user symlinked them.
  const projectsBase = path.join(home, ".claude/projects");
  if (exists(projectsBase)) {
    for (const entry of fs.readdirSync(projectsBase, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillRoot = path.join(projectsBase, entry.name, ".claude", "skills");
      if (exists(skillRoot)) candidates.push(skillRoot);
    }
  }

  for (const root of [...candidates, ...extraRoots.map(expandHome)]) {
    if (!exists(root)) continue;
    let real: string;
    try {
      real = fs.realpathSync(root);
    } catch {
      continue;
    }
    const current = rootsByRealPath.get(real);
    if (!current || root.length < current.length) rootsByRealPath.set(real, root);
  }
  return [...rootsByRealPath.values()].sort();
}

function discoverSkills(): Skill[] {
  const { disabledPlugins } = configState();
  const skillsByRealPath = new Map<string, Skill>();
  for (const root of discoverRoots()) {
    for (const file of walkFiles(root, (candidate) => path.basename(candidate) === "SKILL.md", 10)) {
      const parsed = parseFrontmatter(file);
      if (!parsed) continue;
      const baseName = parsed.name || path.basename(path.dirname(file));
      const pluginPrefix = pluginPrefixFor(file);
      const marketplace = marketplaceFor(file);
      const name = pluginPrefix ? `${pluginPrefix}:${baseName}` : baseName;
      const description = parsed.description ?? "";
      // Match Claude Code's rendered system-reminder line: "- name: description"
      const rendered = description ? `- ${name}: ${description}` : `- ${name}`;
      const disabledByPlugin =
        pluginPrefix != null &&
        [...disabledPlugins].some((key) => disabledPluginMatches(key, pluginPrefix, marketplace));
      const bodyKey = normalizeWords(parsed.body);
      let realPath: string;
      try {
        realPath = fs.realpathSync(file);
      } catch {
        realPath = file;
      }
      let realRoot: string;
      try {
        realRoot = fs.realpathSync(root);
      } catch {
        realRoot = root;
      }
      const skill: Skill = {
        name,
        baseName,
        description,
        path: file,
        realPath,
        dir: path.dirname(file),
        root,
        realRoot,
        scope: skillRootScope(root),
        enabled: !disabledByPlugin,
        descChars: [...description].length,
        lineChars: [...`${rendered}\n`].length,
        lineBytes: Buffer.byteLength(`${rendered}\n`, "utf8"),
        bodyHash: fnv1a(bodyKey),
        bodyKey,
        descKey: normalizeWords(description),
      };
      const existing = skillsByRealPath.get(skill.realPath);
      skillsByRealPath.set(skill.realPath, existing ? preferredDisplaySkill(existing, skill) : skill);
    }
  }
  return [...skillsByRealPath.values()];
}

function recentLogFiles(): string[] {
  if (noLogs) return [];
  const files = new Set<string>();
  const history = path.join(home, ".claude/history.jsonl");
  if (exists(history)) files.add(history);
  const projectsBase = path.join(home, ".claude/projects");
  for (const file of walkRecentFiles(projectsBase, (candidate) => candidate.endsWith(".jsonl"), 6)) {
    try {
      if (fs.statSync(file).mtimeMs >= cutoffMs) files.add(file);
    } catch {}
  }
  return [...files].sort();
}

function walkRecentFiles(root: string, predicate: (file: string) => boolean, maxDepth = 8): string[] {
  const out: string[] = [];
  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(file);
      } catch {
        continue;
      }
      if (entry.isDirectory()) {
        if (depth > 0 && stat.mtimeMs < cutoffMs) continue;
        walk(file, depth + 1);
      } else if (entry.isFile() && stat.mtimeMs >= cutoffMs && predicate(file)) {
        out.push(file);
      }
    }
  }
  if (exists(root)) walk(root, 0);
  return out;
}

function scanUsage(skills: Skill[], logFiles: string[]): Map<string, Usage> {
  const aliases = new Map<string, string[]>();
  for (const skill of skills) {
    const values = new Set([skill.name, skill.baseName, skill.name.split(":").at(-1) ?? skill.name]);
    aliases.set(skill.name, [...values].map((value) => value.toLowerCase()));
  }
  const usage = new Map<string, Usage>();
  for (const skill of skills) usage.set(skill.name, { toolCall: 0, fileRead: 0, slash: 0 });
  let consumedBytes = 0;
  for (const file of logFiles) {
    let text = "";
    try {
      const stat = fs.statSync(file);
      if (stat.size > 150 * 1024 * 1024) continue;
      if (consumedBytes + stat.size > maxLogBytes) break;
      consumedBytes += stat.size;
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    // Skill tool calls: {"skill":"name"} or {"skill": "plugin:name"}
    const toolCounts = countTokens(
      [...text.matchAll(/"skill"\s*:\s*"([A-Za-z][A-Za-z0-9_.:-]{0,100})"/g)].map((m) =>
        (m[1] ?? "").toLowerCase(),
      ),
    );
    // SKILL.md file reads in tool calls
    const pathCounts = countTokens(
      [...text.matchAll(/skills\/([A-Za-z][A-Za-z0-9_.-]{0,80})\/SKILL\.md/g)].map((m) =>
        (m[1] ?? "").toLowerCase(),
      ),
    );
    // Slash-command tokens: /name (loose; we still gate via aliases)
    const slashCounts = countTokens(
      [...text.matchAll(/(?:^|[\s"'`])\/([A-Za-z][A-Za-z0-9_.:-]{1,80})\b/g)].map((m) =>
        (m[1] ?? "").toLowerCase(),
      ),
    );
    for (const [name, names] of aliases) {
      const item = usage.get(name);
      if (!item) continue;
      for (const candidate of names) {
        item.toolCall += toolCounts.get(candidate) ?? 0;
        item.fileRead += pathCounts.get(candidate) ?? 0;
        item.slash += slashCounts.get(candidate) ?? 0;
      }
    }
  }
  return usage;
}

function countTokens(values: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return map;
}

function suggestDescription(skill: Skill): string {
  const source = normalizeWords(`${skill.baseName} ${skill.description}`);
  const cues: string[] = [];
  const add = (label: string, pattern: RegExp) => {
    if (pattern.test(source) && !cues.includes(label)) cues.push(label);
  };
  add("Jira", /\bjira|ticket|sprint|backlog\b/);
  add("GitLab", /\b(gitlab|glab|mr|merge request|pipeline)\b/);
  add("GitHub", /\b(github|gh|pr|pull request)\b/);
  add("Slack", /\bslack\b/);
  add("Datadog", /\b(datadog|dd|monitor|pup)\b/);
  add("Confluence", /\bconfluence\b/);
  add("Google", /\b(google|drive|calendar|docs|sheets|slides|gmail)\b/);
  add("cmux", /\bcmux\b/);
  add("review", /\b(review|coderabbit|audit|inspect)/);
  add("debug", /\b(debug|trace|diagnos|profile)/);
  add("deploy", /\b(deploy|ship|release|publish)/);
  add("search", /\b(search|query|find|grep)/);
  add("docs", /\b(doc|docs|markdown|page)\b/);
  const verbs = cues.length ? cues.slice(0, 5).join(", ") : skill.baseName.replace(/-/g, " ");
  return `${verbs}: ${shortAction(source)}.`;
}

function shortAction(source: string): string {
  if (/\btriage|review\b/.test(source)) return "triage, review, proof";
  if (/\bdebug|diagnos|inspect\b/.test(source)) return "debug, inspect, fix";
  if (/\bsearch|query|find\b/.test(source)) return "search, query, summarize";
  if (/\bdeploy|release|publish|ship\b/.test(source)) return "deploy, release, verify";
  if (/\bcreate|scaffold|build\b/.test(source)) return "create, build, validate";
  return "use when needed";
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    map.set(value, [...(map.get(value) ?? []), item]);
  }
  return map;
}

function similarity(a: Skill, b: Skill): { description: number; body: number; overall: number } {
  const description = jaccard(wordSet(a.description), wordSet(b.description));
  const body = a.bodyHash === b.bodyHash ? 1 : jaccard(wordSet(a.bodyKey), wordSet(b.bodyKey));
  return { description, body, overall: body * 0.8 + description * 0.2 };
}

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatOnePct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function lineTokenCost(line: string): number {
  return Math.ceil(Buffer.byteLength(`${line}\n`, "utf8") / charsPerToken);
}

function renderSkillLine(skill: Skill, description: string): string {
  return description ? `- ${skill.name}: ${description}` : `- ${skill.name}`;
}

function skillBudget(skills: Skill[]): Budget {
  const context = claudeModelContext(model);
  const percent = numberArg(String(budgetPercent), 0);
  const renderedTokens = skills.reduce(
    (sum, skill) => sum + lineTokenCost(renderSkillLine(skill, skill.description)),
    0,
  );
  const budgetTokens = percent > 0 ? Math.floor(context.tokens * (percent / 100)) : 0;
  return {
    model,
    contextTokens: context.tokens,
    contextSource: context.source,
    budgetPercent: percent,
    budgetTokens,
    renderedTokens,
    charsPerToken,
    budgetUsedRatio: budgetTokens > 0 ? renderedTokens / budgetTokens : 0,
    contextUsedRatio: renderedTokens / context.tokens,
    remainingBudgetTokens: budgetTokens > 0 ? budgetTokens - renderedTokens : 0,
  };
}

function isLikelyCopy(score: { description: number; body: number }): boolean {
  return score.body >= 0.95 || (score.body >= 0.85 && score.description >= 0.85);
}

function duplicateDeleteSuggestions(groups: [string, Skill[]][]): string[] {
  const lines: string[] = [];
  for (const [name, list] of groups.slice(0, 80)) {
    const keep = preferredKeepSkill(list);
    const candidates = list
      .filter((skill) => skill.realPath !== keep.realPath)
      .map((skill) => ({ skill, score: similarity(keep, skill) }))
      .filter(({ score }) => isLikelyCopy(score))
      .sort((a, b) => b.score.body - a.score.body || b.score.description - a.score.description);
    if (candidates.length === 0) continue;
    lines.push(`- ${name}`);
    lines.push(`  keep: ${keep.scope}: ${keep.path}`);
    for (const { skill, score } of candidates) {
      lines.push(
        `  delete: ${skill.scope}: ${skill.path} (body=${formatPct(score.body)}, description=${formatPct(score.description)})`,
      );
    }
  }
  return lines.length ? lines : ["- none"];
}

function render(skills: Skill[], usage: Map<string, Usage>, logFiles: string[]): string {
  const enabled = skills.filter((skill) => skill.enabled || includeAll);
  const roots = groupBy(skills, (skill) => skill.root);
  const byBase = [...groupBy(enabled, (skill) => skill.baseName.toLowerCase()).entries()].filter(
    ([, list]) => list.length > 1,
  );
  const byBody = [...groupBy(enabled, (skill) => skill.bodyHash).entries()].filter(
    ([hash, list]) => hash !== "811c9dc5" && list.length > 1,
  );
  const longDescriptions = enabled
    .filter((skill) => skill.descChars >= 110 || skill.lineChars >= 180)
    .sort((a, b) => b.descChars - a.descChars)
    .slice(0, 30);
  const unused = enabled
    .filter((skill) => {
      const item = usage.get(skill.name);
      return !item || item.toolCall + item.fileRead + item.slash === 0;
    })
    .sort((a, b) => a.scope.localeCompare(b.scope) || a.name.localeCompare(b.name))
    .slice(0, 100);
  const totalLineChars = enabled.reduce((sum, skill) => sum + skill.lineChars, 0);
  const totalDescChars = enabled.reduce((sum, skill) => sum + skill.descChars, 0);
  const budget = skillBudget(enabled);
  const lines: string[] = [];
  lines.push("# Skill Cleaner Report (Claude Code)", "");
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`months: ${months}`);
  lines.push(`skills: ${skills.length} discovered, ${enabled.length} considered`);
  lines.push(`description_chars: ${totalDescChars}`);
  lines.push(`rendered_line_chars: ${totalLineChars}`);
  lines.push(`log_files_scanned: ${logFiles.length}`, "");

  lines.push("## Skill Budget", "");
  lines.push(`model: ${budget.model}`);
  lines.push(`context_tokens: ${formatNumber(budget.contextTokens)}`);
  lines.push(`context_source: ${budget.contextSource}`);
  lines.push(`cost_rule: ceil(utf8_bytes / ${budget.charsPerToken})`);
  lines.push(`rendered_tokens: ${formatNumber(budget.renderedTokens)}`);
  lines.push(`used_of_context: ${formatOnePct(budget.contextUsedRatio)}`);
  if (budget.budgetTokens > 0) {
    lines.push(`${budget.budgetPercent}%_budget_tokens: ${formatNumber(budget.budgetTokens)}`);
    lines.push(`used_of_${budget.budgetPercent}%_budget: ${formatOnePct(budget.budgetUsedRatio)}`);
    lines.push(`remaining_${budget.budgetPercent}%_budget_tokens: ${formatNumber(budget.remainingBudgetTokens)}`);
  }
  lines.push("");

  lines.push("## Description Candidates", "");
  for (const skill of longDescriptions) {
    lines.push(`- ${skill.name}`);
    lines.push(`  path: ${skill.path}`);
    lines.push(`  chars: description=${skill.descChars}, rendered_line=${skill.lineChars}`);
    lines.push(`  current: ${skill.description}`);
    lines.push(`  suggested: ${suggestDescription(skill)}`);
  }
  if (longDescriptions.length === 0) lines.push("- none");
  lines.push("");

  lines.push("## Duplicates By Name", "");
  for (const [name, list] of byBase.slice(0, 40)) {
    lines.push(`- ${name}`);
    const keep = preferredKeepSkill(list);
    lines.push(`  keep-default: ${keep.scope}: ${keep.path}`);
    for (const skill of list) {
      const score =
        skill.realPath === keep.realPath ? { body: 1, description: 1 } : similarity(keep, skill);
      lines.push(
        `  - ${skill.scope}: ${skill.path} (body=${formatPct(score.body)}, description=${formatPct(score.description)})`,
      );
    }
  }
  if (byBase.length === 0) lines.push("- none");
  lines.push("");

  lines.push("## Duplicate Delete Suggestions", "");
  lines.push(...duplicateDeleteSuggestions(byBase));
  lines.push("");

  lines.push("## Duplicates By Body Hash", "");
  for (const [, list] of byBody.slice(0, 30)) {
    lines.push(`- ${list.map((skill) => skill.name).join(", ")}`);
    for (const skill of list) lines.push(`  - ${skill.scope}: ${skill.path}`);
  }
  if (byBody.length === 0) lines.push("- none");
  lines.push("");

  if (!noLogs) {
    lines.push("## Unused Candidates", "");
    for (const skill of unused) {
      const item = usage.get(skill.name) ?? { toolCall: 0, fileRead: 0, slash: 0 };
      lines.push(
        `- ${skill.name}: ${skill.scope}; tool=${item.toolCall}, reads=${item.fileRead}, slash=${item.slash}; ${skill.path}`,
      );
    }
    if (unused.length === 0) lines.push("- none");
    lines.push("");
  }

  lines.push("## Root Summary", "");
  for (const [root, list] of [...roots.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const disabled = list.filter((skill) => !skill.enabled).length;
    lines.push(`- ${root}: ${list.length} skills${disabled ? `, ${disabled} disabled` : ""}`);
  }
  return lines.join("\n");
}

const skills = discoverSkills();
const logFiles = recentLogFiles();
const usage = scanUsage(skills, logFiles);
const consideredSkills = skills.filter((skill) => skill.enabled || includeAll);
const budget = skillBudget(consideredSkills);
const output = json
  ? JSON.stringify({ skills, usage: Object.fromEntries(usage), logFiles, budget }, null, 2)
  : render(skills, usage, logFiles);
console.log(output);
