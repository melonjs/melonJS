import { colorPool } from "../math/color.ts";
import { lerpArray } from "../math/math.ts";
import { computeVertexNormal } from "../math/vertex.ts";
import { Gradient } from "../video/gradient.js";
import Renderable from "./renderable.js";

/**
 * @import {Color} from "../math/color.ts";
 * @import {Vector2d} from "../math/vector2d.ts";
 */

/**
 * A Trail renderable that draws a fading, tapering ribbon behind a moving object.
 * Points are sampled from a target or added manually, and rendered as connected
 * quads with interpolated width and color.
 * @category Game Objects
 * @example
 * // simple single-color trail following a sprite
 * const trail = new Trail({ target: player, color: "#44aaff", width: 20 });
 * app.world.addChild(trail);
 * @example
 * // gradient trail following a sprite (fire effect)
 * const trail = new Trail({
 *     target: player,
 *     width: 30,
 *     gradient: ["#ffff00", "#ff4400", "#ff000000"],
 * });
 * app.world.addChild(trail);
 * @example
 * // rainbow trail with custom width curve
 * const trail = new Trail({
 *     target: player,
 *     width: 40,
 *     widthCurve: [1, 1, 0.8, 0.4, 0],
 *     gradient: ["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#0088ff", "#8800ff00"],
 * });
 * app.world.addChild(trail);
 * @example
 * // manual mode (e.g. sword slash)
 * const slash = new Trail({ width: 24, lifetime: 200, color: "#ffffff" });
 * app.world.addChild(slash);
 * // call each frame during the attack animation
 * slash.addPoint(swordTip.x, swordTip.y);
 * @see {@link Renderable}
 */
export default class Trail extends Renderable {
	/**
	 * @param {object} [options] - trail options
	 * @param {Renderable|Vector2d} [options.target] - auto-follow target
	 * @param {number} [options.length=20] - max number of points
	 * @param {number} [options.lifetime=500] - point lifetime in ms
	 * @param {number} [options.minDistance=4] - min distance between samples in px
	 * @param {number} [options.width=10] - max trail width in px
	 * @param {number[]} [options.widthCurve=[1, 0]] - width multiplier curve (0=head, 1=tail)
	 * @param {Color|string} [options.color="#ffffff"] - single trail color. Ignored if `gradient` is set.
	 * @param {(Color|string|{pos: number, color: Color|string})[]} [options.gradient] - color gradient. Overrides `color`.
	 * @param {number} [options.opacity=1.0] - trail opacity (0.0–1.0)
	 * @param {string} [options.blendMode="normal"] - blend mode
	 */
	constructor(options = {}) {
		super(0, 0, 1, 1);

		/** @type {Renderable|Vector2d|null} */
		this.target = options.target ?? null;
		/** @type {number} */
		this.maxPoints = options.length ?? 20;
		/** @type {number} */
		this.lifetime = options.lifetime ?? 500;
		/** @type {number} */
		this.minDistance = options.minDistance ?? 4;
		/** @type {number} */
		this.width = options.width ?? 10;
		/** @type {number[]} */
		this.widthCurve = options.widthCurve ?? [1, 0];

		/** @ignore */
		this._gradient = this._buildGradient(options);
		/** @ignore */
		this._points = [];
		/** @ignore */
		this._segmentColor = colorPool.get();
		/** @ignore */
		this._n0 = { x: 0, y: 0 };
		/** @ignore */
		this._n1 = { x: 0, y: 0 };

		this.alwaysUpdate = true;
		this.anchorPoint.set(0, 0);

		if (typeof options.opacity === "number") {
			this.setOpacity(options.opacity);
		}
		if (options.blendMode) {
			this.blendMode = options.blendMode;
		}
	}

	/**
	 * add a point to the trail
	 * @param {number} x - x position
	 * @param {number} y - y position
	 */
	addPoint(x, y) {
		if (this._points.length > 0) {
			const last = this._points[this._points.length - 1];
			const dx = x - last.x;
			const dy = y - last.y;
			if (dx * dx + dy * dy < this.minDistance * this.minDistance) {
				return;
			}
		}
		this._points.push({ x, y, age: 0 });
		if (this._points.length > this.maxPoints) {
			this._points.shift();
		}
	}

