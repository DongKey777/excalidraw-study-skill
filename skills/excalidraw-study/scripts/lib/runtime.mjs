// Render runtime: the official Excalidraw exporter bundled for a browser,
// plus playwright-core to drive an installed Chrome/Edge/Chromium.
// Installed once into a cache folder; nothing is written next to the skill.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

export const RUNTIME = {
  version: 1,
  excalidraw: "0.18.1",
  react: "19.3.0",
  esbuild: "0.28.2",
  playwright: "1.63.0",
  resvg: "2.6.2",
};

export function cacheRoot() {
  if (process.env.EXCALIDRAW_STUDY_CACHE) return path.resolve(process.env.EXCALIDRAW_STUDY_CACHE);
  const base = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  return path.join(base, "excalidraw-study");
}

export function runtimeDir() {
  return path.join(cacheRoot(), `runtime-v${RUNTIME.version}-excalidraw-${RUNTIME.excalidraw}`);
}

function npmInstall(cwd, log) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  log(`npm install in ${cwd}`);
  // A private npm cache keeps the install working when ~/.npm is unwritable (root-owned files, sandboxes).
  const cache = path.join(cacheRoot(), "npm-cache");
  const r = spawnSync(npm, ["install", "--no-audit", "--no-fund", "--loglevel=error"], { cwd, stdio: ["ignore", "inherit", "inherit"], shell: process.platform === "win32", env: { ...process.env, npm_config_cache: cache } });
  if (r.status !== 0) throw new Error(`npm install failed in ${cwd}`);
}

export function runtimeReady() {
  const dir = runtimeDir();
  const marker = path.join(dir, "READY.json");
  if (!fs.existsSync(marker)) return false;
  try {
    const ready = JSON.parse(fs.readFileSync(marker, "utf8"));
    return ready.version === RUNTIME.version && fs.existsSync(path.join(dir, "excalidraw-export.js"));
  } catch {
    return false;
  }
}

export async function ensureRuntime({ log = (m) => console.error(m) } = {}) {
  const dir = runtimeDir();
  if (runtimeReady()) return dir;
  log(`setting up the render runtime in ${dir} (one time, needs network)`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), `${JSON.stringify({
    name: "excalidraw-study-runtime",
    private: true,
    dependencies: { "playwright-core": RUNTIME.playwright, "@resvg/resvg-js": RUNTIME.resvg },
  }, null, 2)}\n`);
  npmInstall(dir, log);

  const buildDir = path.join(dir, ".bundle-build");
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(path.join(buildDir, "package.json"), `${JSON.stringify({
    name: "excalidraw-study-bundle",
    private: true,
    dependencies: {
      "@excalidraw/excalidraw": RUNTIME.excalidraw,
      react: RUNTIME.react,
      "react-dom": RUNTIME.react,
      esbuild: RUNTIME.esbuild,
    },
  }, null, 2)}\n`);
  npmInstall(buildDir, log);
  fs.writeFileSync(path.join(buildDir, "entry.mjs"), [
    'import { exportToSvg } from "@excalidraw/excalidraw";',
    "window.exportToSvg = exportToSvg;",
    "",
  ].join("\n"));
  const esbuild = await import(pathToFileURL(createRequire(path.join(buildDir, "package.json")).resolve("esbuild")).href);
  await esbuild.build({
    entryPoints: [path.join(buildDir, "entry.mjs")],
    bundle: true,
    format: "iife",
    minify: true,
    outfile: path.join(dir, "excalidraw-export.js"),
    define: { "process.env.NODE_ENV": '"production"' },
    loader: { ".woff2": "empty", ".ttf": "empty", ".css": "empty" },
    logLevel: "error",
  });
  fs.cpSync(path.join(buildDir, "node_modules", "@excalidraw", "excalidraw", "dist", "prod", "fonts"), path.join(dir, "fonts"), { recursive: true });
  const pkgDir = path.join(buildDir, "node_modules", "@excalidraw", "excalidraw");
  const license = fs.readdirSync(pkgDir).find((f) => /^licen[cs]e/i.test(f));
  fs.writeFileSync(path.join(dir, "NOTICE.txt"), `excalidraw-export.js bundles @excalidraw/excalidraw ${RUNTIME.excalidraw} (MIT, https://github.com/excalidraw/excalidraw) with React ${RUNTIME.react} (MIT).\n${license ? fs.readFileSync(path.join(pkgDir, license), "utf8") : ""}`);
  if (!process.env.EXCALIDRAW_STUDY_KEEP_BUILD) {
    fs.rmSync(buildDir, { recursive: true, force: true });
    fs.rmSync(path.join(cacheRoot(), "npm-cache"), { recursive: true, force: true });
  }
  fs.writeFileSync(path.join(dir, "READY.json"), `${JSON.stringify({ ...RUNTIME, builtAt: new Date().toISOString() }, null, 2)}\n`);
  log("render runtime ready");
  return dir;
}

