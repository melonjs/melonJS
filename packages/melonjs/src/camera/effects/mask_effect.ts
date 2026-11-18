import { Ellipse, ellipsePool } from "../../geometries/ellipse.ts";
import { Polygon, polygonPool } from "../../geometries/polygon.ts";
import { warnOnce } from "../../lang/console.js";
import { getImage } from "../../loader/cache.js";
import type { Color } from "../../math/color.ts";
import { colorPool } from "../../math/color.ts";
import { Vector2d } from "../../math/vector2d.ts";
import { Vector3d } from "../../math/vector3d.ts";
import type Renderable from "../../renderable/renderable.js";
import type Sprite from "../../renderable/sprite.js";
import type Tween from "../../tweens/tween.ts";
import { tweenPool } from "../../tweens/tween.ts";
import type Renderer from "../../video/renderer.js";
import CanvasRenderTarget from "../../video/rendertarget/canvasrendertarget.js";
import type Camera2d from "../camera2d.ts";
import CameraEffect from "./camera_effect.ts";

/**
 * An image whose silhouette shapes a {@link MaskEffect}: a loaded image
 * (`loader.getImage()`), or a canvas drawn by the game.
 * @category Camera
 */
export type MaskImage =
	| HTMLImageElement
	| HTMLCanvasElement
	| OffscreenCanvas
	| ImageBitmap;

/**
 * What a {@link MaskEffect} is shaped like:
 * - an `Ellipse` (an iris) or a `Polygon`, unit-sized;
 * - an image, or the name of a preloaded one: its silhouette;
 * - a `Sprite`: the silhouette of the frame it shows when the effect starts.
 * @category Camera
 */
export type MaskShape = Ellipse | Polygon | MaskImage | Sprite | string;

/**
 * Where a {@link MaskEffect} closes and opens: a renderable, at the place
 * on screen it is drawn when the effect starts, or a point in the camera's
 * screen coordinates.
 * @category Camera
 */
export type MaskCenter = Renderable | { x: number; y: number };

/**
 * The settings of a {@link MaskEffect}, as its constructor takes them.
 * @category Camera
 */
export interface MaskEffectOptions {
	/**
	 * an `Ellipse` or `Polygon` (unit-sized), an image or the name of a
	 * preloaded one, or a `Sprite`; an iris when omitted
	 */
	shape?: MaskShape | undefined;
	/** CSS color value or Color instance for the transition fill */
	color: Color | string;
	/** transition duration in milliseconds (500 by default) */
	duration?: number | undefined;
	/** "hide" covers the scene (the default), "reveal" uncovers it */
	direction?: "hide" | "reveal" | undefined;
	/**
	 * where the shape closes and opens: a renderable (where it is drawn when
	 * the effect starts) or a point in the camera's screen coordinates. The
	 * centre of the screen by default
	 */
	center?: MaskCenter | undefined;
	/**
	 * make the shape the cover rather than the window: it grows out of
	 * `center` to hide the scene
	 */
	invert?: boolean | undefined;
	/** callback when the transition finishes */
	onComplete?: (() => void) | undefined;
}

/** the largest side a silhouette is kept at, in pixels */
const MAX_SILHOUETTE = 512;
/** clear pixels kept round a silhouette, so its outside is one region */
const PAD = 2;

/** a world point to project with a 3D camera; never escapes `resolveCenter` */
const _world3d = new Vector3d();
/** where a 2D camera draws a world point; never escapes `resolveCenter` */
const _local = new Vector2d();

/**
 * A shape, settled for drawing: the point it grows about, in its own
 * units, and the radius of the largest circle round that point inside it.
 * Once that circle reaches the screen's farthest corner, the screen is
 * wholly inside the shape.
 * @ignore
 */
interface Anchor {
	x: number;
	y: number;
	inner: number;
}

/**
 * A silhouette made from an image or a sprite: solid white where it is,
 * clear around it, with a small clear margin, and the point it grows about.
 * @ignore
 */
interface Silhouette extends Anchor {
	target: CanvasRenderTarget;
}

/**
 * The silhouettes made so far, by their canvas: one handed back as a shape
 * (the reveal of a transition, from its hide) is used as it is, not made
 * again from itself.
 * @ignore
 */
const baked = new WeakMap<object, Silhouette>();