	/** @ignore */
	update(dt) {
		if (this.target) {
			const pos = this.target.pos ?? this.target;
			this.addPoint(pos.x, pos.y);
		}

		const pts = this._points;
		let expired = 0;
		for (let i = 0; i < pts.length; i++) {
			pts[i].age += dt;
			// oldest points are at the front, count the contiguous expired block
			if (i === expired && pts[i].age >= this.lifetime) {
				expired++;
			}
		}
		if (expired > 0) {
			pts.splice(0, expired);
		}

		this.inViewport = this._points.length > 1;
		this.isDirty = this._points.length > 1;
		return super.update(dt);
	}

	/** @ignore */
	draw(renderer) {
		const points = this._points;
		const count = points.length;
		if (count < 2) {
			return;
		}

		// capture base alpha set by preDraw (includes trail + parent opacity)
		const baseAlpha = renderer.getGlobalAlpha();

		const invCount = 1 / (count - 1);
		const halfWidth = this.width * 0.5;
		const invLifetime = 1 / this.lifetime;

		for (let i = 0; i < count - 1; i++) {
			const p0 = points[i];
			const p1 = points[i + 1];

			// position ratio: 0 = head (newest), 1 = tail (oldest)
			const t = 1 - i * invCount;
			const t1 = 1 - (i + 1) * invCount;

			// width at both ends of this segment
			const hw0 = lerpArray(this.widthCurve, t) * halfWidth;
			const hw1 = lerpArray(this.widthCurve, t1) * halfWidth;

			// color by position, alpha by age
			this._gradient.getColorAt(t, this._segmentColor);
			this._segmentColor.alpha *= 1.0 - p0.age * invLifetime;
			if (this._segmentColor.alpha <= 0) {
				continue;
			}
			// reset renderer alpha so setColor doesn't compound across segments
			renderer.setGlobalAlpha(baseAlpha);
			renderer.setColor(this._segmentColor);

			// perpendicular normals at both endpoints
			const n0 = computeVertexNormal(points, i, this._n0);
			const n1 = computeVertexNormal(points, i + 1, this._n1);

			// draw quad
			renderer.beginPath();
			renderer.moveTo(p0.x - n0.x * hw0, p0.y - n0.y * hw0);
			renderer.lineTo(p0.x + n0.x * hw0, p0.y + n0.y * hw0);
			renderer.lineTo(p1.x + n1.x * hw1, p1.y + n1.y * hw1);
			renderer.lineTo(p1.x - n1.x * hw1, p1.y - n1.y * hw1);
			renderer.closePath();
			renderer.fill();
		}
	}

	/** clear all trail points */
	clear() {
		this._points.length = 0;
	}

	/**
	 * Build a Gradient from trail constructor options.
	 * @param {object} options - trail constructor options
	 * @returns {Gradient}
	 * @ignore
	 */
	_buildGradient(options) {
		const gradient = new Gradient("linear", [0, 0, 1, 0]);

		if (options.gradient) {
			const entries = options.gradient;
			for (let i = 0; i < entries.length; i++) {
				const entry = entries[i];
				if (typeof entry === "string" || (entry && entry.toRGBA)) {
					// plain color: evenly distribute
					const offset = entries.length > 1 ? i / (entries.length - 1) : 0;
					gradient.addColorStop(offset, entry);
				} else {
					// positioned stop: { pos, color }
					gradient.addColorStop(entry.pos, entry.color);
				}
			}
		} else if (options.color) {
			const c =
				typeof options.color === "string"
					? options.color
					: options.color.toRGBA();
			const base = c.length >= 9 ? c.slice(0, 7) : c;
			gradient.addColorStop(0, `${base}ff`);
			gradient.addColorStop(1, `${base}00`);
		} else {
			gradient.addColorStop(0, "#ffffffff");
			gradient.addColorStop(1, "#ffffff00");
		}

		return gradient;
	}

	/** @ignore */
	destroy() {
		this._gradient.destroy();
		colorPool.release(this._segmentColor);
		this._points.length = 0;
		this.target = null;
		super.destroy();
	}
}
