// node --test ~/.config/herdr-app/mods/work-board/board.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRun, runWorkers, workerFor, pendingTarget, statLines, webUrl, jiraServer } from "./state.js";
import { ticketFromBranch, parseMr, ciOf } from "./sessions.js";
import { buildCrew, layout, CELL_W, CELL_H } from "./crew.js";

const MD = `# Orchestration: demo

## Bindings for this run
- Repos: app → /src/app (main); lib → /src/lib
- Orchestrator: terminal t1, Herdr space sp1, permission mode auto

## Workers
| Name | Address | Task | Context % | Since |
|---|---|---|---|---|
| demo-w1 | t2 | DEMO-1 | 10 | now |
| demo-w2 | t3 | DEMO-12, DEMO-2 | 5 | now |

## Tasks
| Ticket | Title | Blockers | Pass criteria | State |
|---|---|---|---|---|
| DEMO-1 | One | | | dispatched |
| DEMO-2 | Two | | | dispatched |
| DEMO-3 | Three | | | planned |

## MRs
| MR | Ticket | Owner | sha | CI | Review | Live test | Waiting on |
|---|---|---|---|---|---|---|---|
| !7 | DEMO-1 | demo-w1 | abc | running | | | user: aws sso login; review bot |
| !8 MERGED | DEMO-9 (docs) | demo-w1 | def | green | | | CI, review bot, then user merge |

## Pending for the user
1. Window action: go to Herdr tab \`demo-w2\`, type \`yes\`
`;

test("parses tables, phases and the user's waits", () => {
  const run = parseRun(MD);
  assert.equal(run.orchestrator, "t1");
  assert.equal(run.repo, "/src/app");
  const by = Object.fromEntries(run.items.map((i) => [i.ticket, i]));
  assert.deepEqual([by["DEMO-1"].phase, by["DEMO-2"].phase, by["DEMO-3"].phase, by["DEMO-9"].phase], ["In flight", "In flight", "Planned", "Done"]);
  assert.deepEqual(by["DEMO-1"].you, ["aws sso login"]);
  assert.deepEqual(by["DEMO-9"].you, [], "a later 'then user' wait is not yours yet");
  assert.equal(by["DEMO-1"].mr.num, "7");
  assert.equal(by["DEMO-9"].title, "DEMO-9 (docs)");
  assert.equal(run.pending.length, 1);
});

test("links workers by owner, Workers task and backticked name", () => {
  const run = parseRun(MD);
  const live = [
    { address: "t1", name: null, parent: null },
    { address: "t2", name: "demo-w1", parent: "t1" },
    { address: "t3", name: "demo-w2", parent: null }, // opened by the user: no parent link
    { address: "t9", name: "other", parent: null },
  ];
  assert.deepEqual(runWorkers(run, live).map((t) => t.address), ["t2", "t3"]);
  const item = (k) => run.items.find((i) => i.ticket === k);
  assert.equal(workerFor(run, item("DEMO-1"), live)?.address, "t2");
  assert.equal(workerFor(run, item("DEMO-2"), live)?.address, "t3");
  assert.equal(workerFor(run, item("DEMO-3"), live), null);
  assert.equal(pendingTarget(run.pending[0], live)?.address, "t3");
});

test("a run without an orchestrator address has no workers", () => {
  const run = parseRun("## Workers\nIn-session subagents.\n");
  assert.equal(run.orchestrator, null);
  assert.deepEqual(runWorkers(run, [{ address: "t5", name: null, parent: null }]), []);
});

test("stat lines, web and Jira URLs", () => {
  assert.deepEqual(statLines("100 /r/a/state.md\n300 /r/b state.md\nstat: /r/c/state.md: No such file\n"),
    [{ mtime: 100, file: "/r/a/state.md" }, { mtime: 300, file: "/r/b state.md" }]);
  assert.deepEqual(statLines(""), []);
  assert.equal(webUrl("git@gitlab.example.com:group/sub/repo.git\n"), "https://gitlab.example.com/group/sub/repo");
  assert.equal(webUrl("ssh://git@host.example:2222/g/r.git"), "https://host.example/g/r");
  assert.equal(webUrl("https://github.com/o/r.git"), "https://github.com/o/r");
  assert.equal(webUrl("/local/path/repo"), null);
  assert.equal(jiraServer("x: 1\nserver: https://acme.atlassian.net/\n"), "https://acme.atlassian.net");
  assert.equal(jiraServer("server: file:///etc"), null);
});

