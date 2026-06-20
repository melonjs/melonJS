import { Ellipse, ellipsePool } from "../geometries/ellipse.ts";
import { Color, colorPool } from "../math/color.ts";
import Renderable from "../renderable/renderable.js";
import state from "../state/state.ts";
import type CanvasRenderer from "../video/canvas/canvas_renderer.js";
import type WebGLRenderer from "../video/webgl/webgl_renderer.js";

/**
 * A 2D point light.
 *
 * Light2d carries the *properties* of a light (color, radii, intensity,
 * height, flags, position) and asks the active renderer to render it
 * via `renderer.drawLight(this)`. The renderer picks the right machinery:
 *
 * - **WebGL**: a single quad through a shared procedural radial-falloff
 *   fragment shader (`RadialGradientEffect`). One shader is reused across
 *   every Light2d on the renderer; no per-light texture is allocated.
 * - **Canvas**: a small `Gradient` config object (cached per-light in a
 *   `WeakMap` and rebuilt only when radii / color / intensity change),
 *   rasterized via `Gradient.toCanvas()` on every draw into a single
 *   shared `CanvasRenderTarget`, then composited with `drawImage`. The
 *   per-light cache holds only the gradient stops, not the bitmap — the
 *   render target is one-per-engine.
 *
 * Light2d itself is renderer-agnostic — no shader knowledge, no canvas
 * allocation, no renderer reference held.
 * @category Lighting
 * @see stage.lights
 */
export default class Light2d extends Renderable {
	/**
	 * the color of the light
	 * @default "#FFF"
	 */
	color: Color;

	/** The horizontal radius of the light */
	radiusX: number;

	/** The vertical radius of the light */
	radiusY: number;

	/**
	 * The intensity of the light
	 * @default 0.7
	 */
	intensity: number;

	/**
	 * the world-space geometry of the light's visible area, rewritten each
	 * frame by {@link Light2d#getVisibleArea} from transform-aware bounds.
	 * @ignore
	 */
	visibleArea: Ellipse;

	/**
	 * When `true`, this light acts as a pure illumination source — the
	 * gradient texture isn't drawn. The light still feeds the `Stage`
	 * ambient-cutout pass and the WebGL lit-sprite pipeline's per-frame
	 * uniforms, so normal-mapped sprites still get shaded by it. Use this for
	 * SpriteIlluminator-style demos where the light should be invisible (only
	 * its effect on normal-mapped surfaces is what you want to see).
	 *
	 * Default `false`, preserving the legacy "soft glowing spot" behavior.
	 * @default false
	 */
	illuminationOnly: boolean;

	/**
	 * Light height above the sprite plane (Z axis), in the same units as
	 * `radiusX`/`radiusY`. Used by the WebGL lit-sprite pipeline as the Z
	 * component of the light direction in the `dot(normal, lightDir)`
	 * calculation: a low height makes the lighting graze across the surface
	 * (long visible shadows on normal-map detail), a high height makes it
	 * head-on (more uniform brightness on the lit hemisphere).
	 *
	 * Default is `max(radiusX, radiusY) * 0.075` — a balanced look at the
	 * asset's native scale that prevents lights at the sprite's center from
	 * producing degenerate flat shading.
	 *
	 * Named `lightHeight` (not just `height`) to avoid colliding with the
	 * bbox-height getter Light2d inherits from `Rect`.
	 */
	lightHeight: number;

	/**
	 * Create a 2D point light.
	 *
	 * A `Light2d` is a first-class world Renderable: add it to a container
	 * with `app.world.addChild(light)` (or any sub-container, including a
	 * `Sprite`, so the light follows the parent via its transform). On
	 * activation, the light auto-registers with the active `Stage`'s
	 * lighting set so the ambient overlay (`Stage.ambientLight`) cuts a
	 * hole at the light's visible area, and a radial gradient from the
	 * given `color` (full intensity at center → fully transparent at the
	 * radius) is composited additively on top — producing a soft spot
	 * light. Rendering happens inside each `Camera2d`'s post-effect FBO
	 * bracket so any camera shader (vignette, color-matrix, scanlines,
	 * etc.) wraps the lighting output.
	 *
	 * Set `radiusY` to a different value than `radiusX` for a stretched
	 * (elliptical) light. The `intensity` parameter scales the gradient's
	 * inner alpha; the `Stage.ambientLight` color and alpha control how
	 * dark the unlit areas are. Use `light.blendMode` to override the
	 * default additive blend if needed.
	 * @param x - The horizontal position of the light's center (matches `Ellipse(x, y, w, h)` conventions).
	 * @param y - The vertical position of the light's center.
	 * @param radiusX - The horizontal radius of the light.
	 * @param [radiusY=radiusX] - The vertical radius of the light.
	 * @param [color="#FFF"] - The color of the light at full intensity.
	 * @param [intensity=0.7] - The peak alpha of the radial gradient at the light's center (0–1).
	 */
	constructor(
		x: number,
		y: number,
		radiusX: number,
		radiusY: number = radiusX,
		color: Color | string = "#FFF",
		intensity: number = 0.7,
	) {
		// pos is the light's CENTER (matches `Ellipse(x, y, w, h)` and
		// `Sprite` conventions); the centered anchor below makes Renderable's
		// transform stack scale/rotate around that center too.
		super(x, y, radiusX * 2, radiusY * 2);

		this.color = colorPool.get();
		if (color instanceof Color) {
			this.color.copy(color);
		} else {
			this.color.parseCSS(color);
		}

		this.radiusX = radiusX;
		this.radiusY = radiusY;
		this.intensity = intensity;

		/**
		 * the default blend mode to be applied when rendering this light
		 * @see CanvasRenderer#setBlendMode
		 * @see WebGLRenderer#setBlendMode
		 */
		this.blendMode = "lighter";

		// initial shape — `getVisibleArea()` rewrites this each frame from
		// transform-aware bounds.
		this.visibleArea = ellipsePool.get(
			this.pos.x,
			this.pos.y,
			this.width,
			this.height,
		);

		// centered anchor — transforms (scale, rotate) pivot around `pos`.
		this.anchorPoint.set(0.5, 0.5);

		this.illuminationOnly = false;
		this.lightHeight = Math.max(radiusX, radiusY) * 0.075;
	}

