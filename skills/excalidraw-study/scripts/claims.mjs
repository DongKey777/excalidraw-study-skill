#!/usr/bin/env node
// Evidence ledger helper for evidence/claims.md.
// Usage:
//   node claims.mjs [studyDir]                 counts by status, claims cited on slides but missing
//   node claims.mjs [studyDir] --apply rows.md  replace rows with the same id, insert new ones after their
//                                               siblings (same prefix, lower number); rows are markdown table rows
// Use --apply when several people or agents return ledger rows: it never rewrites rows it was not given,
// and it refuses rows whose column count differs from the ledger's header.
import fs from "node:fs";
import path from "node:path";
import { loadConfig, resolveStudyDir } from "./lib/project.mjs";
import { isMain } from "./lib/main.mjs";

const ROW = /^\|\s*([^|]+?)\s*\|/;
const OK_STATUS = /^(verified|measured|documented|derived|확인|실측|문서|계산)/i;

// Cells split on | but not on \| (a pipe inside a cell).
function split(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim());
}

function parse(text) {
  const lines = text.split("\n");
  const headerAt = lines.findIndex((l) => l.trim().startsWith("|"));
  if (headerAt < 0) throw new Error("evidence/claims.md has no table");
  const header = split(lines[headerAt]);
  const rows = new Map();
  lines.forEach((l, i) => {
    if (i <= headerAt + 1 || !l.trim().startsWith("|")) return;
    const m = l.match(ROW);
    if (m) rows.set(m[1], i);
  });
  return { lines, header, headerAt, rows };
}

function idParts(id) {
  const m = id.match(/^(.*?)(\d+)$/);
  return m ? { prefix: m[1], n: Number(m[2]) } : { prefix: id, n: 0 };
}

export function applyRows(dir, newRows) {
  const file = path.join(dir, "evidence", "claims.md");
  const ledger = parse(fs.readFileSync(file, "utf8"));
  const statusCol = ledger.header.findIndex((h) => /^(status|상태)$/i.test(h));
  let updated = 0;
  let added = 0;
  for (const raw of newRows) {
    const row = raw.trim();
    const m = row.match(ROW);
    if (!m) throw new Error(`not a table row: ${row.slice(0, 60)}`);
    const cells = split(row);
    if (cells.length !== ledger.header.length) throw new Error(`${m[1]}: ${cells.length} columns, the ledger has ${ledger.header.length}`);
    if (statusCol >= 0 && !OK_STATUS.test(cells[statusCol]) && cells[statusCol] !== "") {
      console.warn(`warning: ${m[1]} has status "${cells[statusCol]}"; slides cannot cite it until it is verified`);
    }
    const at = ledger.rows.get(m[1]);
    if (at !== undefined) {
      ledger.lines[at] = row;
      updated += 1;
      continue;
    }
    const { prefix, n } = idParts(m[1]);
    let insertAt = -1;
    for (const [id, i] of ledger.rows) {
      const p = idParts(id);
      if (p.prefix === prefix && p.n < n && i > insertAt) insertAt = i;
    }
    if (insertAt < 0) insertAt = Math.max(ledger.headerAt + 1, ...ledger.rows.values());
    ledger.lines.splice(insertAt + 1, 0, row);
    for (const [id, i] of ledger.rows) if (i > insertAt) ledger.rows.set(id, i + 1);
    ledger.rows.set(m[1], insertAt + 1);
    added += 1;
  }
  fs.writeFileSync(file, ledger.lines.join("\n"));
  return { updated, added };
}

export async function ledgerStatus(dir) {
  const ledger = parse(fs.readFileSync(path.join(dir, "evidence", "claims.md"), "utf8"));
  const statusCol = ledger.header.findIndex((h) => /^(status|상태)$/i.test(h));
  const counts = {};
  for (const i of ledger.rows.values()) {
    const status = statusCol >= 0 ? (split(ledger.lines[i])[statusCol] ?? "").split(/\s|·/)[0] || "(none)" : "(no column)";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  const manifestFile = path.join(dir, "build", "manifest.json");
  const missing = [];
  if (fs.existsSync(manifestFile)) {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    for (const s of manifest.slides) for (const id of s.claims ?? []) if (!ledger.rows.has(id)) missing.push(`${s.number}:${id}`);
  }
  return { total: ledger.rows.size, counts, missing };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const applyAt = args.indexOf("--apply");
  const dirArg = args.find((a, i) => !a.startsWith("--") && (applyAt < 0 || i !== applyAt + 1));
  (async () => {
    const dir = resolveStudyDir(dirArg);
    await loadConfig(dir);
    if (applyAt >= 0) {
      const src = args[applyAt + 1];
      if (!src || !fs.existsSync(src)) throw new Error("--apply needs a file of table rows");
      const rows = fs.readFileSync(src, "utf8").split("\n").filter((l) => ROW.test(l.trim()) && !/^\|\s*-/.test(l.trim()));
      const { updated, added } = applyRows(dir, rows);
      console.log(`updated ${updated}, added ${added}`);
    }
    const st = await ledgerStatus(dir);
    console.log(`${st.total} claims: ${Object.entries(st.counts).map(([k, v]) => `${k} ${v}`).join(", ")}`);
    if (st.missing.length) console.log(`cited on slides but missing: ${st.missing.join(", ")}`);
  })().catch((e) => {
    console.error(`claims failed: ${e.message}`);
    process.exit(1);
  });
}
