import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { launchFailure } from "../skills/excalidraw-study/scripts/lib/runtime.mjs";
import { changedSlides, coversScene, widthsMoved } from "../skills/excalidraw-study/scripts/render.mjs";
import { tmpdir } from "./helpers.mjs";

test("a browser that exists but cannot start is reported as blocked, not missing", () => {
  const missing = { opts: { channel: "chrome" }, message: "Chromium distribution 'chrome' is not found at /Applications/Google Chrome.app" };
  const blocked = { opts: { channel: "msedge" }, message: "browserType.launch: Target page, context or browser has been closed\nBrowser logs:\n\n<launching> /Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge --headless --no-sandbox about:blank\n<launched> pid=1\n[pid=1][err] bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer.1: Permission denied (1100)" };
  assert.equal(launchFailure([missing]).code, "NO_BROWSER");
  const err = launchFailure([missing, blocked]);
  assert.equal(err.code, "BROWSER_BLOCKED");
  assert.match(err.message, /sandbox/);
  assert.match(err.message, /will not help/);
  const hung = { opts: { channel: "chrome" }, message: "browserType.launch: Timeout 30000ms exceeded." };
  assert.equal(launchFailure([hung]).code, "BROWSER_BLOCKED");
});

test("a browser that dies for another reason is not taken for missing or sandboxed", () => {
  const died = { opts: { channel: "chrome" }, message: "browserType.launch: Target page, context or browser has been closed\nBrowser logs:\n\n<launching> /opt/google/chrome/chrome --headless --no-sandbox about:blank\n<launched> pid=1\n[pid=1][err] /opt/google/chrome/chrome: error while loading shared libraries: libnss3.so: cannot open shared object file: No such file or directory\nCall log:\n  - <launching> /opt/google/chrome/chrome --headless --no-sandbox about:blank\n  - <launched> pid=1" };
  const err = launchFailure([died]);
  assert.equal(err.code, "BROWSER_FAILED");
  assert.match(err.message, /--with-deps/);
});

test("a calibrated fit triggers a rebuild unless the config fixes every width", () => {
  const dir = tmpdir();
  const paths = { metrics: path.join(dir, "metrics.json") };
  fs.writeFileSync(paths.metrics, JSON.stringify({ metrics: { wide: 1.0, narrow: 0.5, monoWide: 1.2, monoNarrow: 0.6 } }));
  const used = { wide: 0.95, narrow: 0.55, monoWide: 1.2, monoNarrow: 0.6 };
  assert.equal(widthsMoved({ metrics: { wide: 0.95 } }, paths, used), true);
  assert.equal(widthsMoved({ metrics: { wide: 0.95, narrow: 0.55 } }, paths, used), false);
  assert.equal(widthsMoved({ metrics: { calibrate: false } }, paths, { wide: 1.0, narrow: 0.55, monoWide: 1.2, monoNarrow: 0.6 }), false);
  assert.equal(widthsMoved({}, paths, { wide: 1.0, narrow: 0.5, monoWide: 1.2, monoNarrow: 0.6 }), false);
  assert.equal(widthsMoved({ metrics: { wide: null } }, paths, { wide: 1.0, narrow: 0.5, monoWide: 1.2, monoNarrow: 0.6 }), false);
});

test("a partial measurement does not count as covering the scene", () => {
  const scene = { elements: [{ id: "a", type: "text", text: "가" }, { id: "b", type: "text", text: "나" }, { id: "c", type: "text", text: " " }, { id: "r", type: "rectangle" }] };
  assert.equal(coversScene(scene, { a: [10] }), false);
  assert.equal(coversScene(scene, { a: [10], b: [10] }), true);
});

test("changed slides are the ones whose PNG hash moved", () => {
  const previous = new Map([["cover", "a"], ["s1", "b"], ["s2", "c"]]);
  const slides = [{ number: 1, id: "cover", sha256: "a" }, { number: 2, id: "s1", sha256: "x" }, { number: 3, id: "s2", sha256: "c" }, { number: 4, id: "new", sha256: "d" }];
  assert.deepEqual(changedSlides(previous, slides), [2, 4]);
});
