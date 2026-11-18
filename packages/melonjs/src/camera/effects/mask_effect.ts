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
import { createCanvas } from "../../video/canvas_factory.js";
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
 * - an `Ellipse` (an iris) or a `Polygon` centred on the origin, unit-sized;
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

/** the largest side a silhouette is kept at, in pixels */
const MAX_SILHOUETTE = 512;
/** clear pixels kept round a silhouette, so its outside is one region */
const PAD = 2;

/** a world point to project with a 3D camera; never escapes `resolveCenter` */
const _world3d = new Vector3d();
/** where a 2D camera draws a world point; never escapes `resolveCenter` */
const _local = new Vector2d();

/**
 * A silhouette made from an image: solid white where the image is, clear
 * around it, with a small clear margin.
 * @ignore
 */
interface Silhouette {
	canvas: HTMLCanvasElement | OffscreenCanvas;
	/**
	 * the radius of the largest circle round the silhouette's centre that
	 * lies inside it, in its pixels: once that circle reaches the farthest
	 * corner, the screen is wholly inside the silhouette
	 */
	inner: number;
}

/**
 * The silhouettes made so far, by their canvas: one handed back as a shape
 * (the reveal of a transition, from its hide) is used as it is, not made
 * again from itself.
 * @ignore
 */
const baked = new WeakMap<object, Silhouette>();

/**
 * Draw `draw` into a canvas `w` × `h` (plus the margin) and make a solid
 * silhouette of it.
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
): Silhouette {
	const cw = w + PAD * 2;
	const ch = h + PAD * 2;
	const canvas = createCanvas(cw, ch);
	const context = canvas.getContext("2d", {
		willReadFrequently: true,
	}) as CanvasRenderingContext2D;
	context.save();
	context.translate(PAD, PAD);
	draw(context);
	context.restore();

	const image = context.getImageData(0, 0, cw, ch);
	const data = image.data;
	const count = cw * ch;
	// opaque from a low threshold up: soft edges stay a little soft
	for (let i = 0; i < count; i++) {
		const a = data[i * 4 + 3];
		data[i * 4 + 3] = Math.min(255, Math.max(0, (a - 24) * 4));
	}
	// flood the outside from the margin; whatever it cannot reach is inside
	const outside = new Uint8Array(count);
	const stack: number[] = [];
	const visit = (i: number) => {
		if (outside[i] === 0 && data[i * 4 + 3] < 128) {
			outside[i] = 1;
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
	// white inside, and the nearest outside pixel to the centre
	const mx = cw / 2;
	const my = ch / 2;
	let nearest = Infinity;
	for (let i = 0; i < count; i++) {
		const o = i * 4;
		data[o] = 255;
		data[o + 1] = 255;
		data[o + 2] = 255;
		if (outside[i] === 0) {
			data[o + 3] = 255;
		} else if (data[o + 3] < 128) {
			const x = (i % cw) + 0.5 - mx;
			const y = Math.floor(i / cw) + 0.5 - my;
			const d = x * x + y * y;
			if (d < nearest) {
				nearest = d;
			}
		}
	}
	context.putImageData(image, 0, 0);

	let inner = Math.sqrt(nearest);
	// a silhouette with nothing at its centre (a ring) has no circle to grow:
	// it is grown to its own size instead, and the screen uncovers at the end
	if (!(inner >= 1)) {
		inner = Math.min(w, h) / 2;
	}
	const silhouette = { canvas, inner };
	baked.set(canvas, silhouette);
	return silhouette;
}

/**
 * The silhouette of an image, at most {@link MAX_SILHOUETTE} on a side.
 * @ignore
 */
function imageSilhouette(image: MaskImage): Silhouette {
	const iw = image.width;
	const ih = image.height;
	const k = Math.min(1, MAX_SILHOUETTE / Math.max(iw, ih, 1));
	const w = Math.max(1, Math.round(iw * k));
	const h = Math.max(1, Math.round(ih * k));
	return bakeSilhouette(w, h, (context) => {
		context.drawImage(image, 0, 0, w, h);
	});
}

/**
 * The silhouette of the frame a sprite shows now, as it is drawn: the
 * atlas region (trimmed or rotated alike), flipped the way the sprite is.
 * @ignore
 */
function spriteSilhouette(sprite: Sprite): Silhouette {
	const frame = sprite.current as {
		offset: { x: number; y: number };
		width: number;
		height: number;
		angle: number;
		trim?: { x: number; y: number } | null;
	};
	const w = Math.max(1, Math.round(sprite.width));
	const h = Math.max(1, Math.round(sprite.height));
	return bakeSilhouette(w, h, (context) => {
		if (sprite.isFlippedX || sprite.isFlippedY) {
			context.translate(sprite.isFlippedX ? w : 0, sprite.isFlippedY ? h : 0);
			context.scale(sprite.isFlippedX ? -1 : 1, sprite.isFlippedY ? -1 : 1);
		}
		const sx = sprite.offset.x + frame.offset.x;
		const sy = sprite.offset.y + frame.offset.y;
		const dx = frame.trim ? frame.trim.x : 0;
		const dy = frame.trim ? frame.trim.y : 0;
		const image = sprite.image as CanvasImageSource;
		if (frame.angle !== 0) {
			// stored turned in the atlas: turned back as `Sprite#draw` does
			context.translate(dx, dy + frame.height);
			context.rotate(frame.angle);
			context.drawImage(
				image,
				sx,
				sy,
				frame.height,
				frame.width,
				0,
				0,
				frame.height,
				frame.width,
			);
		} else {
			context.drawImage(
				image,
				sx,
				sy,
				frame.width,
				frame.height,
				dx,
				dy,
				frame.width,
				frame.height,
			);
		}
	});
}

