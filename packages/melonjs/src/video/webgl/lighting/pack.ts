import { MAX_LIGHTS } from "./constants.ts";

/**
 * Per-frame scratch buffer for `packLights()`. Pre-allocates one entry
 * per light slot so the per-camera-per-frame upload doesn't allocate.
 */
export interface LightUniformScratch {
	positions: Float32Array;
	colors: Float32Array;
	heights: Float32Array;
	ambient: number[];
}

/**
 * Result of `packLights()` — typed-array views into the scratch plus the
 * actual count. `WebGLRenderer.setLightUniforms` forwards this to
 * `LitQuadBatcher.setLightUniforms` for upload.
 */
export interface LightUniforms extends LightUniformScratch {
	count: number;
}

/**
 * Allocate a fresh scratch buffer sized for `MAX_LIGHTS` slots. One per
 * renderer is enough; reuse across frames.
 */
export function createLightUniformScratch(): LightUniformScratch {
	return {
		positions: new Float32Array(MAX_LIGHTS * 4),
		colors: new Float32Array(MAX_LIGHTS * 3),
		heights: new Float32Array(MAX_LIGHTS),
		ambient: [0, 0, 0],
	};
}

/**
 * Light2d-shaped duck-type — anything `packLights()` reads from. Avoids
 * importing `Light2d` directly (keeps this module renderer-agnostic).
 */
interface LightLike {
	getBounds(): {
		centerX: number;
		centerY: number;
		width: number;
		height: number;
	};
	intensity: number;
	color: { r: number; g: number; b: number };
	lightHeight: number;
}

/** Color-shaped duck-type for the ambient floor. */
interface ColorLike {
	r: number;
	g: number;
	b: number;
}

/**
 * Pack the active scene lights into the scratch buffer in a shape the
 * lit fragment shader uploads directly.
 *
 * Light positions are translated from world-space (where
 * `light.getBounds().centerX/Y` lives) into the renderer's
 * pre-projection coords by subtracting `(translateX, translateY)` —
 * the same translate `Camera2d.draw()` applies to the world container.
 * This matches what `Stage.drawLighting` does for the cutout pass, so
 * the lit fragment's `lightPos - vWorldPos` math lines up with the
 * camera's view.
 *
 * Lights past `MAX_LIGHTS` (8) are silently dropped. Unused slots are
 * zero-filled so stale data from a previous frame can't leak into the
 * shader.
 *
 * Pure function: deterministic given the same inputs, no I/O, scratch
 * is the only mutable target.
 * @param lights - active lights iterable (e.g. `Stage._activeLights`); falsy treated as empty
 * @param ambient - ambient floor color (0..255 RGB); falsy treated as black
 * @param translateX - world-to-screen X translate (matches `Camera2d.draw()`)
 * @param translateY - world-to-screen Y translate
 * @param scratch - pre-allocated scratch (see `createLightUniformScratch`)
 * @returns the scratch with `count` filled in
 */
export function packLights(
	lights: Iterable<LightLike> | null | undefined,
	ambient: ColorLike | null | undefined,
	translateX: number,
	translateY: number,
	scratch: LightUniformScratch,
): LightUniforms {
	scratch.positions.fill(0);
	scratch.colors.fill(0);
	scratch.heights.fill(0);

	let i = 0;
	if (lights) {
		for (const light of lights) {
			if (i >= MAX_LIGHTS) {
				break;
			}
			const b = light.getBounds();
			// derive the radius from the transform-aware bbox so a scaled
			// light's brightness range tracks its visible range
			const radius = Math.max(b.width, b.height) / 2;
			scratch.positions[i * 4 + 0] = b.centerX - translateX;
			scratch.positions[i * 4 + 1] = b.centerY - translateY;
			scratch.positions[i * 4 + 2] = radius;
			scratch.positions[i * 4 + 3] = light.intensity;
			scratch.colors[i * 3 + 0] = light.color.r / 255;
			scratch.colors[i * 3 + 1] = light.color.g / 255;
			scratch.colors[i * 3 + 2] = light.color.b / 255;
			scratch.heights[i] = light.lightHeight;
			i++;
		}
	}

	if (ambient) {
		scratch.ambient[0] = ambient.r / 255;
		scratch.ambient[1] = ambient.g / 255;
		scratch.ambient[2] = ambient.b / 255;
	} else {
		scratch.ambient[0] = 0;
		scratch.ambient[1] = 0;
		scratch.ambient[2] = 0;
	}

	return {
		positions: scratch.positions,
		colors: scratch.colors,
		heights: scratch.heights,
		ambient: scratch.ambient,
		count: i,
	};
}
