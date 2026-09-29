/**
 * The boot header's resolution line.
 *
 * It has always said "requested X, got Y", which is the right shape for
 * anything a backend is allowed to refuse. `hdr` is exactly that: a request a
 * driver can turn down, whose refusal otherwise lives only in a flag nobody
 * reads until the picture looks wrong.
 *
 * The annotation is unconditional, because the line is STATUS rather than a
 * warning: it prints every boot with nothing wrong. Leaving it off when
 * nobody asked would make its absence the information, which only reads if
 * you already know the convention.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { consoleHeader } from "../src/application/header.ts";

/** the resolution line from a captured console.log batch */
const resolutionLine = (logs) => {
	return logs.find((line) => {
		return line.startsWith("resolution:");
	});
};

/**
 * Drive the real `consoleHeader` against a renderer stub. Only the fields it
 * reads are provided, so a field it starts reading later fails loudly here
 * rather than printing `undefined` at every boot.
 */
const header = (settings, renderer) => {
	const logs = [];
	const log = vi.spyOn(console, "log").mockImplementation((...args) => {
		logs.push(String(args[0]));
	});
	try {
		consoleHeader({
			settings: { width: 1024, height: 576, ...settings },
			renderer: {
				type: "WebGL",
				width: 1024,
				height: 576,
				supportsHDR: false,
				supportsHDROutput: false,
				...renderer,
			},
		});
	} finally {
		log.mockRestore();
	}
	return logs;
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe("consoleHeader — the resolution line", () => {
	it("says SDR on both sides when nobody asked", () => {
		// the default for every game that existed before the setting did, and
		// still worth stating: "what am I running" should be answerable from
		// the log without knowing that a missing annotation means no
		const line = resolutionLine(header({}, {}));
		expect(line).toBe(
			"resolution: requested 1024x576 (SDR), got 1024x576 (SDR)",
		);
	});

	it("reports HDR granted on both sides", () => {
		const line = resolutionLine(header({ hdr: true }, { supportsHDR: true }));
		expect(line).toBe(
			"resolution: requested 1024x576 (HDR), got 1024x576 (HDR)",
		);
	});

	it("reports a refusal, which is the whole point", () => {
		// asked for, not granted: this is the case that used to be invisible,
		// and the one that makes a game graded for headroom look wrong
		const line = resolutionLine(header({ hdr: true }, { supportsHDR: false }));
		expect(line).toBe(
			"resolution: requested 1024x576 (HDR), got 1024x576 (SDR)",
		);
	});

	it("still reports the resolution itself when they differ", () => {
		// the line's original job, which the annotation must not disturb
		const line = resolutionLine(
			header({ width: 1920, height: 1080 }, { width: 1024, height: 576 }),
		);
		expect(line).toBe(
			"resolution: requested 1920x1080 (SDR), got 1024x576 (SDR)",
		);
	});
});

describe("consoleHeader — hdrOutput", () => {
	it("says so when the frame is actually presented in HDR", () => {
		const line = resolutionLine(
			header({ hdr: true }, { supportsHDR: true, supportsHDROutput: true }),
		);
		expect(line).toBe(
			"resolution: requested 1024x576 (HDR), got 1024x576 (HDR, HDR output)",
		);
	});

	it("distinguishes headroom from presentation", () => {
		// the common case on WebGL2: the chain carries values above 1 and the
		// blit to the canvas still clamps them. Without this the log would
		// read the same as a machine genuinely presenting HDR.
		const line = resolutionLine(
			header({ hdr: true }, { supportsHDR: true, supportsHDROutput: false }),
		);
		expect(line).toBe(
			"resolution: requested 1024x576 (HDR), got 1024x576 (HDR)",
		);
	});
});
