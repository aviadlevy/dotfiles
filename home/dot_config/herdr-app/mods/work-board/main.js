// Work board: every agent session in Herdr on one page, as robots standing in the zone of their
// state (field.js draws it). Reads Herdr's live state, ~/.local/state/orchestrate/*/state.md and
// `glab mr view <branch>`; changes nothing. Opens as a tab (keys.json: tab.new {mod: "work-board"}).
import { View } from "gpui-kit";
import { v_flex } from "gpui-base";
import { agents, panes, terminals, exec, home, readTextFile, watchFolder, run, theme, shared } from "herdr";
import { TICKET, parseRun, runWorkers, workerFor, pendingTarget, statLines, webUrl, jiraServer, ago } from "./state.js";
import { ticketFromBranch, parseMr, ciOf } from "./sessions.js";
import { buildCrew } from "./crew.js";
import { spaceColor } from "./ui.js";
import { board } from "./field.js";

const STALE_MIN = 30; // a run's state.md this old, with nothing in it working, looks stuck
const TICK_MS = 5000; // asks GitLab about new branches; statuses repaint on their own (agents() is live)
const AGE_MS = 60000; // the "4m" ages change once a minute
const POLL_TICKS = 6; // no run folder to watch yet: reload runs every 6 ticks instead
const MR_TTL_MS = 120000; // ask GitLab about a branch's MR at most every 2 minutes
const DEFAULT_BRANCHES = new Set(["main", "master", "development", "develop"]); // never an MR's source

const mrKey = (pane) => `${pane.cwd}\n${pane.branch}`;
const JIRA_KEY = new RegExp(`^${TICKET.source}$`);

export default class WorkBoard extends View {
  init(_props, cx) {
    this.root = `${home()}/.local/state/orchestrate`;
    this.runs = []; this.bases = new Map(); this.mrs = new Map(); this.seen = new Map();
    this.jira = null; this.glab = null; this.expanded = {}; this.fieldW = null;
    this.polling = false; this.ticks = 0; this.fetching = false;
    this.act = {
      focus: (address) => run("agent.focus", { terminal: address }),
      open: (url) => exec("/usr/bin/open", [url]),
      isOpen: (key) => Boolean(this.expanded[key]),
      toggle: (key) => { this.expanded = { ...this.expanded, [key]: !this.expanded[key] }; },
    };
    cx.spawn(async (cx) => {
      this.jira = jiraServer(await readTextFile(`${home()}/.config/.jira/.config.yml`));
      // Herdr can start with launchd's bare PATH, so find glab the way a login shell does.
      const found = (await exec("/bin/zsh", ["-lc", "command -v glab"])).stdout.trim().split("\n").pop();
      this.glab = found?.startsWith("/") ? found : null;
      for (;;) {
        await this.loadRuns();
        cx.notify();
        try { await watchFolder(this.root); } catch { this.polling = true; return; } // rejects while the folder doesn't exist
      }
    });
    cx.timer.every(TICK_MS, (cx) => {
      const reload = this.polling && ++this.ticks % POLL_TICKS === 0;
      cx.spawn(async (cx) => {
        if (reload) await this.loadRuns();
        if ((await this.loadMrs()) || reload) cx.notify();
      });
    });
    cx.timer.every(AGE_MS, (cx) => cx.notify());
  }

  // ---- data ------------------------------------------------------------------------------------
  // Every run folder's state.md, re-read only when its mtime changed.
  // shortcut: `stat -f` is BSD (macOS) syntax and Herdr's fs/promises has no stat; a Linux Herdr needs `stat -c "%Y %n"`.
  async loadRuns() {
    const names = (await exec("/bin/ls", [this.root])).stdout.split("\n").filter(Boolean);
    const stats = names.length ? statLines((await exec("/usr/bin/stat", ["-f", "%m %N", ...names.map((n) => `${this.root}/${n}/state.md`)])).stdout) : [];
    const runs = [];
    for (const { mtime, file } of stats) {
      const old = this.runs.find((r) => r.file === file);
      if (old?.mtime === mtime) { runs.push(old); continue; }
      const md = await readTextFile(file);
      if (!md) continue;
      const parsed = parseRun(md);
      runs.push({ file, mtime, name: file.slice(this.root.length + 1, -"/state.md".length), run: parsed, mrBase: await this.mrBase(parsed.repo) });
    }
    this.runs = runs;
  }

