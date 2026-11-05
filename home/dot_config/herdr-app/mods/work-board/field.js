// The Work board's page. Every agent is a small robot standing in the zone of its state: Needs you,
// Working, Finished, Resting. When its state changes it walks there (a native spring on left/top);
// one that needs you holds a speech bubble with the question. Under the field, each live /orchestrate
// run lists its tickets. Click a robot or bubble to go to that agent, a ticket for Jira, an MR for GitLab.
import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { MONO, alpha, since, ciIcon, programIcon, sectionLabel, ticketTag, mrPill, statusDot, clickable } from "./ui.js";
import { CELL_W, layout, teamColor } from "./crew.js";

const ART = (n) => `mods/work-board/${n}.svg`;
const ICON = (n) => `mods/workspace-chrome/${n}.svg`;
const WALK = { response: 800, damping: 0.62 }; // under 1 overshoots a little: the robot lands with a bounce
const SLIDE = { duration: 450, easing: "ease-in-out" };
// Per zone: its theme color, the robot's light (visor and antenna), its hop [px, ms], and the empty line.
// The lights are fixed colors, not theme ones: they are art on a visor that is always dark.
const ZONE = {
  needs: { color: "blocked", glow: "#ff7a90", hop: [10, 760], empty: "All clear" },
  working: { color: "working", glow: "#7ee0ff", hop: [4, 460], empty: "Nobody is working" },
  done: { color: "done", glow: "#7dffa8", hop: [3, 1800], empty: "Nothing new" },
  rest: { color: "dim", glow: "#56637a", hop: null, empty: "Nobody resting" },
};
const GOLD = "#f5c542"; // the orchestrator's crown

const hash = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s ?? "");
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// `geo.width` (null until the first layout) places robots in pixels; `geo.measure` keeps it current.
export function board(t, m, act, geo) {
  const spaces = new Set(m.crew.map((c) => c.space.name)).size;
  return v_flex().id("scroll").flex_1().min_h(0).overflow_y_scrollbar().px(20).pt(18).pb(16).gap(20)
    .child(v_flex().gap(2)
      .child(div().text_size(22).font_bold().child("Work"))
      .child(div().text_size(12).text_color(t.dim).child(
        [plural(m.crew.length, "agent"), plural(spaces, "space"), m.runs.length ? plural(m.runs.length, "run") : null].filter(Boolean).join(" · "))))
    .child(div().id("measure").w_full().on_size_change((size, cx) => geo.measure(size.width, cx))
      .when(geo.width != null, (el) => el.child(field(t, m, act, geo.width))))
    .children(m.runs.map((r, i) => runCard(t, r, teamColor(i), act)));
}

function field(t, m, act, width) {
  const L = layout(width, m.crew);
  // Drawn in a fixed order: each robot keeps its id, so its spring carries it to the new spot.
  const crew = [...m.crew].sort((a, b) => a.address.localeCompare(b.address));
  return div().id("field").relative().w_full().h(L.height).transition("height", SLIDE)
    .children(L.zones.map((z) => zonePanel(t, z, L.height)))
    .children(crew.map((c) => bot(t, c, L.spots.get(c.address), m.now, act)));
}

function zonePanel(t, z, h) {
  const c = t[ZONE[z.key].color];
  const hot = z.key === "needs" && z.n > 0;
  return div().id(`zone-${z.key}`).absolute().top(0).left(z.x).w(z.w).h(h).rounded(16)
    .transition("left", SLIDE).transition("width", SLIDE).transition("height", SLIDE)
    .bg(alpha(c, hot ? "14" : "09")).border(1).border_color(alpha(c, hot ? "44" : "1c"))
    .when(hot, (el) => el.child(div().absolute().inset_0().rounded(16).border(2).border_color(c).loop("opacity", { from: 0.1, to: 0.65, period: 1800 })))
    .child(div().absolute().top(16).left(16).child(sectionLabel(t, z.label, z.n, z.n ? c : t.dim)))
    .when(z.n === 0, (el) => el.child(h_flex().absolute().left(0).right(0).top(h / 2 - 10).justify_center().gap(6).items_center()
      .text_size(12).text_color(alpha(t.dim, "bb"))
      .when(z.key === "needs", (e2) => e2.child(svg(ICON("circle-check")).size(14).text_color(alpha(t.done, "aa"))))
      .child(ZONE[z.key].empty)));
}

// ---- one robot, with its name and links underneath ------------------------------------------------
function bot(t, c, p, now, act) {
  const asks = c.zone === "needs";
  const go = () => act.focus(c.asks[0]?.to ?? c.address);
  return v_flex().id(`bot-${c.address}`).absolute().left(p.x).top(p.y).w(CELL_W).items_center().gap(2)
    .spring("left", WALK).spring("top", WALK)
    .child(clickable(robot(t, c).id(`bot-${c.address}-r`), go))
    .child(h_flex().max_w(CELL_W - 4).gap(4).items_center()
      .child(programIcon(t, c.program, ZONE[c.zone].glow, 11))
      .child(div().truncate().text_size(11.5).font_semibold().text_color(c.zone === "rest" ? t.muted : t.foreground).child(c.name)))
    .when(!asks, (el) => el
      .child(h_flex().h(16).gap(5).items_center()
        .child(ticketTag(t, `bot-${c.address}-t`, c.ticket, act))
        .when(!c.ticket?.key && Boolean(c.since), (e2) => e2.child(div().text_size(10.5).text_color(t.dim).child(since(c.since, now)))))
      .when(Boolean(c.mr?.label), (e2) => e2.child(mrPill(t, `bot-${c.address}-m`, c.mr, act))))
    .when(asks, (el) => el.child(bubble(t, c, p.bubbleW, now, act, go)));
}