/**
 * The point of a silhouette farthest from its edge (the middle of its
 * thickest part), and the exact distance from there to the edge.
 *
 * A shape grown about its own centre would not do: the centre of a U, a
 * crescent or a sprite drawn off-centre in its frame is outside it, and no
 * size of it would ever hold the screen. A two-pass distance transform
 * finds the thickest part; ties go to the one nearest the centre, so a
 * symmetric shape still grows about its middle.
 * @ignore
 */
function deepestPoint(
	inside: Uint8Array,
	cw: number,
	ch: number,
): Anchor | null {
	const count = cw * ch;
	const far = cw + ch;
	const dist = new Float32Array(count);
	for (let i = 0; i < count; i++) {
		dist[i] = inside[i] === 1 ? far : 0;
	}
	const D = Math.SQRT2;
	for (let y = 0; y < ch; y++) {
		for (let x = 0; x < cw; x++) {
			const i = y * cw + x;
			if (dist[i] === 0) continue;
			let d = dist[i];
			if (x > 0) d = Math.min(d, dist[i - 1] + 1);
			if (y > 0) {
				d = Math.min(d, dist[i - cw] + 1);
				if (x > 0) d = Math.min(d, dist[i - cw - 1] + D);
				if (x < cw - 1) d = Math.min(d, dist[i - cw + 1] + D);
			}
			dist[i] = d;
		}
	}
	let best = -1;
	let bestD = 0;
	let bestC = Infinity;
	for (let y = ch - 1; y >= 0; y--) {
		for (let x = cw - 1; x >= 0; x--) {
			const i = y * cw + x;
			if (dist[i] === 0) continue;
			let d = dist[i];
			if (x < cw - 1) d = Math.min(d, dist[i + 1] + 1);
			if (y < ch - 1) {
				d = Math.min(d, dist[i + cw] + 1);
				if (x < cw - 1) d = Math.min(d, dist[i + cw + 1] + D);
				if (x > 0) d = Math.min(d, dist[i + cw - 1] + D);
			}
			dist[i] = d;
			const c = (x + 0.5 - cw / 2) ** 2 + (y + 0.5 - ch / 2) ** 2;
			if (d > bestD + 1e-6 || (Math.abs(d - bestD) <= 1e-6 && c < bestC)) {
				best = i;
				bestD = d;
				bestC = c;
			}
		}
	}
	if (best < 0) {
		return null;
	}
	// the exact distance to the edge from there (the transform is close, not
	// exact): the nearest pixel outside, less half a pixel for its edge
	const ax = (best % cw) + 0.5;
	const ay = Math.floor(best / cw) + 0.5;
	let nearest = Infinity;
	for (let i = 0; i < count; i++) {
		if (inside[i] === 0) {
			const dx = (i % cw) + 0.5 - ax;
			const dy = Math.floor(i / cw) + 0.5 - ay;
			const d = dx * dx + dy * dy;
			if (d < nearest) {
				nearest = d;
			}
		}
	}
	return { x: ax, y: ay, inner: Math.max(0.5, Math.sqrt(nearest) - 0.5) };
}

/**
 * Draw `draw` into a canvas `w` × `h` (plus the margin) and make a solid
 * silhouette of it, or `null` when nothing was drawn.
 *
 * Solid twice over: a pixel more than faintly opaque counts in full, so a
 * sprite's glass or soft shading leaves no see-through patches, and any
 * clear area the outside cannot reach (an eye, the gap between a helmet and
 * a head) is filled, so only the outline matters.
 * @ignore
 */
