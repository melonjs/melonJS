import { Rect } from "./../geometries/rectangle.ts";
import { game } from "../index.js";
import type { Color } from "../math/color.ts";
import { colorPool } from "../math/color.ts";
import { clamp, toBeCloseTo } from "./../math/math.ts";
import { Matrix2d } from "../math/matrix2d.ts";
import { Matrix3d } from "../math/matrix3d.ts";
import { Vector2d, vector2dPool } from "../math/vector2d.ts";
import { Vector3d } from "../math/vector3d.ts";
import { Bounds, boundsPool } from "./../physics/bounds.ts";
import type Container from "./../renderable/container.js";
import Renderable from "./../renderable/renderable.js";
import {
	CANVAS_ONRESIZE,
	eventEmitter,
	GAME_RESET,
	VIEWPORT_ONCHANGE,
	VIEWPORT_ONRESIZE,
} from "../system/event.ts";
import type Tween from "../tweens/tween.ts";
import { tweenPool } from "../tweens/tween.ts";
import type Renderer from "./../video/renderer.js";
import { renderer } from "./../video/video.js";

/**
 * @import Entity from "./../renderable/entity/entity.js";
 * @import Sprite from "./../renderable/sprite.js";
 * @import NineSliceSprite from "./../renderable/nineslicesprite.js";
 */

interface AxisEnum {
	readonly NONE: 0;
	readonly HORIZONTAL: 1;
	readonly VERTICAL: 2;
	readonly BOTH: 3;
}

interface ShakeState {
	intensity: number;
	duration: number;
	axis: number;
	onComplete: (() => void) | null | undefined;
}

interface FadeState {
	color: Color | null;
	tween: Tween | null;
}

const targetV = new Vector2d();

/**
 * a 2D orthographic camera
 * @category Camera
 * @example
 * // create a minimap camera in the top-right corner showing the full level
 * const minimap = new Camera2d(0, 0, 180, 100);
 * minimap.name = "minimap";
 * minimap.screenX = game.viewport.width - 190;
 * minimap.screenY = 10;
 * minimap.autoResize = false;
 * minimap.setBounds(0, 0, levelWidth, levelHeight);
 * minimap.zoom = Math.min(180 / levelWidth, 100 / levelHeight);
 *
 * // add the camera to the current stage
 * this.cameras.set("minimap", minimap);
 */
export default class Camera2d extends Renderable {
	/**
	 * Axis definition
	 * NONE no axis
	 * HORIZONTAL horizontal axis only
	 * VERTICAL vertical axis only
	 * BOTH both axis
	 */
	AXIS: AxisEnum;

	/**
	 * Camera bounds
	 */
	bounds: Bounds;

	/**
	 * enable or disable damping
	 * @default true
	 */
	smoothFollow: boolean;

	/**
	 * Camera damping for smooth transition [0 .. 1].
	 * 1 being the maximum value and will snap the camera to the target position
	 * @default 1.0
	 */
	damping: number;

	/**
	 * the closest point relative to the camera
	 * @default -1000
	 */
	near: number;

	/**
	 * the furthest point relative to the camera.
	 * @default 1000
	 */
	far: number;

	/**
	 * the x position on the screen where this camera viewport is rendered.
	 * @default 0
	 */
	screenX: number;

	/**
	 * the y position on the screen where this camera viewport is rendered.
	 * @default 0
	 */
	screenY: number;

	/**
	 * @ignore
	 */
	_zoom: number;

	/**
	 * the world-space projection matrix for non-default cameras (offset/zoomed).
	 * Maps world coordinates to the camera's screen viewport.
	 */
	worldProjection: Matrix3d;

	/**
	 * the screen-space projection matrix for non-default cameras.
	 * Maps coordinates so that (0,0) aligns with the camera's screenX/screenY position.
	 * Used for rendering floating elements (e.g. background layers) in the correct screen area.
	 */
	screenProjection: Matrix3d;

	/**
	 * Whether this camera should automatically resize when the canvas resizes.
	 * Set to false for non-default cameras with fixed dimensions
	 * (e.g. minimap, split-screen viewports).
	 * @default true
	 */
	autoResize: boolean;

	/**
	 * cached world view bounds
	 * @ignore
	 */
	_worldView: Bounds;

	/**
	 * the default camera projection matrix
	 * (2d cameras use an orthographic projection by default).
	 */
	projectionMatrix: Matrix3d;

	/**
	 * the invert camera transform used to unproject points
	 * @ignore
	 */
	invCurrentTransform: Matrix2d;

