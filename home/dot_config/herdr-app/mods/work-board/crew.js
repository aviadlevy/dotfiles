// Who stands where on the Work board's field. Pure, so `node --test` covers it (board.test.mjs).

export const ZONES = [["needs", "Needs you"], ["working", "Working"], ["done", "Finished"], ["rest", "Resting"]];
export const CELL_W = 120, CELL_H = 156; // one robot with its name and links; in Needs you, its bubble starts past CELL_W
const ASK_H = 128, HEAD = 46, PAD = 12, GAP = 12, MIN_W = 150, MIN_H = 250;
const BUBBLE_MIN = 180; // Needs you is never so narrow that a bubble spills into Working
const TEAM = ["#f5c542", "#ff8fab", "#7ee0ff", "#b5f07a"];
export const teamColor = (i) => TEAM[i % TEAM.length]; // the i-th live run's belt color, shared by its robots

// One robot per session: every agent, plus run workers that aren't agents. A run's robots share a team
// and its orchestrator leads it. A robot needs you when its agent asks (Herdr's "blocked"), or when its
// run's state.md waits on you through it; otherwise its zone is its status: finished (unseen), working, resting.
// `runs[].asks` are already { verb, text, to, since, mr, ticket }.
export function buildCrew(sessions, runs) {
  const teamOf = new Map(), rowOf = new Map(), runAsks = new Map(), here = new Set(sessions.map((s) => s.address));
  runs.forEach((r, i) => {
    const color = teamColor(i);
    teamOf.set(r.orch.address, { name: r.name, color, lead: true });
    for (const w of r.workers) teamOf.set(w.address, { name: r.name, color, lead: false, worker: w.name });
    for (const row of r.flight) if (row.worker && !rowOf.has(row.worker.address)) rowOf.set(row.worker.address, row);
    for (const a of r.asks) {
      const at = here.has(a.to) ? a.to : r.orch.address; // a wait through a terminal with no robot shows on the orchestrator
      runAsks.set(at, [...(runAsks.get(at) ?? []), a]);
    }
  });
  return sessions.map((s) => {
    const team = teamOf.get(s.address) ?? null, row = rowOf.get(s.address);
    const own = s.status === "blocked" ? [{ verb: "asks you", text: s.msg ?? s.title, to: s.address, since: s.since, mr: s.mr, ticket: s.ticket }] : [];
    const asks = [...own, ...(runAsks.get(s.address) ?? [])];
    const zone = asks.length ? "needs" : s.status === "done" ? "done" : s.status === "working" ? "working" : "rest";
    return { ...s, team, asks, zone, name: team?.worker ?? s.tab ?? s.space.name, ticket: row?.ticket ?? s.ticket, mr: row?.mr ?? s.mr };
  });
}

// Where every zone and robot goes in a field `width` pixels wide: zones side by side, a busy zone
// wider. Needs you stacks one robot per row with its bubble beside it; the others fill a centered grid.
export function layout(width, crew) {
  const by = Object.fromEntries(ZONES.map(([k]) => [k, []]));
  for (const c of crew) by[c.zone].push(c);
  const order = (c) => `${c.team?.name ?? "~"}\u0000${c.team?.lead ? 0 : 1}${c.name}\u0000${c.address}`; // a run's robots side by side
  for (const k in by) by[k].sort((a, b) => order(a).localeCompare(order(b)));
  const weight = (k, n) => (k === "needs" ? (n ? 2.8 : 0.7) : 0.7 + Math.min(n, 5) * 0.35);
  const ws = ZONES.map(([k]) => weight(k, by[k].length));
  const total = ws.reduce((a, b) => a + b, 0);
  const mins = ZONES.map(([k]) => (k === "needs" && by[k].length ? CELL_W + 2 * PAD + BUBBLE_MIN : MIN_W));
  const spare = Math.max(0, width - GAP * (ZONES.length - 1) - mins.reduce((a, b) => a + b, 0));
  const zones = [], spots = new Map();
  let x = 0, height = MIN_H;
  ZONES.forEach(([key, label], i) => {
    const w = Math.floor(mins[i] + (spare * ws[i]) / total), list = by[key];
    if (key === "needs") {
      list.forEach((c, j) => spots.set(c.address, { x: x + PAD, y: HEAD + j * ASK_H, bubbleW: w - 2 * PAD - CELL_W }));
      height = Math.max(height, HEAD + list.length * ASK_H + PAD);
    } else {
      const cols = Math.max(1, Math.floor((w - 2 * PAD) / CELL_W));
      const off = (w - 2 * PAD - Math.min(cols, list.length) * CELL_W) / 2;
      list.forEach((c, j) => spots.set(c.address, { x: x + PAD + off + (j % cols) * CELL_W, y: HEAD + Math.floor(j / cols) * CELL_H }));
      height = Math.max(height, HEAD + Math.ceil(list.length / cols) * CELL_H + PAD);
    }
    zones.push({ key, label, x, w, n: list.length });
    x += w + GAP;
  });
  return { zones, spots, height };
}
