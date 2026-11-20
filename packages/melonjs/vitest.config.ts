/// <reference types="vitest" />
/// <reference types="vite/client" />
import { ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { PackageJson } from "type-fest";
import { default as glsl } from "vite-plugin-glsl";
import { defineConfig, type Plugin } from "vitest/config";
import { stripShaderComments } from "./scripts/strip-shader-comments.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const packageJson = (
	await import("../../package.json", {
		with: { type: "json" },
	})
).default as PackageJson.PackageJsonStandard;

const version = packageJson.version;
if (!version) {
	throw new Error("Version missing from package.json");
}

declare module "vitest" {
	interface ProvidedContext {
		/** true in watch mode: see `keepModulesForTheRun` below */
		collectGarbage: boolean;
	}
}

// Set by the plugin below once Vitest says the run is a one-shot one. An
// environment variable, because Vitest evaluates this file once per server it
// starts, and the server that feeds the browser is not the one it configures.
const ONE_SHOT = "MELONJS_TESTS_ONE_SHOT";

// a day: longer than any run
const KEPT_FOR_THE_RUN = "max-age=86400";

/**
 * In a one-shot run, lets the browser keep a module for the rest of the run.
 *
 * Vite serves every source module as `no-cache`, and Vitest does the same for
 * its own. So the browser asks again for each of them in every spec file, some
 * 450 requests a file, and all the server answers is "not modified". Two things
 * follow.
 *
 * It is slow: asking was 40% of the suite's time.
 *
 * And Chromium keeps a 2 MiB shared-memory buffer, a file in the temporary
 * folder, and an open handle on it for every module script re-validated that
 * way, until its garbage collector next runs. A page that loads 400 modules in
 * an iframe twice shows it, with no engine and no Vitest involved. Vitest runs
 * every spec file in an iframe of one long-lived page, and nothing makes the
 * collector run, so the buffers pile up, by the thousand.
 *
 * That is what "Browser connection was closed while running tests" was, on
 * whichever spec file came next and with no test failing. CI ran the suite six
 * times each way (#1907): re-validating, five runs peaked between 9,700 and
 * 16,300 handles in one page and passed, and the sixth lost every websocket of
 * a page at once, with no process crashing, as that page reached 16,448 handles
 * and 32 GB of buffers. Kept, no page held more than 330 handles and none was
 * lost. Other ways it ends: a page limited to 8,192 handles stops loading
 * modules and the run hangs, and a full temporary folder fails the loads.
 *
 * Nothing changes on disk during a one-shot run, so there the answer can be
 * `max-age`, and the browser does not ask: a page then stays at a few hundred
 * handles.
 * A spec file that mocks a module still gets its mock, and the next one the
 * real module (checked both ways round).
 *
 * Watch mode cannot do that: a module edited between two runs has to be asked
 * for again. There the buffers are released instead, by a garbage collection
 * at the end of every spec file (`tests/helpers/collect-garbage.js`). It costs
 * a sixth more time, and is no use in a one-shot run: a collection also
 * empties the browser's own store of modules, which undoes the gain above.
 * @returns the plugin
 */
function keepModulesForTheRun(): Plugin {
	return {
		name: "melonjs:keep-modules-for-the-run",
		configureVitest({ vitest, project }) {
			// not `=== false`: without a terminal Vitest leaves it unset
			if (!vitest.config.watch) {
				process.env[ONE_SHOT] = "1";
			} else {
				// read by tests/helpers/collect-garbage.js
				project.provide("collectGarbage", true);
			}
		},
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				if (
					process.env[ONE_SHOT] !== undefined &&
					req.headers["sec-fetch-dest"] === "script"
				) {
					// the prototype's, because Vitest replaces the response's own
					// with one that ignores this header, for its own modules
					const setHeader = ServerResponse.prototype.setHeader.bind(res);
					// set by a middleware that ran before this one
					if (res.getHeader("Cache-Control") === "no-cache") {
						setHeader("Cache-Control", KEPT_FOR_THE_RUN);
					}
					// and by the ones that run after it
					res.setHeader = (name, value) => {
						const kept =
							name.toLowerCase() === "cache-control" && value === "no-cache";
						return setHeader(name, kept ? KEPT_FOR_THE_RUN : value);
					};
				}
				next();
			});
		},
	};
}