function bakeSilhouette(
	w: number,
	h: number,
	draw: (context: CanvasRenderingContext2D) => void,
): Silhouette | null {
	const cw = w + PAD * 2;
	const ch = h + PAD * 2;
	const target = new CanvasRenderTarget(cw, ch, {
		context: "2d",
		willReadFrequently: true,
	});
	const context = target.context as CanvasRenderingContext2D;
	context.save();
	context.translate(PAD, PAD);
	draw(context);
	context.restore();

	const image = target.getImageData(0, 0, cw, ch);
	const data = image.data;
	const count = cw * ch;
	// opaque from a low threshold up: soft edges stay a little soft
	for (let i = 0; i < count; i++) {
		const a = data[i * 4 + 3];
		data[i * 4 + 3] = Math.min(255, Math.max(0, (a - 24) * 4));
	}
	// flood the outside from the margin; whatever it cannot reach is inside
	const inside = new Uint8Array(count).fill(1);
	const stack: number[] = [];
	const visit = (i: number) => {
		if (inside[i] === 1 && data[i * 4 + 3] < 128) {
			inside[i] = 0;
			stack.push(i);
		}
	};
	for (let x = 0; x < cw; x++) {
		visit(x);
		visit((ch - 1) * cw + x);
	}
	for (let y = 0; y < ch; y++) {
		visit(y * cw);
		visit(y * cw + cw - 1);
	}
	while (stack.length > 0) {
		const i = stack.pop()!;
		const x = i % cw;
		if (x > 0) visit(i - 1);
		if (x < cw - 1) visit(i + 1);
		if (i >= cw) visit(i - cw);
		if (i < count - cw) visit(i + cw);
	}
	const anchor = deepestPoint(inside, cw, ch);
	if (anchor === null) {
		target.destroy();
		return null;
	}
	for (let i = 0; i < count; i++) {
		const o = i * 4;
		data[o] = 255;
		data[o + 1] = 255;
		data[o + 2] = 255;
		if (inside[i] === 1) {
			data[o + 3] = 255;
		}
	}
	context.putImageData(image, 0, 0);
	const silhouette = { target, ...anchor };
	baked.set(target.canvas, silhouette);
	return silhouette;
}

/**
 * The silhouette of an image, at most {@link MAX_SILHOUETTE} on a side.
 * @ignore
 */
function imageSilhouette(image: MaskImage): Silhouette | null {
	const k = Math.min(
		1,
		MAX_SILHOUETTE / Math.max(image.width, image.height, 1),
	);
	const w = Math.max(1, Math.round(image.width * k));
	const h = Math.max(1, Math.round(image.height * k));
	return bakeSilhouette(w, h, (context) => {
		context.drawImage(image, 0, 0, w, h);
	});
}

/**
 * The silhouette of the frame a sprite shows now, drawn by the sprite
 * itself ({@link Sprite#drawFrame}: an atlas region trimmed or stored
 * turned, the nine slices of a `NineSliceSprite`), and flipped the way it
 * is. At most {@link MAX_SILHOUETTE} on a side.
 * @ignore
 */
function spriteSilhouette(sprite: Sprite): Silhouette | null {
	const sw = Math.max(1, sprite.width);
	const sh = Math.max(1, sprite.height);
	const k = Math.min(1, MAX_SILHOUETTE / Math.max(sw, sh));
	return bakeSilhouette(
		Math.max(1, Math.round(sw * k)),
		Math.max(1, Math.round(sh * k)),
		(context) => {
			context.scale(k, k);
			if (sprite.isFlippedX || sprite.isFlippedY) {
				context.translate(
					sprite.isFlippedX ? sw : 0,
					sprite.isFlippedY ? sh : 0,
				);
				context.scale(sprite.isFlippedX ? -1 : 1, sprite.isFlippedY ? -1 : 1);
			}
			(
				sprite as Sprite & {
					drawFrame: (
						target: CanvasRenderingContext2D,
						x: number,
						y: number,
					) => void;
				}
			).drawFrame(context, 0, 0);
		},
	);
}

/**
 * The point a polygon grows about, in its own units: its origin when it
 * surrounds it, as a unit-sized template is meant to, or else the inside
 * point farthest from its edges. `null` for a polygon with no inside.
 * @ignore
 */
