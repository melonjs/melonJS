import { afterEach, describe, expect, it, vi } from "vitest";
import { pool } from "../src/index.js";

/**
 * The legacy pool's deprecation notice.
 *
 * Its own spec file on purpose: the notice fires ONCE per method for the life
 * of the module, and `legacy_pool.spec.js` registers classes at module scope,
 * so by the time any test there runs the notice has already been spent.
 * Vitest isolates modules per file, which is what gives this one a clean slate.
 */
describe("legacy pool deprecation notice", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	/** capture what the notice prints */
	const capture = () => {
		const seen = [];
		vi.spyOn(console, "groupCollapsed").mockImplementation((...args) => {
			seen.push(args.join(" "));
		});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "groupEnd").mockImplementation(() => {});
		return seen;
	};

	class Poolable {
		onResetEvent() {}
	}

	it("names BOTH replacements, because register did two unrelated jobs", () => {
		// a caller only ever wanted one of them: recycling instances, or
		// letting a Tiled map name a class. The message has to serve either
		// reader, so it must not name only the pooling one.
		const seen = capture();
		pool.register("deprecation-probe", Poolable, true);

		// the format string and its arguments arrive separately, so assert on
		// the joined output rather than on a substituted sentence
		const text = seen.join(" ");
		expect(text).toMatch(/deprecated since version/);
		expect(text).toMatch(/pool\.register\(\)/);
		expect(text).toMatch(/18\.0\.0/);
		// both replacements, which is the point: one reader wants pooling,
		// the other wants a Tiled class name
		expect(text).toMatch(/createPool\(\)/);
		expect(text).toMatch(/registerTiledObjectClass\(\)/);
	});

	it("push warns too, and on its own", () => {
		// each of the three methods has its own one-shot, so a game that only
		// ever pushes still hears about it
		const seen = capture();
		const instance = new Poolable();
		instance.className = "deprecation-probe";
		pool.push(instance);
		expect(seen.length).toEqual(1);
		expect(seen[0]).toMatch(/pool\.push\(\)/);
	});

	it("warns ONCE per method, however many times it is called", () => {
		// `pull` runs in the hot path of any game that pools its bullets, and
		// the notice prints a stack trace. Per call would cost more than the
		// thing it is warning about.
		const seen = capture();
		pool.pull("deprecation-probe");
		pool.pull("deprecation-probe");
		pool.pull("deprecation-probe");
		expect(seen.length).toEqual(1);
		expect(seen[0]).toMatch(/pool\.pull\(\)/);
	});
});
