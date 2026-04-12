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

	console.log(
		`resolution: ` +
			`requested ${(app.settings as any).width}x${
				(app.settings as any).height
			}, got ${app.renderer.width}x${app.renderer.height}`,
	);
}
