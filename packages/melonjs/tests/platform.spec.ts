import { describe, expect, it } from "vitest";
import {
	android,
	android2,
	BlackBerry,
	chromeOS,
	ejecta,
	iOS,
	isMobile,
	isWeixin,
	Kindle,
	linux,
	nodeJS,
	ua,
	webApp,
	wp,
} from "../src/system/platform.ts";

/**
 * Smoke coverage for the platform-detection constants. They're computed
 * once at module load from `globalThis.navigator.userAgent` /
 * `globalThis.process` / etc., so there's no behavior to test
 * exhaustively — we lock in the shape (everything is a boolean except
 * `ua` which is a string) and assert the values we expect in our
 * Playwright + chromium test environment (desktop browser, no Node
 * `process`, no WebView shells).
 *
 * The Node-detection branch in particular went through a refactor that
 * collapsed three repeated `as unknown as { process? }` casts into a
 * single locally-typed `_proc` const. This spec pins the result so
 * regressions in that branch show up as a clear test failure rather
 * than a silent `true`/`false` flip.
 */
describe("system/platform", () => {
	describe("shape", () => {
		it("`ua` is a string", () => {
			expect(typeof ua).toBe("string");
		});
		it.each<[string, boolean]>([
			["iOS", iOS],
			["android", android],
			["android2", android2],
			["linux", linux],
			["chromeOS", chromeOS],
			["wp", wp],
			["BlackBerry", BlackBerry],
			["Kindle", Kindle],
			["ejecta", ejecta],
			["isWeixin", isWeixin],
			["nodeJS", nodeJS],
			["isMobile", isMobile],
			["webApp", webApp],
		])("`%s` is a boolean", (_, value) => {
			expect(typeof value).toBe("boolean");
		});
	});

	describe("values under Playwright chromium (desktop, headless)", () => {
		// Playwright launches a real chromium with a desktop user agent —
		// these are the values the rest of the test suite relies on
		// implicitly (e.g. `keyboard.ts` skips the on-screen-keyboard
		// branch because `isMobile === false` in this env).
		it("nodeJS is false (we're in a browser, not Node)", () => {
			expect(nodeJS).toBe(false);
		});
		it("isWeixin is false (no MicroMessenger UA)", () => {
			expect(isWeixin).toBe(false);
		});
		it("ejecta is false (no Ejecta WebView)", () => {
			expect(ejecta).toBe(false);
		});
		it("BlackBerry is false", () => {
			expect(BlackBerry).toBe(false);
		});
		it("Kindle is false", () => {
			expect(Kindle).toBe(false);
		});
	});

	describe("mobile-vs-desktop wiring", () => {
		// `isMobile` is the OR of the mobile-UA hits — verify it's not
		// silently true on our desktop runner (a regression in the OR
		// chain would page every test that branches on this).
		it("isMobile === iOS || android || wp || BlackBerry || Kindle || /Mobi/.test(ua)", () => {
			const expected =
				/Mobi/i.test(ua) || iOS || android || wp || BlackBerry || Kindle;
			expect(isMobile).toBe(expected);
		});
	});
});