// The 40x44 sprite in critter.svg drawn S times larger; every offset below is in sprite units.
const S = 1.5, u = (n) => n * S;
const BODY_TOP = 10; // room above the head for the crown, the z's and the badges

function robot(t, c) {
  const h = hash(c.address);
  const { glow, hop } = ZONE[c.zone]; // hop: [height px, period ms]
  const top = u(BODY_TOP);
  const body = div().absolute().left(u(2)).top(top).w(u(40)).h(u(44))
    .when(Boolean(hop), (el) => el.loop("top", { from: top, to: top - hop[0], period: hop[1] + (h % 5) * 40 }))
    .child(svg(ART("critter")).absolute().left(0).top(0).w(u(40)).h(u(44)).text_color(c.space.color))
    .child(div().absolute().left(u(16.5)).top(0).size(u(7)).rounded(u(4)).bg(glow)
      .when(c.zone === "working" || c.zone === "needs", (el) => el.loop("opacity", { from: 0.3, to: 1, period: c.zone === "needs" ? 520 : 1000 })))
    .when(Boolean(c.team?.lead), (el) => el.child(svg(ART("crown")).absolute().left(u(11)).top(u(-9)).w(u(18)).h(u(12)).text_color(GOLD)))
    .child(h_flex().absolute().left(u(9)).top(u(15)).w(u(22)).h(u(13)).rounded(u(6.5)).bg("#0b1120").justify_center().items_center()
      .child(eyes(c, h).text_size(12).font_family(MONO).font_bold().text_color(glow)))
    .when(Boolean(c.team), (el) => el.child(div().absolute().left(u(7)).top(u(29.5)).w(u(26)).h(u(3.5)).rounded(u(2)).bg(c.team.color)));
  return div().relative().w(u(44)).h(u(BODY_TOP + 48)).flex_none()
    .child(div().absolute().left(u(9)).top(u(BODY_TOP + 41)).w(u(26)).h(u(4.5)).rounded(u(2.5)).bg("#00000066"))
    .child(body)
    .child(badge(t, c));
}

// Eyes on the visor. Frame lists of different lengths keep the robots from blinking in unison.
function eyes(c, h) {
  if (c.zone === "done") return div().child("^ ^");
  if (c.zone === "rest") return div().child("- -");
  const awake = c.zone === "needs" ? "o o" : "• •";
  return div().frames([...Array(8 + (h % 7)).fill(awake), "- -"], 160);
}

// What floats beside the head: typing dots, a red "!", a check, or z's.
function badge(t, c) {
  if (c.zone === "working") {
    return h_flex().absolute().left(u(31)).top(u(2)).w(u(17)).h(u(10)).rounded(u(5)).bg(alpha(t.foreground, "f0")).items_center().pl(u(3))
      .child(div().text_size(13).font_bold().text_color(t.background).frames(["•", "••", "•••", "•••", " "], 260));
  }
  if (c.zone === "needs") {
    return div().absolute().left(u(30)).top(u(1)).size(u(12)).rounded(u(6)).bg(t.blocked).flex().items_center().justify_center()
      .text_size(13).font_bold().text_color("#ffffff").loop("opacity", { from: 0.45, to: 1, period: 700 }).child("!");
  }
  if (c.zone === "done") {
    return div().absolute().left(u(30)).top(u(1)).size(u(12)).rounded(u(6)).bg(t.background).flex().items_center().justify_center()
      .child(svg(ICON("circle-check")).size(u(11)).text_color(t.done));
  }
  const z = (left, size, from, period) => div().absolute().left(u(left)).top(u(from)).text_size(size).font_bold().text_color(t.muted)
    .loop("top", { from: u(from), to: u(from - 8), period }).loop("opacity", { from: 0.9, to: 0.05, period }).child("z");
  return div().absolute().left(0).top(0).size_full().child(z(34, 13, 10, 2600)).child(z(40, 10, 3, 3300));
}

