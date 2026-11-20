import { afterAll, inject } from "vitest";

/**
 * In watch mode, collects garbage once at the end of every spec file.
 *
 * Chromium keeps a 2 MiB shared-memory buffer and a file handle for every
 * module a spec file re-validated with the server, until its garbage
 * collector next runs, and nothing makes it run: see `keepModulesForTheRun`
 * in `vitest.config.ts`, which is also where a one-shot run avoids the
 * buffers altogether and so has no use for this. With a collection per file,
 * a page holds one spec file's buffers at most.
 *
 * `gc` exists because the config starts the browser with `--expose-gc`.
 */
if (inject("collectGarbage") === true) {
	afterAll(() => {
		globalThis.gc?.();
	});
}