function polygonAnchor(polygon: Polygon): Anchor | null {
	const points = polygon.points;
	const isInside = (x: number, y: number) => {
		return polygon.contains(polygon.pos.x + x, polygon.pos.y + y);
	};
	const toEdge = (x: number, y: number) => {
		let nearest = Infinity;
		for (let i = 0; i < points.length; i++) {
			const a = points[i];
			const b = points[(i + 1) % points.length];
			const ex = b.x - a.x;
			const ey = b.y - a.y;
			const len2 = ex * ex + ey * ey;
			const t =
				len2 > 0
					? Math.min(1, Math.max(0, ((x - a.x) * ex + (y - a.y) * ey) / len2))
					: 0;
			nearest = Math.min(
				nearest,
				Math.hypot(a.x + ex * t - x, a.y + ey * t - y),
			);
		}
		return nearest;
	};
	if (isInside(0, 0)) {
		const inner = toEdge(0, 0);
		if (inner > 1e-6) {
			return { x: 0, y: 0, inner };
		}
	}
	// not about its origin: the deepest point of a grid over its bounds
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const p of points) {
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
		maxX = Math.max(maxX, p.x);
		maxY = Math.max(maxY, p.y);
	}
	const STEPS = 32;
	let best: Anchor | null = null;
	for (let j = 0; j < STEPS; j++) {
		for (let i = 0; i < STEPS; i++) {
			const x = minX + ((i + 0.5) / STEPS) * (maxX - minX);
			const y = minY + ((j + 0.5) / STEPS) * (maxY - minY);
			if (isInside(x, y)) {
				const inner = toEdge(x, y);
				if (best === null || inner > best.inner) {
					best = { x, y, inner };
				}
			}
		}
	}
	return best !== null && best.inner > 1e-6 ? best : null;
}

/**
 * true for a `Sprite`, told apart without importing the class
 * @param shape - the value to test
 * @returns whether `shape` is a sprite
 */
function isSprite(shape: unknown): shape is Sprite {
	return (
		typeof shape === "object" &&
		shape !== null &&
		"current" in shape &&
		"image" in shape &&
		"offset" in shape &&
		typeof (shape as { drawFrame?: unknown }).drawFrame === "function"
	);
}

/**
 * true for a renderable, told apart without importing the class. Not by
 * `getBounds`, which the geometry classes have too: a renderable is a
 * `Rect`, and so a `Polygon`, but one that draws.
 * @ignore
 * @param value - the value to test
 * @returns whether `value` is a renderable
 */
export function isRenderable(value: unknown): value is Renderable {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as Renderable).preDraw === "function" &&
		typeof (value as Renderable).getBounds === "function"
	);
}

/**
 * true for an image or a canvas a silhouette can be read from
 * @param value - the value to test
 * @returns whether `value` is an image
 */
function isImage(value: unknown): value is MaskImage {
	return (
		(typeof HTMLImageElement !== "undefined" &&
			value instanceof HTMLImageElement) ||
		(typeof HTMLCanvasElement !== "undefined" &&
			value instanceof HTMLCanvasElement) ||
		(typeof OffscreenCanvas !== "undefined" &&
			value instanceof OffscreenCanvas) ||
		(typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap) ||
		// a canvas from another realm, or a host's own (a DOM-less runtime)
		(typeof value === "object" &&
			value !== null &&
			typeof (value as HTMLCanvasElement).getContext === "function" &&
			typeof (value as HTMLCanvasElement).width === "number")
	);
}

/**
 * A camera effect that performs a mask-based scene transition.
 *
 * A shape closes on a point to hide the scene, filling the screen around
 * it with a solid color, and opens from it again to reveal the scene. The
 * shape can be:
 * - an `Ellipse` (an iris, the default) or a `Polygon`, unit-sized and
 *   centred on its origin;
 * - an image, or the name of a preloaded one: the shape is its silhouette,
 *   its transparent pixels outside and the others inside (colors do not
 *   matter, and gaps inside the outline are filled);
 * - a `Sprite`: the silhouette of the frame it shows when the effect
 *   starts, facing the way it faces (not its scale or rotation: the shape
 *   is grown to the screen's size anyway).
 *
 * The shape grows and shrinks about its thickest part (the origin of a
 * unit `Polygon` or `Ellipse`), and that point sits on the centre of the
 * screen, or on `center`: a renderable, at the place it is drawn when the
 * effect starts, such as the player. With `invert`, the shape is the cover
 * instead of the window: filled with the color, it grows out of that point
 * until it covers the screen, and shrinks away to reveal it.
 *
 * Whatever the shape and the point, the shape is grown until it holds the
 * whole screen, so a reveal ends with the scene fully uncovered. It is
 * drawn with plain images and fills, the same on every renderer. A shape
 * that cannot be used (an unknown image name, an image that cannot be read,
 * an empty one, a destroyed sprite) warns once and is an iris instead.
 * @category Camera
 * @example
 * // iris transition (circle shrinks to hide the scene)
 * camera.addCameraEffect(new MaskEffect(camera, {
 *     shape: new Ellipse(0, 0, 1, 1),
 *     color: "#000",
 *     duration: 500,
 *     direction: "hide",
 * }));
 * @example
 * // diamond reveal transition
 * camera.addCameraEffect(new MaskEffect(camera, {
 *     shape: new Polygon(0, 0, [
 *         { x: 0, y: -1 }, { x: 1, y: 0 },
 *         { x: 0, y: 1 }, { x: -1, y: 0 },
 *     ]),
 *     color: "#000",
 *     duration: 500,
 *     direction: "reveal",
 * }));
 * @example
 * // a star wipe from a preloaded silhouette image
 * camera.addCameraEffect(new MaskEffect(camera, {
 *     shape: "star_mask", // or loader.getImage("star_mask")
 *     color: "#000",
 *     duration: 500,
 * }));
 * @example
 * // the player's own silhouette closing on the player
 * camera.addCameraEffect(new MaskEffect(camera, {
 *     shape: player,
 *     center: player,
 *     color: "#000",
 *     duration: 500,
 * }));
 * @example
 * // a black heart growing out of the player until it covers the screen
 * camera.addCameraEffect(new MaskEffect(camera, {
 *     shape: "heart_mask",
 *     center: player,
 *     invert: true,
 *     color: "#000",
 *     duration: 400,
 * }));
 */
