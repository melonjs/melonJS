import { Color } from "../math/color.ts";
import { Vector3d } from "../math/vector3d.ts";

/**
 * Options accepted by the {@link Light3d} constructor.
 * @category Lighting
 */
export interface Light3dOptions {
	/** light type — only `"directional"` is shaded today; `"point"` is reserved. */
	type?: "directional" | "point";
	/** world-space direction the light travels along (directional lights). */
	direction?: [number, number, number];
	/** world-space position (point lights — reserved for a future release). */
	position?: [number, number, number];
	/**
	 * light color — a {@link Color}, a CSS color string, or an `[r, g, b]`
	 * array with components in `0..1` (the glTF convention). Defaults to white.
	 */
	color?: Color | string | [number, number, number];
	/** scalar multiplier on the light's contribution. Defaults to `1`. */
	intensity?: number;
}

/**
 * A manipulable 3D light source for the mesh lighting path — the 3D
 * counterpart of {@link Light2d}, but a plain data object (a light draws
 * nothing itself): add it to a {@link LightingEnvironment}, which feeds the
 * mesh shader.
 *
 * Only **directional** lights (a "sun": a world-space `direction`, no falloff)
 * are shaded in this release. The `type` / `position` fields are carried for a
 * future point/spot release. Fields are public and mutable, so a light can be
 * animated at runtime (e.g. a day/night cycle rotating `direction`).
 * @category Lighting
 * @example
 * import { Light3d, LightingEnvironment } from "melonjs";
 * const sun = new Light3d({ direction: [0.3, 1, 0.2], color: "#fff", intensity: 1 });
 * LightingEnvironment.default.addLight(sun);
 * // later, animate it:
 * sun.direction.set(Math.sin(t), 1, Math.cos(t)).normalize();
 */
export class Light3d {
	/** `"directional"` (shaded) or `"point"` (reserved). */
	type: "directional" | "point";
	/** world-space travel direction (directional lights); kept normalized. */
	direction: Vector3d;
	/** world-space position (point lights — reserved). */
	position: Vector3d;
	/** the light color. */
	color: Color;
	/** scalar multiplier on the light's contribution. */
	intensity: number;

	/**
	 * @param [options] - see {@link Light3dOptions}
	 */
	constructor(options: Light3dOptions = {}) {
		this.type = options.type ?? "directional";

		this.direction = new Vector3d(0, 1, 0);
		if (options.direction) {
			this.direction.set(
				options.direction[0],
				options.direction[1],
				options.direction[2],
			);
		}
		this.direction.normalize();

		this.position = new Vector3d(0, 0, 0);
		if (options.position) {
			this.position.set(
				options.position[0],
				options.position[1],
				options.position[2],
			);
		}

		if (options.color instanceof Color) {
			this.color = options.color;
		} else if (Array.isArray(options.color)) {
			// glTF convention: [r, g, b] in 0..1
			this.color = new Color(
				options.color[0] * 255,
				options.color[1] * 255,
				options.color[2] * 255,
				1,
			);
		} else if (typeof options.color === "string") {
			this.color = new Color().parseCSS(options.color);
		} else {
			this.color = new Color(255, 255, 255, 1);
		}

		this.intensity = options.intensity ?? 1;
	}
}