	/** offset for shake effect */
	offset: Vector2d;

	/** target to follow */
	target: Vector2d | Vector3d | null;

	/** default value follow */
	follow_axis: number;

	/**
	 * shake variables
	 * @ignore
	 */
	_shake: ShakeState;

	/**
	 * flash variables
	 * @ignore
	 */
	_fadeOut: FadeState;

	/**
	 * fade variables
	 * @ignore
	 */
	_fadeIn: FadeState;

	/** the camera deadzone */
	deadzone: Rect;

	/**
	 * @param minX - start x offset
	 * @param minY - start y offset
	 * @param maxX - end x offset
	 * @param maxY - end y offset
	 */
	constructor(minX: number, minY: number, maxX: number, maxY: number) {
		super(minX, minY, maxX - minX, maxY - minY);

		this.AXIS = {
			NONE: 0,
			HORIZONTAL: 1,
			VERTICAL: 2,
			BOTH: 3,
		};

		this.bounds = boundsPool.get();

		this.smoothFollow = true;

		this.damping = 1.0;

		this.near = -1000;

		this.far = 1000;

		this.projectionMatrix = new Matrix3d();

		this.invCurrentTransform = new Matrix2d();

		// offset for shake effect
		this.offset = new Vector2d();

		// target to follow
		this.target = null;

		// default value follow
		this.follow_axis = this.AXIS.NONE;

		this._shake = {
			intensity: 0,
			duration: 0,
			axis: this.AXIS.BOTH,
			onComplete: null,
		};

		this._fadeOut = {
			color: null,
			tween: null,
		};

		this._fadeIn = {
			color: null,
			tween: null,
		};

		// default screen position (top-left of canvas)
		this.screenX = 0;
		this.screenY = 0;
		this.zoom = 1;
		this.worldProjection = new Matrix3d();
		this.screenProjection = new Matrix3d();
		this._worldView = new Bounds();
		this.autoResize = true;

		// default camera name
		this.name = "default";

		// set a default deadzone
		this.setDeadzone(this.width / 6, this.height / 6);

		// for backward "compatibility" (in terms of behavior)
		this.anchorPoint.set(0, 0);

		// enable event detection on the camera
		this.isKinematic = false;

		this.bounds.setMinMax(minX, minY, maxX, maxY);

		// update the projection matrix
		this._updateProjectionMatrix();

		// subscribe to the game reset event
		eventEmitter.addListener(GAME_RESET, this.reset.bind(this));
		// subscribe to the canvas resize event
		eventEmitter.addListener(CANVAS_ONRESIZE, this.resize.bind(this));
	}

	// -- some private function ---

	/** @ignore */
	// update the projection matrix based on the projection frame (a rectangle)
	_updateProjectionMatrix(): void {
		this.projectionMatrix.ortho(
			0,
			this.width,
			this.height,
			0,
			this.near,
			this.far,
		);
	}

	/** @ignore */
	_followH(target: Vector2d | Vector3d): number {
		let targetX = this.pos.x;
		if (target.x - this.pos.x > this.deadzone.right) {
			targetX = Math.min(
				target.x - this.deadzone.right,
				this.bounds.width - this.width,
			);
		} else if (target.x - this.pos.x < this.deadzone.pos.x) {
			targetX = Math.max(target.x - this.deadzone.pos.x, this.bounds.left);
		}
		return targetX;
	}

	/** @ignore */
	_followV(target: Vector2d | Vector3d): number {
		let targetY = this.pos.y;
		if (target.y - this.pos.y > this.deadzone.bottom) {
			targetY = Math.min(
				target.y - this.deadzone.bottom,
				this.bounds.height - this.height,
			);
		} else if (target.y - this.pos.y < this.deadzone.pos.y) {
			targetY = Math.max(target.y - this.deadzone.pos.y, this.bounds.top);
		}
		return targetY;
	}

	// -- public function ---

	/**
	 * the zoom level of this camera.
	 * Values less than 1 zoom out (show more of the world),
	 * values greater than 1 zoom in (show less of the world).
	 * @default 1
	 * @example
	 * // zoom out to show the full level in a 180x100 minimap
	 * camera.zoom = Math.min(180 / levelWidth, 100 / levelHeight);
	 */
	get zoom(): number {
		return this._zoom;
	}

	set zoom(value: number) {
		this._zoom = value > 0 ? value : 1;
	}