export default class MaskEffect extends CameraEffect {
	/**
	 * the transition fill color
	 */
	color: Color;

	/**
	 * the shape as given: an `Ellipse` or `Polygon` template, an image, the
	 * name of one, or a sprite; `undefined` for the default iris
	 */
	shape: MaskShape | undefined;

	/**
	 * the point the shape closes on and opens from, in the camera's screen
	 * coordinates, read when the effect started; `undefined` for the centre
	 * of the screen
	 */
	center: { x: number; y: number } | undefined;

	/**
	 * `true` when the shape is the cover rather than the window: it grows
	 * to hide the scene and shrinks to reveal it
	 * @default false
	 */
	invert: boolean;

	/**
	 * the transition duration, in milliseconds
	 */
	duration: number;

	/**
	 * current progress value (0 = fully covered, 1 = fully visible)
	 */
	progress: { value: number };

	/**
	 * the tween controlling progress
	 */
	tween: Tween;

	/**
	 * transition direction
	 */
	direction: "hide" | "reveal";

	/**
	 * optional callback when transition completes
	 */
	onComplete: (() => void) | undefined;

	/**
	 * pooled shape used for rendering a geometric mask (avoids per-frame
	 * allocation); `undefined` for an image or sprite mask
	 * @ignore
	 * @internal
	 */
	_maskShape: Ellipse | Polygon | undefined;

	/**
	 * the unit `Polygon` template the drawn polygon is scaled from
	 * @ignore
	 * @internal
	 */
	_template: Polygon | undefined;

	/**
	 * the silhouette of an image or sprite mask, white on clear
	 * @ignore
	 * @internal
	 */
	_silhouette: Silhouette | undefined;

	/**
	 * what is drawn of an image or sprite mask: the color round the
	 * silhouette (or, inverted, the silhouette in the color)
	 * @ignore
	 * @internal
	 */
	_cover: CanvasRenderTarget | undefined;

	/**
	 * the point the shape grows about, in its own units, and the radius of
	 * the largest circle round it inside the shape
	 * @ignore
	 * @internal
	 */
	_anchor: Anchor;

	/**
	 * the renderer that drew the cover, to free its copy on the GPU
	 * @ignore
	 * @internal
	 */
	_renderer: Renderer | undefined;