// The speech bubble of a robot that needs you: what it asks, how long ago, and its links. Inverted
// colors (paper is the theme's text color), so it stands out in a light theme as in a dark one.
function bubble(t, c, w, now, act, go) {
  const a = c.asks[0];
  const ink = t.background, paper = t.foreground;
  const chip = (id, kids, url) => h_flex().id(id).flex_none().gap(4).px(7).h(19).rounded(10).items_center().bg(alpha(ink, "14"))
    .text_size(10.5).font_family(MONO).children(kids)
    .when(Boolean(url), (el) => clickable(el.hover((s) => s.bg(alpha(ink, "28"))), () => act.open(url)));
  return clickable(v_flex().id(`bub-${c.address}`).absolute().left(CELL_W - 4).top(14).w(w).gap(5).px(12).py(9).rounded(14)
    .bg(paper).text_color(ink).shadow_lg(), go)
    .child(svg(ART("tail")).absolute().left(-7).top(22).w(8).h(14).text_color(paper))
    .child(h_flex().gap(6).items_center()
      .child(div().text_size(10).font_family(MONO).font_bold().text_color(t.blocked).child(a.verb.toUpperCase()))
      .when(Boolean(a.since), (el) => el.child(div().text_size(10.5).text_color(alpha(ink, "88")).child(since(a.since, now))))
      .when(c.asks.length > 1, (el) => el.child(div().text_size(10.5).text_color(alpha(ink, "88")).child(`+${c.asks.length - 1} more`)))
      .child(div().flex_1())
      .child(div().text_size(11).font_semibold().text_color(alpha(ink, "bb")).child("Go →")))
    .child(div().text_size(13).whitespace_normal().max_h(40).overflow_hidden().child(clip(a.text, 150)))
    .when(Boolean(a.ticket?.key || a.mr?.label), (el) => el.child(h_flex().gap(6).items_center()
      .when(Boolean(a.ticket?.key), (e2) => e2.child(chip(`bub-${c.address}-t`, [div().child(a.ticket.key)], a.ticket.url)))
      .when(Boolean(a.mr?.label), (e2) => e2.child(chip(`bub-${c.address}-m`, [ciIcon(t, a.mr.ci ?? "", 11), div().child(a.mr.label)], a.mr.url)))));
}

// ---- a live /orchestrate run: its orchestrator, then one line per in-flight ticket -------------------
function runCard(t, r, color, act) {
  return v_flex().id(`run-${r.name}`).relative().rounded(14).overflow_hidden().bg(alpha(color, "08")).border(1).border_color(alpha(color, "26")).py(8)
    .child(div().absolute().left(0).top(0).bottom(0).w(3).bg(color))
    .child(h_flex().px(14).py(4).gap(8).items_center()
      .child(svg(ART("crown")).w(15).h(10).text_color(GOLD))
      .child(div().font_semibold().child(r.name))
      .child(div().text_size(11).font_family(MONO).text_color(t.dim).child("orchestrate"))
      .child(div().flex_1())
      .child(div().text_size(11).text_color(r.stale ? t.blocked : t.dim).child(`${r.stale ? "last change" : "updated"} ${r.age}`)))
    .child(runTree(t, r, act));
}

// Orchestrator, then ├─ one line per in-flight ticket (worker, ticket, title, MR, what it waits on),
// then a folded "N planned · N done".
function runTree(t, r, act) {
  const node = (id, connector, kids) => h_flex().id(id).px(12).min_h(32).gap(10).items_center()
    .child(div().w(22).flex_none().font_family(MONO).text_color(alpha(t.dim, "aa")).child(connector)).children(kids);
  const name = (id, text, address) => clickable(div().id(id).font_semibold().hover((s) => s.underline()).child(text), () => act.focus(address));
  const row = (row, last) => node(`${r.name}-${row.id}`, last ? "└─" : "├─", [
    row.worker ? statusDot(t, row.worker.status, 7) : div().size(7).mx(2).rounded(4).bg(alpha(t.dim, "55")),
    row.worker ? name(`${r.name}-${row.id}-w`, row.worker.name, row.worker.address).w(110).flex_none().truncate()
      : div().w(110).flex_none().text_color(t.dim).child("—"),
    ticketTag(t, `${r.name}-${row.id}-t`, row.ticket, act),
    div().flex_1().min_w(0).truncate().text_color(row.dim ? t.dim : t.muted).child(row.title),
    mrPill(t, `${r.name}-${row.id}-m`, row.mr, act),
    div().w(280).flex_none().truncate().text_size(12).text_color(row.hot ? t.blocked : t.dim).child(row.note),
  ]);
  const laterKey = `later-${r.name}`;
  const open = act.isOpen(laterKey);
  return v_flex()
    .child(node(`${r.name}-orch`, "", [statusDot(t, r.orch.status, 8), name(`${r.name}-orch-n`, "orchestrator", r.orch.address),
      div().text_size(11.5).text_color(t.dim).child(plural(r.workers.length, "worker"))]))
    .children(r.flight.map((x, i) => row(x, i === r.flight.length - 1 && !r.later.length)))
    .when(r.later.length > 0, (el) => el
      .child(node(`${r.name}-later`, "└─", [clickable(div().id(`${r.name}-later-t`).text_size(11.5).text_color(t.dim).hover((s) => s.text_color(t.foreground))
        .child(`${open ? "▾" : "▸"} ${r.planned} planned · ${r.done} done`), (cx) => { act.toggle(laterKey); cx.notify(); })]))
      .when(open, (el2) => el2.children(r.later.map((x, i) => row(x, i === r.later.length - 1)))));
}
