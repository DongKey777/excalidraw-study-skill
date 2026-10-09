// True when the module is the script node was asked to run. Compares real
// paths, so a skill installed through a symlink (or run from /tmp on macOS,
// which is /private/tmp) still runs instead of exiting silently.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function isMain(metaUrl) {
  const arg = process.argv[1];
  if (!arg) return false;
  const real = (p) => {
    try {
      return fs.realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  };
  return real(arg) === real(fileURLToPath(metaUrl));
}
