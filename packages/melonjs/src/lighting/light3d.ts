import { Color } from "../math/color.ts";
import { Vector3d } from "../math/vector3d.ts";
import Renderable from "../renderable/renderable.js";
import state from "../state/state.ts";

/**
 * Options accepted by the {@link Light3d} constructor.
 * @category Lighting
 */
export interface Light3dOptions {
	/**
	 * light type: `"directional"` (a sun), `"ambient"` (a flat fill added to
	 * every lit pixel), `"point"` (radiates from `position` with quadratic
	 * falloff over `range`) or `"spot"` (a point light confined to a cone
	 * along `direction`).
	 */
	type?: "directional" | "ambient" | "point" | "spot";
	/**
	 * world-space direction the light travels along (directional lights,
	 * and the cone axis of spot lights).
	 */
	direction?: [number, number, number];
	/** world-space position (point and spot lights). */
	position?: [number, number, number];
	/**
	 * light color — a {@link Color}, a CSS color string, or an `[r, g, b]`
	 * array with components in `0..1` (the glTF convention). Defaults to white.
	 */
	color?: Color | string | [number, number, number];
	/** scalar multiplier on the light's contribution. Defaults to `1`. */
	intensity?: number;
	/**
	 * falloff distance in world units (point and spot lights): the light
	 * fades quadratically from full strength at its position to zero at
	 * `range` — the same stylized model as {@link Light2d}'s radius, not a
	 * physical inverse-square. Defaults to `1000`.
	 */
	range?: number;
	/**
	 * spot cone: angle (radians) from the axis where the light is at full
	 * strength. Defaults to `0`.
	 */
	innerConeAngle?: number;
	/**
	 * spot cone: angle (radians) from the axis where the light reaches
	 * zero, fading smoothly from `innerConeAngle`. Defaults to `π/4`.
	 */
	outerConeAngle?: number;
}

/**
 * A 3D light source for the mesh lighting path — the 3D counterpart of
 * {@link Light2d}. Like `Light2d`, a `Light3d` is a world {@link Renderable}:
 * add it to a container with `app.world.addChild(light)` and it auto-registers
 * with the active {@link Stage}, so any lit mesh in that scene is shaded by it.
 * Remove it from the world to turn it off. A light draws nothing itself.
 *
 * Four types are shaded:
 * - **`"directional"`** — a sun: a world-space `direction`, no falloff. Shaded
 *   via half-Lambert diffuse.
 * - **`"ambient"`** — a flat fill added to every lit pixel (the dark side of a
 *   mesh never goes fully black). `direction` / `position` are ignored.
 * - **`"point"`** — radiates from `position`, fading quadratically to zero at
 *   `range` (the same stylized falloff as {@link Light2d}'s radius).
 * - **`"spot"`** — a point light confined to a cone along `direction`, at
 *   full strength inside `innerConeAngle` and fading smoothly to zero at
 *   `outerConeAngle`.
 *
 * Fields are public and mutable, so a light can be animated at runtime
 * (e.g. a day/night cycle rotating `direction`, a flickering torch fading
 * `intensity`, a searchlight sweeping its cone).
 * @category Lighting
 * @example
 * import { Light3d } from "melonjs";
 *
 * // a sun + a soft ambient fill, added to the world like any renderable
 * const sun = new Light3d({ direction: [0.3, 1, 0.2], color: "#fff" });
 * app.world.addChild(sun);
 * app.world.addChild(new Light3d({ type: "ambient", intensity: 0.3 }));
 *
 * // a street lamp pool and a searchlight cone
 * app.world.addChild(new Light3d({
 *     type: "point", position: [120, -40, 60], color: "#ffb45e", range: 300,
 * }));
 * app.world.addChild(new Light3d({
 *     type: "spot", position: [0, -200, 0], direction: [0, 1, 0],
 *     range: 800, innerConeAngle: 0.2, outerConeAngle: 0.45,
 * }));
 *
 * // animate the sun in-game (direction is the way light travels)
 * sun.direction.set(Math.sin(t), 1, Math.cos(t)).normalize();
 */
export class Light3d extends Renderable {
	/** `"directional"`, `"ambient"`, `"point"` or `"spot"`. */
	override type: "directional" | "ambient" | "point" | "spot";
	/**
	 * world-space travel direction (directional lights, spot cone axis);
	 * kept normalized.
	 */
	direction: Vector3d;
	/** world-space position (point and spot lights). */
	position: Vector3d;
	/** the light color. */
	color: Color;
	/** scalar multiplier on the light's contribution. */
	intensity: number;
	/**
	 * falloff distance in world units (point/spot) — full strength at the
	 * position, zero at `range`.
	 */
	range: number;
	/** spot cone inner angle (radians) — full strength inside it. */
	innerConeAngle: number;
	/** spot cone outer angle (radians) — zero beyond it. */
	outerConeAngle: number;

	/**
	 * @param [options] - see {@link Light3dOptions}
	 */
	constructor(options: Light3dOptions = {}) {
		// a light has no visual footprint — a sizeless renderable at the origin
		super(0, 0, 0, 0);

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
		this.range = options.range ?? 1000;
		this.innerConeAngle = options.innerConeAngle ?? 0;
		this.outerConeAngle = options.outerConeAngle ?? Math.PI / 4;

		// nothing to draw, and no transform to apply — keep it off the
		// renderer-state path entirely
		this.autoTransform = false;
	}

	/**
	 * Register with the active stage's 3D-light set on activation (when added to
	 * a rooted container), mirroring {@link Light2d}.
	 * @ignore
	 * @internal
	 */
	override onActivateEvent() {
		state.current()?._registerLight3d(this);
	}

	/**
	 * Deregister from the active stage when removed from the world.
	 * @ignore
	 * @internal
	 */
	override onDeactivateEvent() {
		state.current()?._unregisterLight3d(this);
	}

	/**
	 * A light has no visual representation.
	 * @ignore
	 * @internal
	 */
	override draw() {}
}
