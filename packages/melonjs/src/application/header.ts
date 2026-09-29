import * as device from "../system/device";
import type Application from "./application.ts";

/**
 * display information
 * @param app - the game application instance calling this function
 */
export function consoleHeader(app: Application): void {
	const renderType = app.renderer.type;
	const gpu_renderer =
		typeof app.renderer.GPURenderer === "string"
			? ` (${app.renderer.GPURenderer})`
			: "";
	const audioType = device.hasWebAudio ? "Web Audio" : "HTML5 Audio";

	// output video information in the console
	console.log(
		`${renderType} renderer${gpu_renderer} | ${audioType} | ` +
			`pixel ratio ${device.devicePixelRatio} | ${
				device.platform.nodeJS
					? "node.js"
					: device.platform.isMobile
						? "mobile"
						: "desktop"
			} | ${device.getScreenOrientation()} | ${device.language}`,
	);

	// `hdr` is a request that a backend can refuse, and the refusal is only
	// visible in a flag nobody reads until something looks wrong. Put it on
	// the line that already says "requested X, got Y", because that line is
	// about exactly this: what was asked for, and what was granted.
	//
	// Always, not only when HDR was asked for. This line is status, not a
	// warning: it prints every boot with nothing wrong, the way the renderer
	// and pixel ratio above it do. Leaving it off when nobody asked would
	// make its ABSENCE the information, which only reads if you already know
	// the convention, while `(SDR)` says itself — and it means any game's log
	// answers "what am I actually running", including one where a template
	// turned the setting on without its author noticing.
	// Two separate things, and the second only annotated when it is in play:
	// `hdr` is headroom through the chain, `hdrOutput` is whether the frame
	// is PRESENTED in the display's full range. A game can have the first
	// without the second, and on WebGL2 it always does.
	const requestedHDR = app.settings.hdr ? " (HDR)" : " (SDR)";
	const grantedHDR =
		(app.renderer.supportsHDR ? " (HDR" : " (SDR") +
		(app.renderer.supportsHDROutput ? ", HDR output)" : ")");

	console.log(
		`resolution: ` +
			`requested ${(app.settings as any).width}x${
				(app.settings as any).height
			}${requestedHDR}, got ${app.renderer.width}x${app.renderer.height}${grantedHDR}`,
	);
}
