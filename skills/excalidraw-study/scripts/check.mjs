#!/usr/bin/env node
// One pass of the mechanical loop: build → lint (estimated widths) →
// render with Excalidraw → lint (measured widths) → review status.
// Usage: node check.mjs [studyDir] [--slides 3,5-7] [--no-render] [--force] [--preview] [--no-calibrate]
// After a full render the text widths Excalidraw measured are fitted into
// build/metrics.json; when they change the wrapping, check builds and renders once more.
// Exit: 0 no errors, 2 lint errors, 1 could not run.
import { buildStudy } from "./build.mjs";
import { lintStudy } from "./lint.mjs";
import { formatReport } from "./lib/lint.mjs";
import { renderStudy } from "./render.mjs";
import { formatStatus, reviewStatus } from "./review.mjs";
import { isMain } from "./lib/main.mjs";

async function main() {
  const args = process.argv.slice(2);
  const val = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const dirArg = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--slides");
  const built = await buildStudy(dirArg);
  const first = await lintStudy(built.dir);
  console.log(`\n── lint (${first.result.widths.startsWith("measured") ? "measured widths" : "estimated widths"})`);
  console.log(formatReport(first.result, { manifest: first.manifest }));
  if (first.result.counts.error > 0 && !args.includes("--force")) {
    console.log("\nfix the errors above before rendering (or pass --force)");
    return 2;
  }
  if (args.includes("--no-render")) return first.result.counts.error > 0 ? 2 : 0;
  console.log("\n── render");
  let { report, lint, manifest, metricsChanged, previous } = await renderStudy(built.dir, { slides: val("--slides"), preview: args.includes("--preview") });
  if (metricsChanged && !val("--slides") && !args.includes("--no-calibrate")) {
    console.log("text widths calibrated from this render (build/metrics.json); building and rendering once more");
    await buildStudy(built.dir, { quiet: true });
    const again = await lintStudy(built.dir);
    if (again.result.counts.error > 0 && !args.includes("--force")) {
      console.log(formatReport(again.result, { manifest: again.manifest }));
      console.log("\nthe calibrated build has errors; fix them or pass --no-calibrate");
      return 2;
    }
    ({ report, lint, manifest } = await renderStudy(built.dir, { preview: args.includes("--preview"), previous }));
  } else if (metricsChanged) {
    console.log("text widths calibrated from this render; the next full check rebuilds with them");
  }
  console.log(`rendered ${report.slides.length} slide(s) with ${report.renderer}`);
  if (report.changed) console.log(report.changed.length ? `changed since the previous render: ${report.changed.join(", ")}` : "no slide changed since the previous render");
  for (const s of report.sheets) console.log(`  contact sheet ${s.file}`);
  console.log("\n── lint (after render)");
  console.log(formatReport(lint, { manifest }));
  console.log("\n── review");
  console.log(formatStatus(await reviewStatus(built.dir)));
  return lint.counts.error > 0 ? 2 : 0;
}

if (isMain(import.meta.url)) {
  main().then((code) => process.stdout.write("", () => process.exit(code))).catch((e) => {
    console.error(`check failed: ${e.message}`);
    process.exit(1);
  });
}
