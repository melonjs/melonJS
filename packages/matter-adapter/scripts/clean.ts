import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve `build/` relative to this script's location, not the caller's
// CWD — otherwise running `pnpm clean` from the wrong directory (a wrapper
// task, an IDE task runner, etc.) could blow away another package's build
// output. `rm({ force: true })` would swallow the failure silently.
const here = dirname(fileURLToPath(import.meta.url));
const buildDir = resolve(here, "..", "build");

await rm(buildDir, { recursive: true, force: true });
