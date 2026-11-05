// Turns an /orchestrate run's state.md (format: ~/.agents/skills/orchestrate/state-template.md) into
// what the board shows. Pure: no Herdr or file access, so `node --test` covers it (board.test.mjs).

export const TICKET = /[A-Z][A-Z0-9]+-\d+/; // a Jira-style key; the one definition the board uses
const TICKETS = new RegExp(TICKET.source, "g");

function section(md, heading) {
  const i = md.indexOf(`\n## ${heading}`);
  if (i < 0) return "";
  const rest = md.slice(i + 4 + heading.length);
  const j = rest.indexOf("\n## ");
  return j < 0 ? rest : rest.slice(0, j);
}

function table(md, heading) {
  const rows = section(md, heading).split("\n").filter((l) => l.trim().startsWith("|"));
  if (rows.length < 3) return [];
  const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const head = cells(rows[0]);
  return rows.slice(2).map((l) => Object.fromEntries(cells(l).map((c, k) => [head[k], c])));
}

function pending(md) {
  return section(md, "Pending for the user").split("\n").map((l) => l.trim())
    .filter((l) => /^(-|\d+\.)\s/.test(l) && !/\(none\)/i.test(l))
    .map((l) => l.replace(/^(-|\d+\.)\s+/, ""));
}

// "Waiting on" separates parallel waits with ";". A wait that starts with "user" is the user's to do
// now; "CI, review bot, then user merge" becomes theirs later, so it doesn't count.
function yourWaits(waiting) {
  return waiting.split(/;\s*/).map((s) => s.trim()).filter((s) => /^user\b/i.test(s))
    .map((s) => s.replace(/^user\b[:\s]*/i, ""));
}

function phaseOf(state, mr) {
  if (/merged/i.test(mr?.id ?? "") || /^(done|merged)/i.test(state)) return "Done";
  if (mr || /dispatch|progress|working/i.test(state)) return "In flight";
  return "Planned";
}

export function parseRun(md) {
  const mrs = table(md, "MRs").map((m) => ({
    id: m.MR ?? "",
    num: m.MR?.match(/!(\d+)/)?.[1] ?? null,
    ticket: m.Ticket?.match(TICKET)?.[0] ?? m.Ticket ?? "",
    label: m.Ticket ?? "",
    owner: m.Owner ?? "",
    ci: m.CI ?? "",
    waiting: m["Waiting on"] ?? "",
  }));
  const byTicket = new Map(mrs.map((m) => [m.ticket, m]));
  const items = table(md, "Tasks").map((t) => ({ ticket: t.Ticket ?? "", title: t.Title ?? "", state: t.State ?? "" }));
  for (const m of mrs) if (!items.some((i) => i.ticket === m.ticket)) items.push({ ticket: m.ticket, title: m.label, state: "" });
  return {
    orchestrator: md.match(/Orchestrator: terminal ([^\s,]+)/)?.[1] ?? null,
    // shortcut: MR links use the first repo under "Repos:"; a multi-repo run needs a Repo column in the MR table.
    repo: md.match(/Repos:[^\n]*?→\s*([^\s;(]+)/)?.[1] ?? null,
    workers: table(md, "Workers").map((w) => ({ name: w.Name ?? "", address: w.Address ?? "", task: w.Task ?? "" })),
    pending: pending(md),
    items: items.map((i) => {
      const mr = byTicket.get(i.ticket) ?? null;
      return { ...i, mr, phase: phaseOf(i.state, mr), you: mr ? yourWaits(mr.waiting) : [] };
    }),
  };
}

// The run's live agents besides the orchestrator: its children (workers it started), plus the
// terminals the Workers table names (workers the user opened have no parent link).
export function runWorkers(run, live) {
  const named = (t) => run.workers.some((w) => (w.address && w.address === t.address) || (w.name && w.name === t.name));
  const child = (t) => run.orchestrator != null && t.parent === run.orchestrator; // null would match every parentless terminal
  return live.filter((t) => t.address !== run.orchestrator && (child(t) || named(t)));
}

// The live terminal on an item: the MR Owner names it, or a Workers row's Task names the ticket.
export function workerFor(run, item, live) {
  const owner = item.mr?.owner;
  const row = run.workers.find((w) => (owner && w.name === owner) || (item.ticket && (w.task.match(TICKETS) ?? []).includes(item.ticket)));
  return live.find((t) => (owner && t.name === owner) || (row && ((row.address && t.address === row.address) || (row.name && t.name === row.name)))) ?? null;
}

// A pending line that names a live terminal in backticks ("go to Herdr tab `run-w2`, type …").
export function pendingTarget(text, live) {
  return [...text.matchAll(/`([^`]+)`/g)].map((m) => live.find((t) => t.name === m[1])).find(Boolean) ?? null;
}

// `stat -f "%m %N"` output → [{ mtime, file }]; lines for missing files (errors) are dropped.
export function statLines(statOut) {
  return statOut.split("\n").filter(Boolean)
    .map((l) => { const i = l.indexOf(" "); return { mtime: Number(l.slice(0, i)), file: l.slice(i + 1) }; })
    .filter((f) => f.mtime > 0 && f.file);
}

// Web URL of a git remote (scp-style, ssh:// or https://); null for anything else, so only https opens.
export function webUrl(remote) {
  const url = remote.trim().replace(/\.git$/, "")
    .replace(/^git@([^:/]+):/, "https://$1/").replace(/^ssh:\/\/git@([^/:]+)(:\d+)?\//, "https://$1/");
  return /^https:\/\/[^\s/]+\/\S+$/.test(url) ? url : null;
}

// The jira CLI's `server:` (~/.config/.jira/.config.yml), https only.
export function jiraServer(yml) {
  return yml?.match(/^server:\s*(https:\/\/[^\s/]+)\/?\s*$/m)?.[1] ?? null;
}

export function ago(sec) {
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 172800) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
