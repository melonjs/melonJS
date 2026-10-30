/**
 * `warnOnce` (lang/console.js) prints a warning once per page: the same
 * message again is not printed, another message is. The messages already
 * printed are remembered for the page, so each test here uses messages no
 * other test prints (vitest runs each spec file in a page of its own).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetWarnOnce, warnOnce } from "../src/lang/console.js";

describe("warnOnce", () => {
	let warn;

	beforeEach(() => {
		warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		warn.mockRestore();
	});

	const printed = () => {
		return warn.mock.calls.map((call) => {
			return call[0];
		});
	};

	it("prints a message the first time only", () => {
		warnOnce("melonJS: first");
		warnOnce("melonJS: first");
		warnOnce("melonJS: first");
		expect(printed()).toEqual(["melonJS: first"]);
	});

	it("prints each different message once", () => {
		warnOnce("melonJS: one");
		warnOnce("melonJS: two");
		warnOnce("melonJS: one");
		warnOnce("melonJS: two");
		expect(printed()).toEqual(["melonJS: one", "melonJS: two"]);
	});

	it("prints a message again once reset, for a test standing in for a new page", () => {
		warnOnce("melonJS: again");
		resetWarnOnce();
		warnOnce("melonJS: again");
		warnOnce("melonJS: again");
		expect(printed()).toEqual(["melonJS: again", "melonJS: again"]);
	});

	it("remembers a message for the page, not for the call site", () => {
		const fromHere = () => {
			warnOnce("melonJS: shared");
		};
		const fromThere = () => {
			warnOnce("melonJS: shared");
		};
		fromHere();
		fromThere();
		expect(printed()).toEqual(["melonJS: shared"]);
	});
});