export function runtimeRequire(name) {
  return createRequire(path.join(runtimeDir(), "package.json"))(name);
}

// Chrome, then Edge, then Playwright's own Chromium. EXCALIDRAW_STUDY_BROWSER
// can point at any Chromium-based executable.
export async function launchBrowser() {
  const { chromium } = runtimeRequire("playwright-core");
  const tries = [];
  if (process.env.EXCALIDRAW_STUDY_BROWSER) tries.push({ executablePath: process.env.EXCALIDRAW_STUDY_BROWSER });
  tries.push({ channel: "chrome" }, { channel: "msedge" }, { channel: "chromium" }, {});
  const errors = [];
  for (const opts of tries) {
    try {
      const browser = await chromium.launch({ headless: true, timeout: 30000, ...opts });
      return { browser, how: opts.executablePath ?? opts.channel ?? "playwright chromium" };
    } catch (e) {
      errors.push({ opts, message: e.message });
      // Denied permissions or a hang will happen to every browser here; other failures may not.
      if (blockedBrowser(e.message)) break;
    }
  }
  throw launchFailure(errors);
}

// Playwright puts its own reason on the first line and the browser's stderr after it.
const missingBrowser = (m) => /is not found|doesn't exist|does not exist|not installed|ENOENT|no such file/i.test(m.split("\n")[0]);
// Playwright logs its own command line (with --no-sandbox) in every launch error; leave it out.
const reasons = (m) => m.split("\n").filter((l) => !l.includes("<launching>")).join("\n");
const blockedBrowser = (m) => !missingBrowser(m) && /permission denied|mach_port|bootstrap_check_in|sandbox|EPERM|Timeout \d+ms exceeded/i.test(reasons(m));

// errors: [{ opts, message }] from each launch attempt.
export function launchFailure(errors) {
  const lines = errors.map((x) => `${JSON.stringify(x.opts)}: ${x.message.split("\n")[0]}`).join("\n  ");
  // A browser denied permissions or hanging on start points to a sandbox (Codex's
  // workspace-write on macOS blocks Chrome's mach ports). Another browser
  // download fails the same way, so say so instead of suggesting one.
  if (errors.some((x) => blockedBrowser(x.message))) {
    const err = new Error(`a browser was found but could not start; it was denied permissions or hung, which points to a sandbox.\n  ${lines}\nInstalling another browser will not help. Run the render outside the agent's sandbox (ask the user to approve running check.mjs or render.mjs unsandboxed), or point EXCALIDRAW_STUDY_BROWSER at a browser that can start here.`);
    err.code = "BROWSER_BLOCKED";
    return err;
  }
  if (errors.some((x) => !missingBrowser(x.message))) {
    const err = new Error(`no browser could start.\n  ${lines}\nPoint EXCALIDRAW_STUDY_BROWSER at a Chromium-based browser that starts here, or install Playwright's Chromium with its system libraries: npx playwright-core@${RUNTIME.playwright} install --with-deps chromium`);
    err.code = "BROWSER_FAILED";
    return err;
  }
  const err = new Error(`no Chromium-based browser found.\n  ${lines}\nInstall Chrome, or run: npx playwright-core@${RUNTIME.playwright} install chromium`);
  err.code = "NO_BROWSER";
  return err;
}