	/**
	 * @param camera - the camera to apply the transition to
	 * @param options - transition parameters, see {@link MaskEffectOptions}
	 * @param [options.shape] - an `Ellipse` or `Polygon` (unit-sized), an
	 * image or the name of a preloaded one, or a `Sprite`; an iris when omitted
	 * @param options.color - CSS color value or Color instance for the transition fill
	 * @param [options.duration=500] - transition duration in milliseconds
	 * @param [options.direction="hide"] - "hide" covers the scene, "reveal" uncovers it
	 * @param [options.center] - where the shape closes and opens: a
	 * renderable (where it is drawn when the effect starts) or a point in the
	 * camera's screen coordinates. The centre of the screen by default
	 * @param [options.invert=false] - make the shape the cover rather than
	 * the window: it grows out of `center` to hide the scene
	 * @param [options.onComplete] - callback when the transition finishes
	 */
	constructor(camera: Camera2d, options: MaskEffectOptions) {
		super(camera);

		this.color = colorPool.get(options.color);
		this.direction = options.direction ?? "hide";
		this.onComplete = options.onComplete;
		this.invert = options.invert === true;
		this.duration = options.duration ?? 500;
		this.shape = options.shape;
		this._maskShape = undefined;
		this._template = undefined;
		this._silhouette = undefined;
		this._cover = undefined;
		this._renderer = undefined;
		this._anchor = { x: 0, y: 0, inner: 1 };

		this._resolveShape(options.shape);
		this.center = this._resolveCenter(options.center);

		// progress: 1 = fully visible, 0 = fully covered
		if (this.direction === "hide") {
			this.progress = { value: 1.0 };
			this.tween = tweenPool
				.get(this.progress)
				.to({ value: 0.0 }, { duration: this.duration });
		} else {
			this.progress = { value: 0.0 };
			this.tween = tweenPool
				.get(this.progress)
				.to({ value: 1.0 }, { duration: this.duration });
		}

		this.tween.isPersistent = true;
		this.tween.start();
	}

	/**
	 * The settings of the effect that plays this one backwards: the other
	 * direction, with the same color, duration and `invert`, the shape this
	 * one settled when it started (the silhouette a sprite gave, though the
	 * sprite may be gone by then) and the point it closed on. Read them
	 * while this effect is still on its camera. Used by `state.transition`
	 * and `Trigger` for their reveal.
	 * @ignore
	 * @internal
	 * @param [onComplete] - a callback for the new effect
	 * @returns the settings for a new `MaskEffect`
	 */
	reverseOptions(onComplete?: () => void): MaskEffectOptions {
		return {
			shape: this._silhouette?.target.canvas ?? this._template ?? this.shape,
			color: this.color.toRGBA(),
			duration: this.duration,
			direction: this.direction === "hide" ? "reveal" : "hide",
			center: this.center,
			invert: this.invert,
			onComplete,
		};
	}

	/**
	 * Settle the shape: a template to scale, or a silhouette to draw.
	 * @ignore
	 */
	_resolveShape(shape: MaskShape | undefined): void {
		let source: unknown = shape;
		const fallBack = (why: string) => {
			warnOnce(`melonJS: MaskEffect: ${why}, an iris is used instead`);
			source = undefined;
		};
		if (typeof source === "string") {
			source = getImage(source) ?? undefined;
			if (source === undefined) {
				fallBack(`no loaded image named "${shape as string}"`);
			}
		}
		if (
			isRenderable(source) &&
			!isSprite(source) &&
			isSprite((source as Renderable & { renderable?: unknown }).renderable)
		) {
			// an Entity: the sprite it draws
			source = (source as Renderable & { renderable: Sprite }).renderable;
		}

		if (source === undefined) {
			// the default iris, or the fallback for a shape that cannot be used
		} else if (source instanceof Ellipse) {
			this._maskShape = source.clone();
		} else if (isSprite(source)) {
			if (source.offset === undefined || source.image === undefined) {
				fallBack("the sprite was destroyed before the transition started");
			} else {
				const sprite = source;
				this._silhouette = this._bake(() => {
					return spriteSilhouette(sprite);
				});
			}
		} else if (isRenderable(source)) {
			fallBack(
				"of the renderables, only a Sprite can shape a mask (its current frame)",
			);
		} else if (source instanceof Polygon) {
			const anchor = polygonAnchor(source);
			if (anchor === null) {
				fallBack("the polygon has no inside");
			} else {
				this._template = source;
				this._maskShape = source.clone();
				this._anchor = anchor;
			}
		} else if (isImage(source)) {
			const image = source;
			this._silhouette =
				baked.get(image) ??
				this._bake(() => {
					return imageSilhouette(image);
				});
		} else {
			fallBack(
				"the shape is not an Ellipse, a Polygon, an image or its name, or a Sprite",
			);
		}

		if (this._silhouette !== undefined) {
			const { x, y, inner } = this._silhouette;
			this._anchor = { x, y, inner };
			this._cover = this._makeCover(this._silhouette);
		} else if (this._maskShape === undefined) {
			this._maskShape = ellipsePool.get(0, 0, 1, 1);
		}
	}