	/**
	 * Whether this camera is using default settings (no screen offset, no zoom).
	 * Non-default cameras use custom projections for viewport positioning and scaling.
	 * @returns true if this camera has no screen offset and zoom is 1
	 */
	get isDefault(): boolean {
		return this.screenX === 0 && this.screenY === 0 && this.zoom === 1;
	}

	/**
	 * The world-space bounds currently visible through this camera,
	 * taking into account position and zoom level.
	 * @returns the visible world area
	 */
	get worldView(): Bounds {
		this._worldView.setMinMax(
			this.pos.x,
			this.pos.y,
			this.pos.x + this.width / this.zoom,
			this.pos.y + this.height / this.zoom,
		);
		return this._worldView;
	}

	/**
	 * Set the camera screen position and size in a single call.
	 * @param x - x position on screen
	 * @param y - y position on screen
	 * @param [w] - width (defaults to current width)
	 * @param [h] - height (defaults to current height)
	 * @returns this camera for chaining
	 */
	setViewport(x: number, y: number, w?: number, h?: number): this {
		this.screenX = x;
		this.screenY = y;
		if (typeof w !== "undefined" && typeof h !== "undefined") {
			super.resize(w, h);
			this._updateProjectionMatrix();
		}
		return this;
	}

	/**
	 * reset the camera position to specified coordinates
	 * @param [x=0] - initial position of the camera on the x axis
	 * @param [y=0] - initial position of the camera on the y axis
	 */
	reset(x: number = 0, y: number = 0): void {
		// reset the initial camera position to 0,0
		this.pos.x = x;
		this.pos.y = y;

		// reset the target
		this.unfollow();

		// damping default value
		this.smoothFollow = true;
		this.damping = 1.0;

		// reset the transformation matrix
		this.currentTransform.identity();
		this.invCurrentTransform.identity().invert();

		// reset the projection matrices
		this.worldProjection.identity();
		this.screenProjection.identity();

		// update the projection matrix
		this._updateProjectionMatrix();
	}

	/**
	 * change the deadzone settings.
	 * the "deadzone" defines an area within the current camera in which
	 * the followed renderable can move without scrolling the camera.
	 * @see {@link follow}
	 * @param w - deadzone width
	 * @param h - deadzone height
	 */
	setDeadzone(w: number, h: number): void {
		if (typeof this.deadzone === "undefined") {
			this.deadzone = new Rect(0, 0, 0, 0);
		}

		// reusing the old code for now...
		this.deadzone.pos.set(
			~~((this.width - w) / 2),
			~~((this.height - h) / 2 - h * 0.25),
		);
		this.deadzone.resize(w, h);

		this.smoothFollow = false;

		// force a camera update
		this.updateTarget();

		this.smoothFollow = true;
	}

	/**
	 * resize the camera
	 * @param w - new width of the camera
	 * @param h - new height of the camera
	 * @returns this camera
	 */
	override resize(w: number, h: number): this {
		// skip resize for non-auto-resize cameras (e.g. minimap, split-screen)
		if (!this.autoResize) {
			return this;
		}

		// parent consctructor, resize camera rect
		super.resize(w, h);

		// disable damping while resizing
		this.smoothFollow = false;

		// reset everything
		this.setBounds(0, 0, w, h);
		this.setDeadzone(w / 6, h / 6);
		this.update();
		this.smoothFollow = true;

		// update the projection matrix
		this._updateProjectionMatrix();

		// publish the viewport resize event
		eventEmitter.emit(VIEWPORT_ONRESIZE, this.width, this.height);

		return this;
	}

	/**
	 * set the camera boundaries (set to the world limit by default).
	 * the camera is bound to the given coordinates and cannot move/be scrolled outside of it.
	 * @param x - world left limit
	 * @param y - world top limit
	 * @param w - world width limit
	 * @param h - world height limit
	 */
	setBounds(x: number, y: number, w: number, h: number): void {
		this.smoothFollow = false;
		this.bounds.setMinMax(x, y, w + x, h + y);
		this.moveTo(this.pos.x, this.pos.y);
		this.update();
		this.smoothFollow = true;
	}