export default defineConfig(() =>
	defineConfig({
		// Anchor to this package. `pnpm test` invokes this config from the repo
		// root, where an unanchored `include` globs every workspace package —
		// so the adapters' and debug-plugin's specs were pulled into this run
		// *as well as* being run by their own `pnpm -F ... test` jobs, doubling
		// the work.
		//
		// This comment used to claim the specs also shared one browser session,
		// so contexts accumulated across files until the browser's cap stalled a
		// later `beforeAll`. That is NOT true here: vitest isolates each spec
		// file, verified by a probe — a global set in one file is undefined in
		// the next, and a context opened in one is dead by the next. Contexts do
		// accumulate WITHIN a file across its describe blocks, which is worth
		// releasing, but it is not a cross-file effect.
		root: __dirname,
		test: {
			include: ["tests/**/*.{test,spec}.[jt]s?(x)"],
			// servers on other origins, for the loader's cross-origin tests
			globalSetup: ["tests/helpers/cors-servers.js"],
			// in watch mode, a garbage collection at the end of every spec file
			setupFiles: ["tests/helpers/collect-garbage.js"],
			// Several specs create a WebGL context in `beforeAll`. On a CI
			// container with no GPU that runs through a software rasterizer and
			// can genuinely take tens of seconds under load, so the default hook
			// timeout fails correct suites. Raised for headroom — this is a slow
			// hook, not a hanging one. (`video.init` no longer exists; a context
			// comes from `new Application(...)` + `await app.init()`.)
			hookTimeout: 90000,
			// The same contention, one level down. The hook timeout above covers
			// CONTEXT CREATION; a test BODY that drives software GL is just as
			// CPU-bound, and the default 15s is not enough headroom when the cores
			// vitest schedules pages on are busy. Measured: with 15 of 16 cores
			// saturated, eight specs across the suite blow 15s — every one of them
			// a `Test timed out`, not an assertion, and every one passing with
			// seconds to spare on an idle machine. Raised for the same reason and
			// with the same trade: a genuinely hung test still fails, just later.
			testTimeout: 45000,
			// CI is a 4-core runner with no GPU, so every browser page rasterizes
			// through SwiftShader on the same cores vitest schedules files on. The
			// default is `min(12, availableParallelism - 1)`, i.e. 3 pages there, each
			// also driving software GL, and a `beforeAll` whose only job is to create
			// a context can sit past the timeout above.
			//
			// The cost is contention, not the specs. Measured in isolation, the two
			// that time out in CI are among the FASTEST in the suite
			// (texturecache-batcher-reset 0.9s, renderTargetPool 1.2s), while
			// webgl_pipeline_adversarial takes 7s and passes in the same run. File
			// ordering is deterministic, which is why it is reproducibly those two:
			// they are the ones that land in the congested window.
			//
			// Dropping 3 -> 2 on CI trades a little wall-clock for hooks that finish.
			// Local runs (more cores, a real GPU) keep the default.
			// spread rather than `maxWorkers: CI ? 2 : undefined` — the config type
			// is built with `exactOptionalPropertyTypes`, so an explicit `undefined`
			// is a type error where an absent key is fine
			...(process.env.CI ? { maxWorkers: 2 } : {}),
			browser: {
				enabled: true,
				// `--expose-gc` so `tests/pool.test.ts` can prove that a dropped
				// pooled instance is actually collectable. Without it the only
				// honest alternative is a test that silently skips, and a
				// retention bug is exactly the kind that comes back unnoticed.
				// Exposing `globalThis.gc` changes nothing unless a test calls
				// it; it does not alter collection behaviour on its own.
				provider: playwright({
					launchOptions: { args: ["--js-flags=--expose-gc"] },
				}),
				instances: [
					{
						browser: "chromium",
						headless: true,
						screenshotFailures: false,
					},
				],
			},
		},
		// Surface CI-ness to the browser side. Vitest's `env` does not reach the
		// page, so the WebGL tripwire (tests/webgl_available.spec.js) reads this
		// to decide whether a missing WebGL context is a hard failure (CI, where
		// the image is pinned and WebGL must be present) or a visible skip (a
		// contributor's machine that genuinely has no GL).
		define: {
			"import.meta.env.VITE_CI": JSON.stringify(process.env.CI ?? ""),
			// Benchmarks run only when asked for, with `BENCH=1`: they measure
			// rather than test, and the heavy ones tie up the browser's shared
			// GPU process long enough to time out the specs running beside
			// them (#1817).
			"import.meta.env.VITE_BENCH": JSON.stringify(process.env.BENCH ?? ""),
		},
		publicDir: resolve(__dirname, "tests/public"),
		plugins: [
			keepModulesForTheRun(),
			// the shaders as the build ships them, without their comments
			// (see `scripts/build.ts`): the tests compile the same text
			glsl({
				onComplete: (shader) => {
					return stripShaderComments(shader);
				},
			}),
			{
				name: "transform-file",
				transform(src) {
					return {
						code: src.replace(/=\s__VERSION__/g, `= "${version}"`),
						map: null,
					};
				},
			},
		],
	}),
);