  async mrBase(repo) {
    if (!repo) return null;
    if (!this.bases.has(repo)) {
      const web = webUrl((await exec("/usr/bin/git", ["-C", repo, "remote", "get-url", "origin"])).stdout);
      this.bases.set(repo, web ? `${web}/-/merge_requests/` : null);
    }
    return this.bases.get(repo);
  }

  // The MR of each agent's branch, from GitLab; answers older than MR_TTL_MS are asked again.
  // Answers whether it asked GitLab anything, so the tick repaints only then.
  async loadMrs() {
    if (this.fetching || !this.glab) return false;
    this.fetching = true;
    let asked = false;
    try {
      const mine = new Set(agents().map((a) => a.address));
      const wanted = panes().filter((p) => mine.has(p.terminal) && p.cwd && p.branch && !DEFAULT_BRANCHES.has(p.branch));
      for (const p of wanted) {
        if (Date.now() - (this.mrs.get(mrKey(p))?.at ?? 0) < MR_TTL_MS) continue;
        const r = await exec(this.glab, ["mr", "view", p.branch, "--output", "json"], { cwd: p.cwd });
        this.mrs.set(mrKey(p), { at: Date.now(), mr: parseMr(r.stdout) });
        asked = true;
      }
      const keep = new Set(wanted.map(mrKey));
      for (const k of this.mrs.keys()) if (!keep.has(k)) this.mrs.delete(k);
    } catch {
      // glab couldn't start: keep the last answers; the next tick tries again
    } finally {
      this.fetching = false;
    }
    return asked;
  }

  // ---- model: everything the page draws, built once per render ----------------------------------
  // When each agent's status last changed, as this board saw it: Herdr's status_ms is empty or stale
  // for some agents. Unknown (null) until the first change after the board opens. It writes during
  // render on purpose: render is where the board sees each status.
  sinceOf(address, status, now) {
    const s = this.seen.get(address);
    if (!s || s.status !== status) this.seen.set(address, { status, at: s ? now : null });
    return this.seen.get(address).at;
  }

  jiraUrl(key) { return this.jira && JIRA_KEY.test(key ?? "") ? `${this.jira}/browse/${key}` : null; }

  // shortcut: model/runModel (which robot a run's wait goes to, stale, flight/later) and sinceOf live here,
  // untested, because main.js imports herdr and node can't load it; move them into crew.js with a test
  // when they next change.
  model(t) {
    const now = Date.now();
    const live = terminals().filter((x) => x.state === "live");
    const liveBy = new Map(live.map((x) => [x.address, x]));
    const paneBy = new Map(panes().filter((p) => p.terminal).map((p) => [p.terminal, p]));
    const all = agents();
    const agentBy = new Map(all.map((a) => [a.address, a]));
    const colors = shared("space.colors") ?? {};
    const space = (a) => ({ name: a?.space_name ?? "?", color: spaceColor(t, colors[a?.space]) });
    // Only runs whose orchestrator is alive: a finished run's state.md is a frozen snapshot.
    const runs = this.runs.filter((r) => liveBy.has(r.run.orchestrator)).map((r) => this.runModel(r, live, liveBy, agentBy, space, now));
    const sessions = all.map((a) => this.sessionModel(a, liveBy.get(a.address), paneBy.get(a.address), space(a), now));
    // A run's orchestrator and workers that aren't agents (a plain shell, say) still get a robot, in the run's space.
    const loose = new Map();
    for (const r of runs) {
      for (const w of [{ ...r.orch, name: r.name }, ...r.workers]) {
        if (agentBy.has(w.address) || loose.has(w.address)) continue;
        loose.set(w.address, { address: w.address, status: w.status, since: this.sinceOf(w.address, w.status, now), space: r.space,
          program: null, tab: null, title: w.name, msg: liveBy.get(w.address)?.report?.msg ?? null, ticket: null, mr: null });
      }
    }
    const crew = buildCrew([...sessions, ...loose.values()], runs);
    const keep = new Set(crew.map((c) => c.address));
    for (const k of this.seen.keys()) if (!keep.has(k)) this.seen.delete(k);
    return { now, runs, crew };
  }