/**
 * true for a `Sprite`, told apart without importing the class
 * @param shape - the value to test
 */
function isSprite(shape: unknown): shape is Sprite {
	return (
		typeof shape === "object" &&
		shape !== null &&
		"current" in shape &&
		"image" in shape &&
		"offset" in shape
	);
}

/**
 * true for a renderable, told apart without importing the class. Not by
 * `getBounds`, which the geometry classes have too: a renderable is a
 * `Rect`, and so a `Polygon`, but one that draws
 * @param center - the value to test
 */
function isRenderable(center: unknown): center is Renderable {
	return (
		typeof center === "object" &&
		center !== null &&
		typeof (center as Renderable).preDraw === "function" &&
		typeof (center as Renderable).getBounds === "function"
	);
}

/**
 * The radius of the largest circle round the origin inside a unit polygon:
 * its distance to the nearest edge.
 * @ignore
 */
function polygonInner(polygon: Polygon): number {
	const points = polygon.points;
	let nearest = Infinity;
	for (let i = 0; i < points.length; i++) {
		const a = points[i];
		const b = points[(i + 1) % points.length];
		const ex = b.x - a.x;
		const ey = b.y - a.y;
		const len2 = ex * ex + ey * ey;
		const t =
			len2 > 0 ? Math.min(1, Math.max(0, -(a.x * ex + a.y * ey) / len2)) : 0;
		const d = Math.hypot(a.x + ex * t, a.y + ey * t);
		if (d < nearest) {
			nearest = d;
		}
	}
	// a polygon that does not surround its origin is grown as if it did
	return nearest > 1e-6 && Number.isFinite(nearest) ? nearest : 1;
}

