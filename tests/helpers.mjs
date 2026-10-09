import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const scripts = path.join(root, "skills", "excalidraw-study", "scripts");
export const example = path.join(root, "examples", "pg-date-range-ko");

export function tmpdir(prefix = "es-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function copyStudy(src) {
  const dir = tmpdir();
  for (const entry of ["study.config.mjs", "slides", "evidence", "brief.md", "plan.md", "README.md"]) {
    const from = path.join(src, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dir, entry), { recursive: true });
  }
  return dir;
}

export function writeStudy(files) {
  const dir = tmpdir();
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

export const baseConfig = (extra = "") => `export default {
  name: "fixture",
  title: "fixture",
  series: "fixture series",
  lang: "ko",
  parts: { a: { label: "사건 1", topic: "테스트" } },
  ${extra}
};
`;