test("a session's ticket and MR", () => {
  assert.equal(ticketFromBranch("feat/DEMO-123-thing"), "DEMO-123");
  assert.equal(ticketFromBranch("docs/50-some-skills"), null);
  assert.equal(ticketFromBranch(null), null);
  const open = parseMr(JSON.stringify({ iid: 70, web_url: "https://git.example/g/r/-/merge_requests/70", state: "opened", head_pipeline: { status: "failed" } }));
  assert.deepEqual([open.iid, ciOf(open)], [70, "failed"]);
  const merged = parseMr(JSON.stringify({ iid: 8, web_url: "https://git.example/x", state: "merged", head_pipeline: { status: "success" } }));
  assert.equal(ciOf(merged), "merged");
  assert.equal(parseMr("ERROR  You must select a merge request"), null);
  assert.equal(parseMr(JSON.stringify({ iid: 1, web_url: "javascript:alert(1)" })).url, null);
});

const sess = (address, status, more = {}) => ({ address, status, since: null, space: { name: "sp", color: "#123456" }, program: null,
  tab: null, title: `title ${address}`, msg: null, ticket: null, mr: null, ...more });

test("each robot's zone, team, name and asks", () => {
  const run = { name: "r1", orch: { address: "t1" }, workers: [{ address: "t2", name: "w1" }],
    flight: [{ worker: { address: "t2" }, ticket: { key: "DEMO-1", url: null }, mr: { label: "!7" } }],
    asks: [{ verb: "asks you", text: "aws sso login", to: "t2", since: 1, mr: null, ticket: null },
      { verb: "asks you", text: "type yes in tab x", to: "t9", since: 1, mr: null, ticket: null }] };
  const crew = buildCrew([sess("t1", "working"), sess("t2", "idle"), sess("t3", "blocked", { msg: "Squash?" }),
    sess("t4", "blocked"), sess("t5", "done"), sess("t6", "idle", { tab: "docs" })], [run]);
  const by = Object.fromEntries(crew.map((c) => [c.address, c]));
  assert.deepEqual(crew.map((c) => c.zone), ["needs", "needs", "needs", "needs", "done", "rest"], "an idle worker the run waits on needs you");
  assert.deepEqual([by.t1.asks[0].text, by.t1.asks[0].to], ["type yes in tab x", "t9"], "a wait through a robot-less terminal shows on the orchestrator");
  assert.deepEqual([by.t1.team.lead, by.t2.team.lead, by.t1.team.color === by.t2.team.color, by.t3.team], [true, false, true, null]);
  assert.deepEqual([by.t2.name, by.t2.ticket.key, by.t2.mr.label, by.t2.asks[0].text], ["w1", "DEMO-1", "!7", "aws sso login"]);
  assert.deepEqual([by.t3.asks[0].verb, by.t3.asks[0].text], ["asks you", "Squash?"]);
  assert.equal(by.t4.asks[0].text, "title t4", "no summary: the title");
  assert.equal(by.t5.asks.length, 0, "finished is its own zone, not a question");
  assert.deepEqual([by.t6.name, by.t5.name], ["docs", "sp"], "a named tab, else the space");
});

test("layout: zones span the field, Needs you stacks, a full zone wraps", () => {
  const bot = (address, zone) => ({ address, zone, name: address, team: null });
  const busy = ["w1", "w2", "w3", "w4", "w5", "w6", "w7"];
  const crew = [bot("a", "needs"), bot("b", "needs"), ...busy.map((k) => bot(k, "working")), bot("r", "rest")];
  const L = layout(1200, crew);
  const last = L.zones.at(-1);
  assert.ok(Math.abs(last.x + last.w - 1200) <= 4, "the zones fill the width");
  assert.deepEqual(L.zones.map((z) => z.n), [2, 7, 0, 1]);
  const [a, b] = [L.spots.get("a"), L.spots.get("b")];
  assert.ok(a.x === b.x && b.y > a.y && a.bubbleW > 100, "one robot per row, room for its bubble");
  const working = L.zones[1], spots = busy.map((k) => L.spots.get(k));
  assert.ok(new Set(spots.map((p) => p.y)).size > 1);
  assert.ok(spots.every((p) => p.x >= working.x && p.x + CELL_W <= working.x + working.w), "robots stay in their zone");
  assert.ok(Math.max(...spots.map((p) => p.y)) + CELL_H <= L.height, "the field is tall enough");
  assert.ok(layout(300, crew).zones.every((z) => z.w >= CELL_W), "a narrow window still fits a robot per zone");
  for (const width of [700, 900]) {
    const N = layout(width, crew), needs = N.zones[0], p = N.spots.get("a");
    assert.ok(p.bubbleW >= 180 && p.x + CELL_W - 4 + p.bubbleW <= needs.x + needs.w, `at ${width}px the bubble stays in Needs you`);
  }
});