  sessionModel(a, term, pane, space, now) {
    const mr = pane ? this.mrs.get(mrKey(pane))?.mr ?? null : null;
    const key = ticketFromBranch(pane?.branch);
    return {
      address: a.address, status: a.status, since: this.sinceOf(a.address, a.status, now), space, program: a.program,
      tab: /^\d+$/.test(a.tab_name) ? null : a.tab_name, title: a.title || a.tab_name, // numbered tabs add nothing
      msg: term?.report?.msg ?? null,
      ticket: key ? { key, url: this.jiraUrl(key) } : null,
      mr: mr ? { label: `!${mr.iid}`, url: mr.url, ci: ciOf(mr) } : null,
    };
  }

  runModel(r, live, liveBy, agentBy, space, now) {
    const orch = liveBy.get(r.run.orchestrator);
    const statusOf = (x) => agentBy.get(x.address)?.status ?? x.status;
    const workers = runWorkers(r.run, live).map((w) => ({ address: w.address, name: w.name ?? w.address, status: statusOf(w) }));
    const ageSec = now / 1000 - r.mtime;
    const busy = [orch, ...workers].some((x) => statusOf(x) === "working");
    const mrOf = (it) => (it.mr ? { label: it.mr.id, url: r.mrBase && it.mr.num ? r.mrBase + it.mr.num : null, ci: it.mr.ci } : null);
    const ticketOf = (it) => ({ key: it.ticket, url: this.jiraUrl(it.ticket) });
    const workerOf = (it) => { const w = workerFor(r.run, it, live); return w ? workers.find((x) => x.address === w.address) ?? null : null; };
    const rowOf = (it) => ({ id: it.ticket, worker: workerOf(it), ticket: ticketOf(it), title: it.title, mr: mrOf(it), note: it.mr?.waiting ?? "", hot: it.you.length > 0, dim: it.phase === "Done" });
    const of = (p) => r.run.items.filter((it) => it.phase === p);
    // The run's waits on you, each on the robot it goes through: the worker that owns the ticket or
    // is named in the pending line, else the orchestrator.
    const ask = (text, to, it) => ({ verb: "asks you", text, to: to.address, since: r.mtime * 1000, mr: it ? mrOf(it) : null, ticket: it ? ticketOf(it) : null });
    return {
      name: r.name, space: space(agentBy.get(orch.address)), age: ago(ageSec), stale: ageSec > STALE_MIN * 60 && !busy,
      orch: { address: orch.address, status: statusOf(orch) }, workers,
      flight: of("In flight").map(rowOf), later: [...of("Planned"), ...of("Done")].map(rowOf), planned: of("Planned").length, done: of("Done").length,
      asks: [
        ...r.run.pending.map((p) => ask(p, pendingTarget(p, live) ?? orch)),
        ...of("In flight").flatMap((it) => it.you.map((y) => ask(y, workerFor(r.run, it, live) ?? orch, it))),
      ],
    };
  }

  // ---- view ------------------------------------------------------------------------------------
  // The field's width, for placing robots in pixels: null until the first layout reports it.
  geo() {
    return {
      width: this.fieldW,
      measure: (w, cx) => { if (Math.abs(w - this.fieldW) >= 2) { this.fieldW = w; cx.notify(); } },
    };
  }

  render() {
    const t = theme();
    return v_flex().id("root").size_full().bg(t.background).text_color(t.foreground).text_size(12.5)
      .child(board(t, this.model(t), this.act, this.geo()));
  }
}
