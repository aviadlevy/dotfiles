// Small visual pieces of the Work board. `act` carries the board's actions:
// focus(address), open(url), toggle(key), isOpen(key).
import { div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";

export const MONO = "JetBrains Mono"; // Herdr bundles it as the terminal fallback font
const ICON = (name) => `mods/workspace-chrome/${name}.svg`;

// Space avatar colors exactly as the shipped spaces mod draws them (shared "space.colors" holds a name per space id).
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };
export function spaceColor(t, stored) {
  const c = stored ?? "ansi6";
  return c.startsWith("#") ? c : MARK[c] ?? t[c] ?? t.accent;
}

// Theme colors may already carry alpha (#rrggbbaa): replace it rather than append.
export const alpha = (c, aa) => (c?.length === 9 ? c.slice(0, 7) : c) + aa;

export function since(ms, now) {
  if (!ms) return "";
  const s = Math.max(0, (now - ms) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// Working spins; anything waiting on you pulses; finished is a solid dot; idle is a ring.
export function statusDot(t, s, size = 8) {
  if (s === "working") return svg(ICON("spinner")).size(size + 5).flex_none().text_color(t.working).spin(900);
  const d = div().size(size).mx(2).flex_none().rounded(size);
  if (s === "blocked") return d.bg(t.blocked).loop("opacity", { from: 0.3, to: 1, period: 1400 });
  if (s === "done") return d.bg(t.done);
  return d.border(1.5).border_color(t.idle ?? t.dim);
}

export function ciIcon(t, ci, size = 12) {
  if (/success|pass|green|merged/i.test(ci)) return svg(ICON("circle-check")).size(size).flex_none().text_color(t.done);
  if (/fail|red/i.test(ci)) return svg(ICON("x")).size(size).flex_none().text_color(t.blocked);
  if (/run|pend|created/i.test(ci)) return svg(ICON("spinner")).size(size).flex_none().text_color(t.working).spin(900);
  return div().size(6).mx(3).flex_none().rounded(3).bg(t.dim);
}

// Click targets stop the event, so a link inside a clickable card doesn't also fire the card.
export function clickable(el, fn) {
  return el.cursor_pointer().on_click((_e, cx) => { cx.stop_propagation(); fn(cx); });
}

export function mrPill(t, id, mr, act) {
  if (!mr?.label) return div();
  const el = h_flex().id(id).flex_none().gap(5).px(7).h(20).rounded(10).items_center().bg(alpha(t.foreground, "0f"))
    .border(1).border_color(alpha(t.foreground, "14")).text_size(11.5).font_family(MONO)
    .child(ciIcon(t, mr.ci ?? "")).child(div().text_color(mr.url ? t.foreground : t.muted).child(mr.label));
  return mr.url ? clickable(el.hover((s) => s.bg(alpha(t.accent, "26"))), () => act.open(mr.url)) : el;
}

export function ticketTag(t, id, ticket, act) {
  if (!ticket?.key) return div();
  const el = div().id(id).flex_none().text_size(11.5).font_family(MONO).text_color(ticket.url ? t.accent : t.muted).child(ticket.key);
  return ticket.url ? clickable(el.hover((s) => s.underline()), () => act.open(ticket.url)) : el;
}

export function programIcon(t, program, color, size = 14) {
  if (!program?.icon) return div().size(size).flex_none();
  // As the shipped agents mod draws it: one-color glyphs take the status color, logos stay as they are.
  return program.tint ? svg(program.icon).size(size).flex_none().text_color(color) : image(program.icon).w(size).h(size).flex_none();
}

// SMALL CAPS label + a count badge, the way Slate heads its sections.
export function sectionLabel(t, label, count, color) {
  return h_flex().gap(8).items_center()
    .child(div().text_size(10.5).font_family(MONO).font_semibold().text_color(color).child(label.toUpperCase()))
    .child(div().px(6).h(16).rounded(8).bg(alpha(color, "22")).text_size(10).font_family(MONO).text_color(color).flex().items_center().child(String(count)));
}
