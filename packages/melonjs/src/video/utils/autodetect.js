import { isWebGLSupported } from "../../system/device";
import CanvasRenderer from "../canvas/canvas_renderer";
import WebGLRenderer from "../webgl/webgl_renderer";

// Ordered SYNCHRONOUS backend candidates, walked front-to-back: the first
// one whose support probe passes and whose construction succeeds wins.
//
// WebGPU is not in this list even though `AUTO` now prefers it — its
// support can only be proven by negotiating an adapter/device, which is
// asynchronous. `Application.init()`'s AUTO case awaits that attempt first
// and only falls through to these candidates when it rejects, keeping this
// module the synchronous tail of the ladder.
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