	/**
	 * set the camera to follow the specified renderable. <br>
	 * (this will put the camera center around the given target)
	 * @param target - renderable or position vector to follow
	 * @param [axis=me.game.viewport.AXIS.BOTH] - Which axis to follow (see {@link Camera2d.AXIS})
	 * @param [damping=1] - default damping value
	 * @example
	 * // set the camera to follow this renderable on both axis, and enable damping
	 * me.game.viewport.follow(this, me.game.viewport.AXIS.BOTH, 0.1);
	 */
	follow(
		target: Renderable | Vector2d | Vector3d,
		axis?: number,
		damping?: number,
	): void {
		if (target instanceof Renderable) {
			this.target = target.pos;
		} else if (target instanceof Vector2d || target instanceof Vector3d) {
			this.target = target;
		} else {
			throw new Error("invalid target for me.Camera2d.follow");
		}
		// if axis is null, camera is moved on target center
		this.follow_axis = typeof axis === "undefined" ? this.AXIS.BOTH : axis;

		this.smoothFollow = false;

		if (typeof damping !== "number") {
			this.damping = 1;
		} else {
			this.damping = clamp(damping, 0.0, 1.0);
		}

		// force a camera update
		this.updateTarget();

		this.smoothFollow = true;
	}

	/**
	 * unfollow the current target
	 */
	unfollow(): void {
		this.target = null;
		this.follow_axis = this.AXIS.NONE;
	}

	/**
	 * move the camera upper-left position by the specified offset.
	 * @see {@link focusOn}
	 * @param x - horizontal offset
	 * @param y - vertical offset
	 * @example
	 * // Move the camera up by four pixels
	 * me.game.viewport.move(0, -4);
	 */
	move(x: number, y: number): void {
		this.moveTo(this.pos.x + x, this.pos.y + y);
	}

	/**
	 * move the camera upper-left position to the specified coordinates
	 * @see {@link focusOn}
	 * @param x - horizontal position
	 * @param y - vertical position
	 */
	moveTo(x: number, y: number): void {
		const _x = this.pos.x;
		const _y = this.pos.y;

		this.pos.x = clamp(x, this.bounds.left, this.bounds.width - this.width);
		this.pos.y = clamp(y, this.bounds.top, this.bounds.height - this.height);

		//publish the VIEWPORT_ONCHANGE event if necessary
		if (_x !== this.pos.x || _y !== this.pos.y) {
			this.isDirty = true;
		}
	}

	/** @ignore */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	updateTarget(_dt?: number): void {
		if (this.target) {
			targetV.setV(this.pos);

			switch (this.follow_axis) {
				case this.AXIS.NONE:
					//this.focusOn(this.target);
					break;

				case this.AXIS.HORIZONTAL:
					targetV.x = this._followH(this.target);
					break;

				case this.AXIS.VERTICAL:
					targetV.y = this._followV(this.target);
					break;

				case this.AXIS.BOTH:
					targetV.x = this._followH(this.target);
					targetV.y = this._followV(this.target);
					break;

				default:
					break;
			}

			if (!this.pos.equals(targetV)) {
				// update the camera position
				if (this.smoothFollow && this.damping < 1.0) {
					// account for floating precision and check if we are close "enough"
					if (
						toBeCloseTo(targetV.x, this.pos.x, 2) &&
						toBeCloseTo(targetV.y, this.pos.y, 2)
					) {
						this.pos.setV(targetV);
						return;
					} else {
						this.pos.lerp(targetV, this.damping);
					}
				} else {
					this.pos.setV(targetV);
				}
				this.isDirty = true;
			}
		}
	}

	/** @ignore */
	override update(dt?: number): boolean {
		// update the camera position
		this.updateTarget(dt);

		if (this._shake.duration > 0) {
			this._shake.duration -= dt ?? 0;
			if (this._shake.duration <= 0) {
				this._shake.duration = 0;
				this.offset.setZero();
				if (typeof this._shake.onComplete === "function") {
					this._shake.onComplete();
				}
			} else {
				if (
					this._shake.axis === this.AXIS.BOTH ||
					this._shake.axis === this.AXIS.HORIZONTAL
				) {
					this.offset.x = (Math.random() - 0.5) * this._shake.intensity;
				}
				if (
					this._shake.axis === this.AXIS.BOTH ||
					this._shake.axis === this.AXIS.VERTICAL
				) {
					this.offset.y = (Math.random() - 0.5) * this._shake.intensity;
				}
			}
			// updated!
			this.isDirty = true;
		}

		if (this.isDirty) {
			//publish the corresponding message
			eventEmitter.emit(VIEWPORT_ONCHANGE, this.pos);
		}

		// check for fade/flash effect
		if (this._fadeIn.tween != null || this._fadeOut.tween != null) {
			this.isDirty = true;
		}

		if (!this.currentTransform.isIdentity()) {
			this.invCurrentTransform.copy(this.currentTransform).invert();
		} else {
			// reset to default
			this.invCurrentTransform.identity();
		}

		return super.update(dt ?? 0);
	}

