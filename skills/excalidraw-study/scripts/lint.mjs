#!/usr/bin/env node
// Lint a built study. Uses measured text widths from render.mjs when they
// belong to the current build, otherwise the estimate from lib/text.mjs.
// Usage: node lint.mjs [studyDir] [--json] [--rules]
// Exit: 0 no errors (warnings allowed), 2 errors found, 1 could not run.
import fs from "node:fs";
import path from "node:path";
import { formatReport, loadLintContext, RULES, runLint } from "./lib/lint.mjs";
import { loadConfig, outPaths, resolveStudyDir } from "./lib/project.mjs";
import { isMain } from "./lib/main.mjs";

export async function lintStudy(dirArg, { write = true } = {}) {
  const dir = resolveStudyDir(dirArg);
  const { config } = await loadConfig(dir);
  const ctx = loadLintContext(dir, config);
  const result = runLint(ctx);
  if (write) fs.writeFileSync(outPaths(dir, config).lint, `${JSON.stringify(result, null, 2)}\n`);
  return { result, manifest: ctx.manifest };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes("--rules")) {
    for (const r of RULES) console.log(`${r.id.padEnd(20)} ${r.severity.padEnd(6)} ${r.scope.padEnd(8)} ${r.category.padEnd(10)} ${r.summary}`);
  } else {
    lintStudy(args.find((a) => !a.startsWith("--")))
    .then(({ result, manifest }) => {
      if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
      else console.log(formatReport(result, { manifest, verbose: args.includes("--verbose") }));
      process.exitCode = result.counts.error > 0 ? 2 : 0;
    })
    .catch((e) => {
      console.error(`lint failed: ${e.message}`);
      process.exit(1);
    });
  }
}