/**
 * A camera effect that performs a mask-based scene transition.
 *
 * A shape closes on a point to hide the scene, filling the screen around
 * it with a solid color, and opens from it again to reveal the scene. The
 * shape can be:
 * - an `Ellipse` (an iris) or a `Polygon`, unit-sized and centred on the
 *   origin;
 * - an image, or the name of a preloaded one: the shape is its silhouette,
 *   its transparent pixels outside and the others inside (colors do not
 *   matter, and gaps inside the outline are filled);
 * - a `Sprite`: the silhouette of the frame it shows when the effect
 *   starts, facing the way it faces.
 *
 * It closes on the centre of the screen, or on `center`: a renderable, at
 * the place it is drawn when the effect starts, such as the player. With
 * `invert`, the shape is the cover instead of the window: filled with the
 * color, it grows out of that point until it covers the screen, and
 * shrinks away to reveal it.
 *
 * Whatever the shape and the point, the shape is grown until it holds the
 * whole screen, so a reveal ends with the scene fully uncovered. It is
 * drawn with plain images and fills, the same on every renderer.
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
	 * name of one, or a sprite
	 */
	shape: MaskShape;

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
	 * the radius of the largest circle round the shape's centre that lies
	 * inside it, in the shape's own units
	 * @ignore
	 * @internal
	 */
	_inner: number;

	/**
	 * the renderer that drew the cover, to free its copy on the GPU
	 * @ignore
	 * @internal
	 */
	_renderer: Renderer | undefined;

	/**
	 * @param camera - the camera to apply the transition to
	 * @param options - transition parameters
	 * @param options.shape - an `Ellipse` or `Polygon` (unit-sized, centred on
	 * the origin), an image or the name of a preloaded one, or a `Sprite`
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
	constructor(
		camera: Camera2d,
		options: {
			shape: MaskShape;
			color: Color | string;
			duration?: number | undefined;
			direction?: "hide" | "reveal" | undefined;
			center?: MaskCenter | undefined;
			invert?: boolean | undefined;
			onComplete?: (() => void) | undefined;
		},
	) {
		super(camera);

		this.color = colorPool.get(options.color);
		this.direction = options.direction ?? "hide";
		this.onComplete = options.onComplete;
		this.invert = options.invert === true;
		this.shape = options.shape;
		this._maskShape = undefined;
		this._silhouette = undefined;
		this._cover = undefined;
		this._renderer = undefined;
		this._inner = 1;

		this._resolveShape(options.shape);
		this.center = this._resolveCenter(options.center);

		// progress: 1 = fully visible, 0 = fully covered
		const duration = options.duration ?? 500;
		if (this.direction === "hide") {
			this.progress = { value: 1.0 };
			this.tween = tweenPool
				.get(this.progress)
				.to({ value: 0.0 }, { duration });
		} else {
			this.progress = { value: 0.0 };
			this.tween = tweenPool
				.get(this.progress)
				.to({ value: 1.0 }, { duration });
		}

		this.tween.isPersistent = true;
		this.tween.start();
	}

	/**
	 * The shape this effect draws, settled when it started: the `Ellipse` or
	 * `Polygon` template, or the silhouette an image or sprite made. Handed
	 * to the effect that reverses this one, it gives the same shape, though
	 * the sprite it came from may be gone by then.
	 * @ignore
	 * @internal
	 */
	get resolvedShape(): MaskShape {
		return this._silhouette?.canvas ?? this.shape;
	}

	/**
	 * Settle the shape: a template to scale, or a silhouette to draw.
	 * @ignore
	 */
	_resolveShape(shape: MaskShape): void {
		let source: MaskShape | null = shape;
		if (typeof source === "string") {
			source = getImage(source) as MaskImage | null;
			if (source === null) {
				warnOnce(
					`melonJS: MaskEffect: no loaded image named "${shape as string}", an iris is used instead`,
				);
			}
		}
		if (
			source !== null &&
			!isSprite(source) &&
			isRenderable(source) &&
			isSprite((source as Renderable & { renderable?: unknown }).renderable)
		) {
			// an Entity: the sprite it draws
			source = (source as Renderable & { renderable: Sprite }).renderable;
		}
		if (source !== null && !isSprite(source) && isRenderable(source)) {
			warnOnce(
				"melonJS: MaskEffect: of the renderables, only a Sprite can shape a mask (its current frame), an iris is used instead",
			);
			source = null;
		}
		if (source instanceof Ellipse) {
			this._maskShape = source.clone();
			this._inner = 1;
		} else if (source instanceof Polygon && !isRenderable(source)) {
			this._maskShape = source.clone();
			this._inner = polygonInner(source);
		} else if (source !== null && isSprite(source)) {
			if (source.offset === undefined || source.image === undefined) {
				warnOnce(
					"melonJS: MaskEffect: the sprite was destroyed before the transition started, an iris is used instead",
				);
			} else {
				this._silhouette = this._tryBake(() => {
					return spriteSilhouette(source);
				});
			}
		} else if (source !== null) {
			// what is left: an image (a renderable other than a sprite was
			// turned away above, which the type cannot follow)
			const image = source as unknown as MaskImage;
			this._silhouette =
				baked.get(image) ??
				this._tryBake(() => {
					return imageSilhouette(image);
				});
		}
		if (this._maskShape === undefined && this._silhouette === undefined) {
			// nothing drawable: an iris, rather than no transition at all
			this._maskShape = ellipsePool.get(0, 0, 1, 1);
			this._inner = 1;
		}
		if (this._silhouette !== undefined) {
			this._inner = this._silhouette.inner;
			this._cover = this._makeCover(this._silhouette);
		}
	}

	/**
	 * Bake a silhouette, or `undefined` for an image the browser cannot draw
	 * into a canvas (a compressed texture, a cross-origin image).
	 * @ignore
	 */
	_tryBake(bake: () => Silhouette): Silhouette | undefined {
		try {
			return bake();
		} catch {
			warnOnce(
				"melonJS: MaskEffect: the image could not be read (a compressed texture, or a cross-origin image), an iris is used instead",
			);
			return undefined;
		}
	}

	/**
	 * What is drawn: the color everywhere but the silhouette, or inverted,
	 * the silhouette in the color.
	 * @ignore
	 */
	_makeCover(silhouette: Silhouette): CanvasRenderTarget {
		const { canvas } = silhouette;
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
		if (center.floating) {
			return { x, y };
		}
		const camera = this.camera as Camera2d & {
			worldToScreen?: (world: Vector3d) => Vector2d | null;
		};
		if (typeof camera.worldToScreen === "function") {
			const depth = (center as Renderable & { depth?: number }).depth ?? 0;
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
		const scale = (grown * far) / this._inner;

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
	 * Draw a geometric mask at `scale`, centred on (`cx`, `cy`).
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
		if (mask.type === "Ellipse") {
			(mask as Ellipse).setShape(cx, cy, scale * 2, scale * 2);
		} else {
			const points = (this.shape as Polygon).points;
			const polygon = mask as Polygon;
			for (let i = 0; i < points.length; i++) {
				polygon.points[i].set(points[i].x * scale, points[i].y * scale);
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
	 * Draw an image or sprite mask at `scale`, centred on (`cx`, `cy`): the
	 * cover image, and for a window the color round it.
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
		const x = Math.round(cx - w / 2);
		const y = Math.round(cy - h / 2);
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
			if (this._maskShape.type === "Ellipse") {
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
		this._silhouette = undefined;
		this._renderer = undefined;
	}
}