	/**
	 * Bake a silhouette, or `undefined` (and a warning) for an image the
	 * browser cannot read back (a compressed texture, a cross-origin image)
	 * or one with nothing in it.
	 * @ignore
	 */
	_bake(bake: () => Silhouette | null): Silhouette | undefined {
		let silhouette: Silhouette | null;
		try {
			silhouette = bake();
		} catch {
			warnOnce(
				"melonJS: MaskEffect: the image could not be read (a compressed texture, or a cross-origin image), an iris is used instead",
			);
			return undefined;
		}
		if (silhouette === null) {
			warnOnce(
				"melonJS: MaskEffect: the image or frame is fully transparent, an iris is used instead",
			);
			return undefined;
		}
		return silhouette;
	}

	/**
	 * What is drawn: the color everywhere but the silhouette, or inverted,
	 * the silhouette in the color.
	 * @ignore
	 */
	_makeCover(silhouette: Silhouette): CanvasRenderTarget {
		const canvas = silhouette.target.canvas;
		const cover = new CanvasRenderTarget(canvas.width, canvas.height, {
			context: "2d",
		});
		const context = cover.context as CanvasRenderingContext2D;
		context.fillStyle = this.color.toRGBA();
		if (this.invert) {
			context.drawImage(canvas, 0, 0);
			context.globalCompositeOperation = "source-in";
			context.fillRect(0, 0, canvas.width, canvas.height);
		} else {
			context.fillRect(0, 0, canvas.width, canvas.height);
			context.globalCompositeOperation = "destination-out";
			context.drawImage(canvas, 0, 0);
		}
		context.globalCompositeOperation = "source-over";
		return cover;
	}

	/**
	 * Where the shape closes, in the camera's screen coordinates, read once.
	 * @ignore
	 */
	_resolveCenter(
		center: MaskCenter | undefined,
	): { x: number; y: number } | undefined {
		if (center === undefined) {
			return undefined;
		}
		if (!isRenderable(center)) {
			if (Number.isFinite(center.x) && Number.isFinite(center.y)) {
				return { x: center.x, y: center.y };
			}
			return undefined;
		}
		if (center.ancestor === undefined) {
			warnOnce(
				"melonJS: MaskEffect: the center renderable is not in the world, the centre of the screen is used instead",
			);
			return undefined;
		}
		const bounds = center.getBounds();
		const x = bounds.centerX;
		const y = bounds.centerY;
		// in a floating container too (whose children are not `floating`
		// themselves): its bounds are on the screen already
		if (center.isFloating) {
			return { x, y };
		}
		const camera = this.camera as Camera2d & {
			worldToScreen?: (world: Vector3d) => Vector2d | null;
		};
		if (typeof camera.worldToScreen === "function") {
			// the bounds are absolute, so the depth must be too
			const depth = center.getAbsolutePosition().z;
			const screen = camera.worldToScreen(_world3d.set(x, y, depth));
			return screen === null ? undefined : { x: screen.x, y: screen.y };
		}
		camera.worldToLocal(x, y, _local);
		return { x: _local.x - camera.screenX, y: _local.y - camera.screenY };
	}

	override update(): void {
		// check if the transition has completed
		if (
			(this.direction === "hide" && this.progress.value <= 0.0) ||
			(this.direction === "reveal" && this.progress.value >= 1.0)
		) {
			this.progress.value = this.direction === "hide" ? 0.0 : 1.0;
			// On the TRANSITION into complete, not on every frame that finds
			// it complete. A persistent effect is still updated after it
			// finishes, by design, so an unguarded call here repeats for as
			// long as its owner keeps it: a state transition's callback
			// defers the switch and the effect is only taken away once that
			// switch lands, so every frame in between queued another one.
			if (!this.isComplete) {
				this.isComplete = true;
				if (typeof this.onComplete === "function") {
					this.onComplete();
				}
			}
		}
	}

