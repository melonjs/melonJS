import { afterAll, describe, expect, it } from "vitest";
import { videoList } from "../src/loader/cache.js";
import { preloadVideo } from "../src/loader/parsers/video.js";

/**
 * Video preloading wiring, written failing-first against two bugs:
 *
 * - crossorigin: the parser unconditionally called
 *   setAttribute("crossorigin", settings.crossOrigin) — with the loader
 *   default (undefined) that stamps the string "undefined", and per the HTML
 *   spec an INVALID enumerated value maps to Anonymous (missing maps to
 *   no-CORS). Every video was therefore fetched with forced anonymous CORS,
 *   breaking cross-origin sources served without CORS headers.
 *
 * - completion event: the parser's own comment notes Safari/mobile never
 *   fires "canplay" when autoplay is disabled, but the guard routed only an
 *   EXPLICIT `autoplay: false` to loadedmetadata. The common manifest shape
 *   (autoplay omitted) still waited on canplay → preload hung forever on
 *   those browsers and the game never started.
 */
describe("video parser wiring", () => {
	afterAll(() => {
		for (const name of Object.keys(videoList)) {
			if (name.startsWith("vp-")) {
				videoList[name].removeAttribute("src");
				delete videoList[name];
			}
		}
	});

	it("does not set a crossorigin attribute when crossOrigin is not configured", () => {
		preloadVideo(
			{ name: "vp-default", type: "video", src: "media/clip.webm" },
			undefined,
			undefined,
			{},
		);
		// the string "undefined" would map to Anonymous (forced CORS)
		expect(videoList["vp-default"].getAttribute("crossorigin")).toBe(null);
	});

	it("honors an explicitly configured crossOrigin, including the empty string", () => {
		preloadVideo(
			{ name: "vp-cors", type: "video", src: "media/clip.webm" },
			undefined,
			undefined,
			{ crossOrigin: "anonymous" },
		);
		expect(videoList["vp-cors"].getAttribute("crossorigin")).toBe("anonymous");

		// "" is a VALID value (maps to anonymous) and must not be dropped
		preloadVideo(
			{ name: "vp-cors-empty", type: "video", src: "media/clip.webm" },
			undefined,
			undefined,
			{ crossOrigin: "" },
		);
		expect(videoList["vp-cors-empty"].getAttribute("crossorigin")).toBe("");
	});

	it("completes on loadedmetadata when autoplay is omitted (Safari never fires canplay without autoplay)", () => {
		preloadVideo(
			{ name: "vp-noauto", type: "video", src: "media/clip.webm" },
			() => {},
			undefined,
			{},
		);
		const el = videoList["vp-noauto"];
		expect(typeof el.onloadedmetadata).toBe("function");
		expect(el.oncanplay).toBe(null);
	});

	it("still waits for canplay when autoplay is explicitly requested", () => {
		preloadVideo(
			{
				name: "vp-auto",
				type: "video",
				src: "media/clip.webm",
				autoplay: true,
			},
			() => {},
			undefined,
			{},
		);
		const el = videoList["vp-auto"];
		expect(typeof el.oncanplay).toBe("function");
		expect(el.onloadedmetadata).toBe(null);
	});
});
