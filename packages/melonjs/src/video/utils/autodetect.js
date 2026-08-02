import { isWebGLSupported } from "../../system/device";
import CanvasRenderer from "../canvas/canvas_renderer";
import WebGLRenderer from "../webgl/webgl_renderer";

// Ordered backend candidates, walked front-to-back: the first one whose
// support probe passes and whose construction succeeds wins. Kept as a
// list (rather than an if-chain) so a future backend prepends a single
// entry without reshaping the negotiation.
//
// WebGPU is deliberately NOT a candidate here, and should not be added
// until it reaches feature parity with the WebGL backend. `AUTO` is what
// existing games use, so listing WebGPU would migrate them onto a partial
// backend the day their browser gained support — silently, and without
// anyone asking. It stays opt-in through `renderer: video.WEBGPU` (or the
// `#webgpu` URI fragment), which is also what makes testing it meaningful:
// an explicit request either runs on WebGPU or fails, and never quietly
// falls back to something else.
const BACKEND_CANDIDATES = [
	{
		name: "webgl2",
		isSupported: (options) => {
			return isWebGLSupported(options);
		},
		create: (options) => {
			return new WebGLRenderer(options);
		},
	},
	{
		// Canvas is the terminal fallback and always supported
		name: "canvas",
		isSupported: () => {
			return true;
		},
		create: (options) => {
			return new CanvasRenderer(options);
		},
	},
];

/**
 * Auto-detect the best renderer to use
 * @ignore
 */
export function autoDetectRenderer(options) {
	let lastError;
	for (const backend of BACKEND_CANDIDATES) {
		try {
			if (backend.isSupported(options)) {
				return backend.create(options);
			}
		} catch (e) {
			lastError = e;
			console.log("Error creating " + backend.name + " renderer: " + e.message);
		}
	}
	// every candidate failed — surface the terminal one's cause rather than
	// swallowing it behind a generic message
	throw new Error("No usable renderer backend found", { cause: lastError });
}