	override draw(renderer: Renderer, width: number, height: number): void {
		if (this.isComplete && this.direction === "reveal") {
			return;
		}

		const visible = this.progress.value;
		const cx = this.center?.x ?? width / 2;
		const cy = this.center?.y ?? height / 2;
		// the corner farthest from the point: once the shape's inner circle
		// reaches it, the shape holds the whole screen
		const far = Math.max(
			Math.hypot(cx, cy),
			Math.hypot(width - cx, cy),
			Math.hypot(cx, height - cy),
			Math.hypot(width - cx, height - cy),
		);
		// how far the shape is grown: the window shrinks as the scene is
		// hidden, the cover grows
		const grown = this.invert ? 1 - visible : visible;
		const scale = (grown * far) / this._anchor.inner;

		const r = renderer as any;
		r.save();
		r.resetTransform();
		r.setColor(this.color);

		if ((this.invert && grown >= 1) || (!this.invert && grown <= 0)) {
			// fully covered
			r.fillRect(0, 0, width, height);
		} else if (grown > 0 || !this.invert) {
			if (this._cover !== undefined) {
				this._renderer = renderer;
				this._drawCover(r, cx, cy, scale, width, height);
			} else {
				this._drawShape(r, cx, cy, scale, width, height);
			}
		}

		r.restore();
	}

	/**
	 * Draw a geometric mask at `scale`, its anchor on (`cx`, `cy`).
	 * @ignore
	 */
	_drawShape(
		r: any,
		cx: number,
		cy: number,
		scale: number,
		width: number,
		height: number,
	): void {
		const mask = this._maskShape!;
		if (this._template === undefined) {
			(mask as Ellipse).setShape(cx, cy, scale * 2, scale * 2);
		} else {
			const points = this._template.points;
			const polygon = mask as Polygon;
			const { x, y } = this._anchor;
			for (let i = 0; i < points.length; i++) {
				polygon.points[i].set(
					(points[i].x - x) * scale,
					(points[i].y - y) * scale,
				);
			}
			polygon.pos.set(cx, cy);
		}
		if (this.invert) {
			r.fill(mask);
		} else {
			// only fill OUTSIDE the shape (invert = true)
			r.setMask(mask, true);
			r.fillRect(0, 0, width, height);
			r.clearMask();
		}
	}

	/**
	 * Draw an image or sprite mask at `scale`, its anchor on (`cx`, `cy`):
	 * the cover image, and for a window the color round it.
	 * @ignore
	 */
	_drawCover(
		r: any,
		cx: number,
		cy: number,
		scale: number,
		width: number,
		height: number,
	): void {
		const canvas = this._cover!.canvas;
		// whole pixels, so the image and the bands round it meet with no seam
		const w = Math.round(canvas.width * scale);
		const h = Math.round(canvas.height * scale);
		if (w < 1 || h < 1) {
			if (!this.invert) {
				r.fillRect(0, 0, width, height);
			}
			return;
		}
		const x = Math.round(cx - this._anchor.x * scale);
		const y = Math.round(cy - this._anchor.y * scale);
		r.drawImage(canvas, 0, 0, canvas.width, canvas.height, x, y, w, h);
		if (!this.invert) {
			if (y > 0) {
				r.fillRect(0, 0, width, y);
			}
			if (y + h < height) {
				r.fillRect(0, y + h, width, height - y - h);
			}
			if (x > 0) {
				r.fillRect(0, y, x, h);
			}
			if (x + w < width) {
				r.fillRect(x + w, y, width - x - w, h);
			}
		}
	}

	override destroy(): void {
		// see FadeEffect.destroy(): guarded so a second call is a no-op rather
		// than releasing a tween this effect no longer owns
		if (this.tween !== undefined) {
			this.tween.stop();
			tweenPool.release(this.tween);
			this.tween = undefined as unknown as typeof this.tween;
		}
		if (this.color !== undefined) {
			colorPool.release(this.color);
			this.color = undefined as unknown as typeof this.color;
		}
		if (this._maskShape !== undefined) {
			if (this._template === undefined) {
				ellipsePool.release(this._maskShape as Ellipse);
			} else {
				polygonPool.release(this._maskShape as Polygon);
			}
			this._maskShape = undefined;
		}
		if (this._cover !== undefined) {
			// and the copy the renderer uploaded to the GPU
			this._cover.destroy(this._renderer);
			this._cover = undefined;
		}
		// the silhouette is kept: a reverse effect may be using it, and it
		// never went to the GPU, so the garbage collector frees it
		this._silhouette = undefined;
		this._template = undefined;
		this._renderer = undefined;
	}
}