	/**
	 * the horizontal coordinate of this light's center.
	 * Overrides Rect's getter, which assumes `pos` is the bbox top-left and
	 * returns `pos.x + width/2`. Light2d uses `anchorPoint = (0.5, 0.5)`, so
	 * `pos` already IS the center.
	 */
	override get centerX(): number {
		return this.pos.x;
	}
	override set centerX(value: number) {
		this.pos.x = value;
		this.recalc();
		this.updateBounds();
	}

	/**
	 * the vertical coordinate of this light's center.
	 * @see Light2d#centerX
	 */
	override get centerY(): number {
		return this.pos.y;
	}
	override set centerY(value: number) {
		this.pos.y = value;
		this.recalc();
		this.updateBounds();
	}

	/**
	 * Set new radii for this light.
	 *
	 * Updates `radiusX`/`radiusY` and the underlying bbox (via
	 * `Renderable.resize(width, height)`) so `getBounds()` and
	 * `getVisibleArea()` — which feed the ambient-cutout pass — track the
	 * new size. The Canvas renderer's gradient cache auto-invalidates on
	 * next draw via its property comparison; the WebGL procedural shader
	 * adapts to the new dimensions automatically.
	 *
	 * Named `setRadii` (not `resize`) so it does not shadow
	 * `Renderable.resize(width, height)` — code that operates on a
	 * generic `Renderable` and calls `.resize(w, h)` keeps working when
	 * the instance happens to be a `Light2d`.
	 * @param radiusX - new horizontal radius
	 * @param [radiusY=radiusX] - new vertical radius
	 */
	setRadii(radiusX: number, radiusY: number = radiusX) {
		this.radiusX = radiusX;
		this.radiusY = radiusY;
		this.resize(radiusX * 2, radiusY * 2);
	}

	/**
	 * returns a geometry representing the visible area of this light, in
	 * world-space coordinates (so it aligns with the rendered gradient
	 * regardless of camera scroll or container parenting).
	 * @returns the light visible mask
	 */
	getVisibleArea(): Ellipse {
		const b = this.getBounds();
		// `b.width/b.height` are the transform-aware (and anchor-aware) bbox
		// dimensions, so the cutout tracks scale changes.
		return this.visibleArea.setShape(b.centerX, b.centerY, b.width, b.height);
	}

	/**
	 * update function
	 * @returns true if dirty
	 */
	override update(): boolean {
		return true;
	}

	/**
	 * preDraw this Light2d (automatically called by melonJS)
	 * @param renderer - a renderer instance
	 */
	override preDraw(renderer: CanvasRenderer | WebGLRenderer) {
		super.preDraw(renderer);
		renderer.setBlendMode(this.blendMode);
	}

	/**
	 * draw this Light2d (automatically called by melonJS).
	 *
	 * Delegates to `renderer.drawLight(this)` — each renderer picks its
	 * own implementation (procedural shader on WebGL; cached `Gradient`
	 * rasterized into a shared `CanvasRenderTarget` on Canvas). Light2d
	 * itself doesn't know which path is used.
	 * @param renderer - a renderer instance
	 */
	override draw(renderer: CanvasRenderer | WebGLRenderer) {
		if (this.illuminationOnly) {
			return;
		}
		renderer.drawLight(this);
	}

	/**
	 * Auto-register this light with the active Stage's lighting set when
	 * added to a container. The Stage uses that set to build the ambient
	 * overlay cutouts; rendering the light itself is handled normally as
	 * part of the world tree walk.
	 * @ignore
	 */
	override onActivateEvent() {
		state.current()?._registerLight(this);
	}

	/**
	 * Auto-deregister this light from the active Stage's lighting set when
	 * removed from a container.
	 * @ignore
	 */
	override onDeactivateEvent() {
		state.current()?._unregisterLight(this);
	}

	/**
	 * Destroy function
	 * @ignore
	 */
	override destroy() {
		colorPool.release(this.color);
		ellipsePool.release(this.visibleArea);
		// The Canvas renderer's per-light gradient cache entry (if any) becomes
		// GC-eligible via its WeakMap once this Light2d is no longer referenced.
		super.destroy();
	}
}
