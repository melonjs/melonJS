import { ManagedWebGLRenderingContext } from "@esotericsoftware/spine-webgl";

const contexts = new WeakMap();

/**
 * Return the shared spine ManagedWebGLRenderingContext for the given canvas,
 * creating it on first use.
 *
 * One shared instance per canvas matters for WebGL context-loss recovery:
 * Spine's GLTexture/Shader/Mesh register themselves as restorables on their
 * managed context, but a managed context only listens for
 * `webglcontextrestored` when constructed from a canvas (a raw
 * WebGLRenderingContext gives it no element to listen on). Funneling every
 * spine GL resource through this single canvas-backed instance guarantees
 * they are all restored after a context loss.
 * @param {HTMLCanvasElement} canvas - the canvas the melonJS WebGL renderer draws to
 * @returns {ManagedWebGLRenderingContext} the shared managed context
 * @ignore
 */
export function getManagedContext(canvas) {
	let context = contexts.get(canvas);
	if (typeof context === "undefined") {
		context = new ManagedWebGLRenderingContext(canvas);
		contexts.set(canvas, context);
	}
	return context;
}