	/**
	 * shake the camera
	 * @param intensity - maximum offset that the screen can be moved
	 * while shaking
	 * @param duration - expressed in milliseconds
	 * @param [axis=me.game.viewport.AXIS.BOTH] - specify on which axis to apply the shake effect (see {@link Camera2d.AXIS})
	 * @param [onComplete] - callback once shaking effect is over
	 * @param [force] - if true this will override the current effect
	 * @example
	 * // shake it baby !
	 * me.game.viewport.shake(10, 500, me.game.viewport.AXIS.BOTH);
	 */
	shake(
		intensity: number,
		duration: number,
		axis?: number,
		onComplete?: () => void,
		force?: boolean,
	): void {
		if (this._shake.duration === 0 || force === true) {
			this._shake.intensity = intensity;
			this._shake.duration = duration;
			this._shake.axis = axis || this.AXIS.BOTH;
			this._shake.onComplete =
				typeof onComplete === "function" ? onComplete : undefined;
		}
	}

	/**
	 * fadeOut(flash) effect<p>
	 * screen is filled with the specified color and slowly goes back to normal
	 * @param color - a CSS color value
	 * @param [duration=1000] - expressed in milliseconds
	 * @param [onComplete] - callback once effect is over
	 * @example
	 * // fade the camera to white upon dying, reload the level, and then fade out back
	 * me.game.viewport.fadeIn("#fff", 150, function() {
	 *     me.audio.play("die", false);
	 *     me.level.reload();
	 *     me.game.viewport.fadeOut("#fff", 150);
	 * });
	 */
	fadeOut(
		color: Color | string,
		duration: number = 1000,
		onComplete?: () => void,
	): void {
		this._fadeOut.color = colorPool.get(color);
		this._fadeOut.tween = tweenPool
			.get(this._fadeOut.color)
			.to({ alpha: 0.0 }, { duration });
		if (onComplete) {
			this._fadeOut.tween.onComplete(onComplete);
		}
		this._fadeOut.tween.isPersistent = true;
		this._fadeOut.tween.start();
	}

	/**
	 * fadeIn effect <p>
	 * fade to the specified color
	 * @param color - a CSS color value
	 * @param [duration=1000] - expressed in milliseconds
	 * @param [onComplete] - callback once effect is over
	 * @example
	 * // flash the camera to white for 75ms
	 * me.game.viewport.fadeIn("#FFFFFF", 75);
	 */
	fadeIn(
		color: Color | string,
		duration: number = 1000,
		onComplete?: () => void,
	): void {
		this._fadeIn.color = colorPool.get(color);
		const _alpha = this._fadeIn.color.alpha;
		this._fadeIn.color.alpha = 0.0;
		this._fadeIn.tween = tweenPool
			.get(this._fadeIn.color)
			.to({ alpha: _alpha }, { duration });
		if (onComplete) {
			this._fadeIn.tween.onComplete(onComplete);
		}
		this._fadeIn.tween.isPersistent = true;
		this._fadeIn.tween.start();
	}

	/**
	 * set the camera position around the specified object
	 * @param target - the renderable to focus the camera on
	 */
	focusOn(target: Renderable): void {
		const bounds = target.getBounds();
		this.moveTo(
			bounds.left + bounds.width / 2 - this.width / 2,
			bounds.top + bounds.height / 2 - this.height / 2,
		);
	}

	/**
	 * check if the specified renderable is in the camera
	 * @param obj - to be checked against
	 * @param [floating = obj.floating] - if visibility check should be done against screen coordinates
	 * @returns true if within the viewport
	 */
	isVisible(obj: Renderable, floating: boolean = obj.floating): boolean {
		if (floating || obj.floating) {
			// floating objects are checked against screen coordinates
			return renderer.overlaps(obj.getBounds());
		}
		// check against the visible world area (accounts for zoom)
		return obj.getBounds().overlaps(this.worldView);
	}

	/**
	 * convert the given "local" (screen) coordinates into world coordinates
	 * @param x - the x coordinate of the local point to be converted
	 * @param y - the y coordinate of the local point to be converted
	 * @param [v] - an optional vector object where to set the converted value
	 * @returns the converted world coordinates as a Vector2d
	 */
	localToWorld(x: number, y: number, v?: Vector2d): Vector2d {
		v = v || vector2dPool.get();
		v.set(x, y).add(this.pos).sub(game.world.pos);
		if (!this.currentTransform.isIdentity()) {
			this.invCurrentTransform.apply(v);
		}
		return v;
	}

