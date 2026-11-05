// What the board shows about an agent session: its ticket from the git branch and its MR from
// `glab mr view <branch> --output json`. Pure, so `node --test` covers it (board.test.mjs).

import { TICKET } from "./state.js";

export function ticketFromBranch(branch) {
  return branch?.match(TICKET)?.[0] ?? null;
}

// glab's JSON for one MR → { iid, url, state, pipeline }, or null (no MR, or an error message).
export function parseMr(json) {
  let m;
  try { m = JSON.parse(json); } catch { return null; }
  if (!Number.isInteger(m?.iid)) return null;
  return {
    iid: m.iid,
    url: /^https:\/\/\S+$/.test(m.web_url ?? "") ? m.web_url : null,
    state: m.state ?? "",
    pipeline: m.head_pipeline?.status ?? null,
  };
}

// The CI icon's input: a merged or closed MR says so; an open one shows its pipeline.
export function ciOf(mr) {
  if (!mr) return "";
  return mr.state === "merged" || mr.state === "closed" ? mr.state : mr.pipeline ?? "";
}