	/**
	 * convert the given world coordinates into "local" (screen) coordinates
	 * @param x - the x world coordinate to be converted
	 * @param y - the y world coordinate to be converted
	 * @param [v] - an optional vector object where to set the converted value
	 * @returns a vector with the converted local coordinates
	 */
	worldToLocal(x: number, y: number, v?: Vector2d): Vector2d {
		v = v || vector2dPool.get();
		v.set(x, y);
		if (!this.currentTransform.isIdentity()) {
			this.currentTransform.apply(v);
		}
		return v.sub(this.pos).add(game.world.pos);
	}

	/**
	 * render the camera effects
	 * @ignore
	 */
	drawFX(renderer: Renderer): void {
		// cast to any to access canvas/webgl renderer-specific methods
		const r = renderer as any;
		// fading effect
		if (this._fadeIn.tween) {
			// add an overlay
			r.save();
			// reset all transform so that the overaly cover the whole camera area
			r.resetTransform();
			r.setColor(this._fadeIn.color!);
			r.fillRect(0, 0, this.width, this.height);
			r.restore();
			// remove the tween if over
			if (this._fadeIn.color!.alpha === 1.0) {
				this._fadeIn.tween = null;
				colorPool.release(this._fadeIn.color!);
				this._fadeIn.color = null;
			}
		}

		// flashing effect
		if (this._fadeOut.tween) {
			// add an overlay
			r.save();
			// reset all transform so that the overaly cover the whole camera area
			r.resetTransform();
			r.setColor(this._fadeOut.color!);
			r.fillRect(0, 0, this.width, this.height);
			r.restore();
			// remove the tween if over
			if (this._fadeOut.color!.alpha === 0.0) {
				this._fadeOut.tween = null;
				colorPool.release(this._fadeOut.color!);
				this._fadeOut.color = null;
			}
		}
	}

	/**
	 * draw all objects visible in this viewport
	 * @ignore
	 */
	override draw(renderer: Renderer, container: Container): void {
		// cast to any to access canvas/webgl renderer-specific methods not on base Renderer
		const r = renderer as any;
		const isNonDefault = !this.isDefault;
		// for non-default cameras, compensate for the world container's
		// centering offset (applied inside container.draw via renderer.translate)
		const containerOffsetX = isNonDefault ? container.pos.x : 0;
		const containerOffsetY = isNonDefault ? container.pos.y : 0;
		const translateX = this.pos.x + this.offset.x + containerOffsetX;
		const translateY = this.pos.y + this.offset.y + containerOffsetY;

		// translate the world coordinates by default to screen coordinates
		container.currentTransform.translate(-translateX, -translateY);

		this.preDraw(r);

		// clip to camera viewport on screen (after preDraw's save)
		r.clipRect(this.screenX, this.screenY, this.width, this.height);

		// set camera projection for non-default cameras
		if (isNonDefault) {
			const left = -this.screenX / this.zoom;
			const top = -this.screenY / this.zoom;
			const rw = renderer.width / this.zoom;
			const rh = renderer.height / this.zoom;

			// world-space projection (maps world coords to screen viewport)
			this.worldProjection.ortho(
				left,
				left + rw,
				top + rh,
				top,
				this.near,
				this.far,
			);
			renderer.setProjection(this.worldProjection);

			// screen-space projection for floating elements
			this.screenProjection.ortho(
				-this.screenX,
				-this.screenX + renderer.width,
				-this.screenY + renderer.height,
				-this.screenY,
				this.near,
				this.far,
			);
		} else {
			renderer.setProjection(this.projectionMatrix);
		}

		container.preDraw(r);

		// for non-default cameras, temporarily expand the camera rect to the
		// visible world area so TMXLayer draws all tiles within the zoomed view.
		// When zoom is 1, worldView matches camera size — no visible effect.
		if (isNonDefault) {
			const view = this.worldView;
			const savedWidth = this.width;
			const savedHeight = this.height;
			this.width = view.width;
			this.height = view.height;
			container.draw(r, this);
			this.width = savedWidth;
			this.height = savedHeight;
		} else {
			container.draw(r, this);
		}

		// draw the viewport/camera effects
		this.drawFX(renderer);

		container.postDraw(r);

		this.postDraw(r);

		// translate the world coordinates by default to screen coordinates
		container.currentTransform.translate(translateX, translateY);
	}
}
