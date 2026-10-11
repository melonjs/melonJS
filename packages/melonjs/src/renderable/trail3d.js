import Camera3d from "../camera/camera3d.ts";
import { colorPool } from "../math/color.ts";
import { lerpArray } from "../math/math.ts";
import { Vector3d } from "../math/vector3d.ts";
import { ribbonSides } from "../math/vertex.ts";
import { gradientFromOptions } from "../video/gradient.js";
import Mesh from "./mesh.js";

/**
 * additional import for TypeScript
 * @import {Color} from "../math/color.ts";
 * @import {Gradient} from "../video/gradient.js";
 * @import Renderable from "./renderable.js";
 * @import Renderer from "../video/renderer.js";
 */

/**
 * The world's up axis, which is -Y because render space is Y-down.
 * @ignore
 */
const WORLD_UP = { x: 0, y: -1, z: 0 };

/**
 * Said once per page, not once per trail: the message is about the scene's
 * setup, not about one ribbon, and a game that got this wrong has usually got
 * it wrong for every trail it owns.
 * @ignore
 */
let _warnedNo3dCameraOnce = false;

/** scratch, so a draw allocates nothing @ignore */
const _eye = { x: 0, y: 0, z: 0 };
const _facing = { x: 0, y: 0, z: 0 };
/** a Vector3d, because that is what `Camera3d#getRight` writes into */
const _fallback = new Vector3d(1, 0, 0);

/**
 * A fading, tapering ribbon that recedes properly into a 3D scene.
 *
 * The 3D sibling of {@link Trail}, and a separate class for the same reason
 * {@link Sprite3d} is separate from {@link Sprite}: the two draw through
 * different tiers. A `Trail` emits its ribbon as 2D paths, which carry one
 * depth for the whole renderable and a width measured in the screen plane, so
 * it cannot narrow along its own length or lie on a surface. This one builds
 * a real camera-facing strip and hands it to the mesh pipeline.
 *
 * It is a {@link Mesh}, so everything a mesh can do it can do: a post effect
 * reaches it, `tint` multiplies it, it sorts into the transparent pass, and
 * fog applies. It is also **cheaper to draw than a 2D trail** — one indexed
 * draw call rather than one filled path per segment.
 *
 * Needs a {@link Camera3d}. Under a 2D camera it draws nothing and says so
 * once, because the alternative is geometry projected twice.
 * @augments Mesh
 * @category Game Objects
 * @example
 * // an exhaust streak behind a craft
 * const exhaust = new Trail3d(0, 0, {
 *     target: ship,
 *     width: 6,
 *     lifetime: 260,
 *     gradient: ["#eaffff", "#2ea8ff", "#2ea8ff00"],
 * });
 * exhaust.blendMode = "additive";
 * app.world.addChild(exhaust);
 * @example
 * // a tyre mark lying in the ground plane: not camera-facing, so it keeps
 * // the orientation it is given
 * const skid = new Trail3d(0, 0, {
 *     target: car,
 *     width: 12,
 *     billboard: false,
 *     ribbonNormal: [0, -1, 0],   // world up
 *     color: "#1a1a1a",
 * });
 * @example
 * // manual mode, for a path the game computes itself
 * const arc = new Trail3d(0, 0, { width: 4, lifetime: 400 });
 * app.world.addChild(arc);
 * // each frame while the spell travels
 * arc.addPoint(bolt.pos.x, bolt.pos.y, bolt.pos.z);
 * @see {@link Trail} for the 2D one
 */
export default class Trail3d extends Mesh {
	/**
	 * @param {number} x - the ribbon's initial anchor, world units. Only seeds
	 * the cull bounds: once there are points, the anchor follows them.
	 * @param {number} y - as `x`
	 * @param {object} [settings] - trail options
	 * @param {Renderable|Vector3d} [settings.target] - auto-follow target
	 * @param {number} [settings.length=20] - max number of points. **Fixed at
	 * construction**: the geometry is sized once, so this cannot grow later,
	 * and assigning {@link Trail3d#maxPoints} throws. A fractional value is
	 * truncated.
	 * @param {number} [settings.lifetime=500] - point lifetime in ms
	 * @param {number} [settings.minDistance=4] - min world distance between samples
	 * @param {number} [settings.width=10] - max ribbon width in world units
	 * @param {number[]} [settings.widthCurve=[1, 0]] - width multiplier curve (0=head, 1=tail)
	 * @param {Color|string} [settings.color="#ffffff"] - single colour, faded out along the ribbon. Ignored if `gradient` is set.
	 * @param {(Color|string|{pos: number, color: Color|string})[]} [settings.gradient] - colour gradient. Overrides `color`.
	 * @param {boolean|string} [settings.billboard="spherical"] - `false` (use `ribbonNormal`), `true` / `"cylindrical"` (faces the camera but stays upright), or `"spherical"` (faces the camera on all axes)
	 * @param {Vector3d|number[]} [settings.ribbonNormal] - the facing used when `billboard` is `false`; defaults to world up
	 * @param {number} [settings.opacity=1.0] - opacity (0.0–1.0)
	 * @param {string} [settings.blendMode="normal"] - blend mode
	 * @param {boolean} [settings.depthTest=true] - whether the ribbon is depth tested
	 * @throws {Error} when `length` is not a finite number. Silence there is
	 * worse than it sounds: `NaN` sizes every buffer to zero and makes the
	 * capacity test always false, so the ribbon never renders and the point
	 * list grows without bound.
	 */
	constructor(x, y, settings = {}) {
		const requested = settings.length ?? 20;
		if (Number.isFinite(requested) === false) {
			// Loudly, to match the `maxPoints` setter below. `NaN` here sizes
			// every typed array to zero and makes the capacity test always
			// false, so the ribbon never renders and the point list grows
			// without bound: a silent, puzzling nothing.
			throw new Error(
				`Trail3d: \`length\` must be a finite number, got ${String(requested)}.`,
			);
		}
		// truncated, because a fractional count sizes the buffers and the
		// loops differently and the collapse writes past the end
		const length = Math.max(2, Math.trunc(requested));
		const vertexCount = length * 2;

		super(x, y, {
			// Sized ONCE, which is `Mesh`'s model and the reason `length` has
			// no setter: a subclass cannot re-run its own constructor, so
			// growing would mean reallocating the geometry in place,
			// including the `@internal` field the retained path uploads.
			vertices: new Float32Array(vertexCount * 3),
			uvs: new Float32Array(vertexCount * 2),
			indices: buildStripIndices(length),
			// white until the first draw writes the gradient into it
			vertexColors: new Uint32Array(vertexCount).fill(0xffffffff),
			// 1/1/1 with no normalize so `meshScale` is exactly 1 and the
			// declared size is taken at its word rather than measured from
			// geometry that is still empty. Both are overwritten per update
			// with the ribbon's real extent.
			width: 1,
			height: 1,
			scale: 1,
			normalize: false,
			// The bridge this class overrides is an identity, so winding is
			// preserved and the reversed index copy is not wanted.
			rightHanded: true,
			// a ribbon that twists should stay visible rather than punch a
			// hole in itself
			cullBackFaces: false,
			// NOT optional. `drawMesh` only queues into the transparent pass
			// when this is true or the draw alpha happens to be fractional,
			// and the opaque pass runs with blending OFF — so the per-vertex
			// alpha fade would render toward black instead of fading out.
			transparent: true,
			depthTest: settings.depthTest ?? true,
		});

		/**
		 * what the ribbon follows, sampled once per update
		 * @type {Renderable|Vector3d|null}
		 */
		this.target = settings.target ?? null;
		/** @type {number} */
		this.lifetime = settings.lifetime ?? 500;
		/** @type {number} */
		this.minDistance = settings.minDistance ?? 4;
		/** @type {number} */
		this.width = settings.width ?? 10;
		/** @type {number[]} */
		this.widthCurve =
			Array.isArray(settings.widthCurve) && settings.widthCurve.length > 0
				? settings.widthCurve
				: [1, 0];

		/**
		 * @ignore
		 * @internal
		 */
		this._maxPoints = length;
		/**
		 * The path, oldest first, as `{x, y, z, age}`.
		 *
		 * `z` is always present rather than optional, so the one loop that
		 * runs per point per frame sees a single hidden class.
		 * @ignore
		 * @internal
		 */
		this._points = [];
		/** @ignore @internal */
		this._gradient = gradientFromOptions(settings);
		/** @ignore @internal */
		this._segmentColor = colorPool.get();
		/** side vector per point, 3 floats each @ignore @internal */
		this._sides = new Float32Array(length * 3);
		/** @ignore @internal */
		this._ribbonNormal = new Vector3d(WORLD_UP.x, WORLD_UP.y, WORLD_UP.z);
		/**
		 * The ribbon's own extent, which is what its bounds are built from.
		 *
		 * Separate from `width`/`height` because on this class `width` is the
		 * RIBBON's width, as it is on {@link Trail} — a line thickness, not a
		 * box. Feeding that to the bounds would give a long streak a cull box
		 * a few units across, which is the defect `Trail` works around by
		 * refusing to be culled at all. Assigned last of the fields, so it
		 * gates the `updateBounds` override below.
		 * @ignore
		 * @internal
		 */
		this._extentW = 1;
		/** @ignore @internal */
		this._extentH = 1;

		this.billboard = settings.billboard ?? "spherical";
		if (settings.ribbonNormal !== undefined) {
			this.ribbonNormal = settings.ribbonNormal;
		}

		// Its vertices ARE world coordinates, so there is no bounds box for a
		// normalized anchor to be measured against. `Sprite3d` opts out the
		// same way and for the same reason.
		this._anchorBaked = true;
		// a ribbon is not a thing that stands on the ground
		this.castGroundShadow = false;
		this.alwaysUpdate = true;

		if (typeof settings.opacity === "number") {
			this.setOpacity(settings.opacity);
		}
		if (settings.blendMode) {
			this.blendMode = settings.blendMode;
		}
	}

	/**
	 * How many points the ribbon can hold.
	 *
	 * Read-only: see the note on `settings.length`. Assigning throws rather
	 * than silently doing nothing, because the alternative is a ribbon that
	 * quietly keeps its old capacity.
	 * @type {number}
	 */
	get maxPoints() {
		return this._maxPoints;
	}

	set maxPoints(_value) {
		throw new Error(
			"Trail3d: `length` is fixed at construction, because the geometry is sized once. Construct a new Trail3d for a different point count.",
		);
	}

	/**
	 * The facing used when {@link Trail3d#billboard} is `false`.
	 *
	 * Accepts a {@link Vector3d} or a `[x, y, z]` array and holds a normalized
	 * copy, so a caller that keeps mutating the array it passed is not
	 * steering this ribbon by accident. A zero-length value falls back to
	 * world up rather than dividing by it.
	 * @type {Vector3d}
	 * @default (0, -1, 0)
	 */
	get ribbonNormal() {
		return this._ribbonNormal;
	}

	set ribbonNormal(value) {
		const x = Array.isArray(value) ? value[0] : value.x;
		const y = Array.isArray(value) ? value[1] : value.y;
		const z = Array.isArray(value) ? value[2] : value.z;
		const len = Math.sqrt(x * x + y * y + z * z);
		if (len > 0) {
			this._ribbonNormal.set(x / len, y / len, z / len);
		} else {
			this._ribbonNormal.set(WORLD_UP.x, WORLD_UP.y, WORLD_UP.z);
		}
	}

	/**
	 * Recolour the ribbon with a single colour, faded out along its length.
	 *
	 * A method rather than a setter, matching {@link Renderable#setTint} and
	 * {@link Renderable#setOpacity}: it allocates a gradient, so it is for a
	 * change of state rather than for every frame. {@link Renderable#tint} is
	 * the per-frame lever, and unlike on {@link Trail} it works here, because
	 * the mesh batcher multiplies it in.
	 * @param {Color|string} value - the colour
	 * @returns {Trail3d} this, for chaining
	 */
	setColor(value) {
		// the outgoing one holds pooled `Color`s that only `destroy()`
		// returns, so replacing it without this leaks a set per call
		this._gradient?.destroy();
		this._gradient = gradientFromOptions({ color: value });
		return this;
	}

	/**
	 * Recolour the ribbon with a gradient, in the format the constructor takes.
	 * @param {(Color|string|{pos: number, color: Color|string})[]} value - the stops
	 * @returns {Trail3d} this, for chaining
	 */
	setGradient(value) {
		this._gradient?.destroy();
		this._gradient = gradientFromOptions({ gradient: value });
		return this;
	}

	/**
	 * The gradient the ribbon is currently coloured by.
	 * @type {Gradient}
	 * @see {@link Trail3d#setGradient}
	 */
	get gradient() {
		return this._gradient;
	}

	/**
	 * Add a point to the ribbon.
	 *
	 * Ignored when it is closer than {@link Trail3d#minDistance} to the last
	 * one, measured in three dimensions — which is what stops a ribbon flying
	 * straight at the camera from never sampling a second point.
	 * @param {number} x - x position, world units
	 * @param {number} y - y position, world units
	 * @param {number} [z=0] - z position, world units
	 */
	addPoint(x, y, z = 0) {
		const pts = this._points;
		if (pts.length > 0) {
			const last = pts[pts.length - 1];
			const dx = x - last.x;
			const dy = y - last.y;
			const dz = z - last.z;
			if (dx * dx + dy * dy + dz * dz < this.minDistance * this.minDistance) {
				return;
			}
		}
		pts.push({ x, y, z, age: 0 });
		if (pts.length > this._maxPoints) {
			pts.shift();
		}
	}

	/** drop every point, leaving the ribbon empty */
	clear() {
		this._points.length = 0;
	}

	/**
	 * @param {number} dt - elapsed time since the last update, in ms
	 * @returns {boolean} true if the ribbon needs redrawing
	 * @ignore
	 * @internal
	 */
	update(dt) {
		// truthiness, not `!== null`: `trail.target = undefined` is the
		// obvious way to stop following, and it is what the 2D one accepts
		if (this.target) {
			const pos = this.target.pos ?? this.target;
			// A 2D target has no `z`, and `addPoint`'s default parameter is
			// what turns that into a 0. It matters: an `undefined` stored in
			// the record would make the next distance test NaN and reject
			// every point after the first.
			this.addPoint(pos.x, pos.y, pos.z);
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

		this._updateAnchor();
		this.isDirty = pts.length > 1;
		super.update(dt);
		return this.isDirty;
	}

	/**
	 * Keep `pos` on the ribbon's own centroid, and the declared size on its
	 * extent.
	 *
	 * `pos` is a DERIVED cull and sort anchor here, not a placement: the
	 * geometry already carries world coordinates. Three things depend on it
	 * being honest. The frustum test is a sphere at the absolute position
	 * with the bounds' radius, so a ribbon pinned at the origin would be
	 * culled the moment the origin left the view. `sortOn: "depth"` compares
	 * `pos` against the camera. And `addChild(trail, z)` writes `pos.z` as a
	 * sort key, which would otherwise shift the whole ribbon by it — this
	 * overwrites that write on the next frame, harmlessly, because nothing
	 * here treats `pos` as a placement.
	 * @ignore
	 * @internal
	 */
	_updateAnchor() {
		const pts = this._points;
		const n = pts.length;
		if (n === 0) {
			return;
		}
		let minX = pts[0].x;
		let maxX = minX;
		let minY = pts[0].y;
		let maxY = minY;
		let minZ = pts[0].z;
		let maxZ = minZ;
		let sx = 0;
		let sy = 0;
		let sz = 0;
		for (let i = 0; i < n; i++) {
			const p = pts[i];
			sx += p.x;
			sy += p.y;
			sz += p.z;
			if (p.x < minX) {
				minX = p.x;
			}
			if (p.x > maxX) {
				maxX = p.x;
			}
			if (p.y < minY) {
				minY = p.y;
			}
			if (p.y > maxY) {
				maxY = p.y;
			}
			if (p.z < minZ) {
				minZ = p.z;
			}
			if (p.z > maxZ) {
				maxZ = p.z;
			}
		}
		// the ribbon spreads half its own width either side of the path, so
		// the extent has to allow for it or a wide streak is culled early
		const pad = this.width;
		// DEPTH counts, and folding it into the width is not a rounding
		// error. `Camera3d#isVisible` turns these two into one cull sphere
		// of radius `hypot(width, height) / 2` about the absolute position,
		// which carries z, and then tests all six frustum planes including
		// near and far. A ribbon running AWAY from the camera has almost no
		// x or y extent, so its sphere came out a few units across while its
		// centroid sat far behind the far plane: the whole thing popped out
		// of view while most of it was still on screen. That shape is the
		// one this class exists for, so the extent has to see it.
		// written BEFORE the move, because `setPosition` is what recomputes
		// the bounds and the override below reads these
		const spanZ = maxZ - minZ;
		this._extentW = Math.max(maxX - minX, spanZ) + pad;
		this._extentH = Math.max(maxY - minY, spanZ) + pad;
		// ONE call rather than three assignments: `setPosition` batches the
		// bounds recompute each of them would otherwise trigger.
		this.setPosition(sx / n, sy / n, sz / n);
	}

	/**
	 * Bounds built from the ribbon's own points rather than from its declared
	 * size.
	 *
	 * The base builds a frame from `width` x `height`, which on this class is
	 * the ribbon's THICKNESS and tells you nothing about where it has been.
	 * Since `pos` tracks the points' centroid and `Mesh` anchors at its
	 * centre, a frame of the path's extent centred there is the honest cull
	 * box — and an honest one is the whole reason this class does not need
	 * {@link Trail}'s "never cull me" escape hatch.
	 * @param {boolean} [absolute=true] - in world coordinates
	 * @returns {object} this renderable's bounding box
	 * @ignore
	 * @internal
	 */
	updateBounds(absolute = true) {
		// runs during `super()` too, before the fields exist
		if (this._extentW === undefined) {
			return super.updateBounds(absolute);
		}
		const bounds = this.getBounds();
		const w = this._extentW;
		const h = this._extentH;
		bounds.clear();
		bounds.addFrame(0, 0, w, h);
		bounds.translate(-w * 0.5, -h * 0.5);
		if (absolute === true) {
			const absPos = this.getAbsolutePosition();
			bounds.centerOn(
				absPos.x + bounds.x + bounds.width / 2,
				absPos.y + bounds.y + bounds.height / 2,
			);
		}
		return bounds;
	}

	/**
	 * Build the strip and hand it to the mesh pipeline.
	 * @param {Renderer} renderer - the current renderer
	 * @param {Camera3d} [viewport] - the camera being drawn through
	 * @ignore
	 * @internal
	 */
	draw(renderer, viewport) {
		const pts = this._points;
		const n = pts.length;
		if (n < 2) {
			return;
		}
		if (!(viewport instanceof Camera3d)) {
			// Refusing rather than falling through. `Mesh`'s 2D path applies
			// its own self-contained perspective, which on geometry that
			// already holds world coordinates projects them a second time and
			// draws nonsense. Nothing is better than nonsense, and one line
			// in the console is better than nothing.
			if (_warnedNo3dCameraOnce === false) {
				_warnedNo3dCameraOnce = true;
				console.warn(
					"melonJS: a Trail3d needs a Camera3d to draw — it builds a camera-facing strip in world space, which a 2D camera has no way to project. Use `Trail` for a 2D scene, or set the application's `cameraClass` to `Camera3d`.",
				);
			}
			return;
		}

		this._buildStrip(viewport);
		// what tells the retained path its geometry has moved on
		this.needsUpdate = true;
		super.draw(renderer, viewport);
	}

	/**
	 * Write the ribbon's vertices, uvs and colours.
	 * @param {Camera3d} viewport - the camera being drawn through
	 * @ignore
	 * @internal
	 */
	_buildStrip(viewport) {
		const pts = this._points;
		const n = pts.length;
		const verts = this.originalVertices;
		const uvs = this.uvs;
		const colors = this.vertexColors;
		const sides = this._sides;

		// The eye in world space, offset included so a camera shake does not
		// walk the ribbon's facing away from the view it is actually drawn
		// through.
		_eye.x = viewport.pos.x + viewport.offset.x;
		_eye.y = viewport.pos.y + viewport.offset.y;
		_eye.z = viewport.depth;

		const normal = this._resolveFacing();
		// vertex 0 has no previous side to carry, so something has to be
		// perpendicular to the view
		viewport.getRight(_fallback);
		ribbonSides(pts, n, sides, _eye, normal, _fallback);

		// relative to the derived anchor, which the placement overrides add
		// back; see `_updateAnchor`
		const ax = this.pos.x;
		const ay = this.pos.y;
		const az = this.depth;
		const invCount = 1 / (n - 1);
		const halfWidth = this.width * 0.5;
		const invLifetime = 1 / this.lifetime;

		for (let i = 0; i < n; i++) {
			const p = pts[i];
			// 0 at the head (newest), 1 at the tail — the same ratio `Trail`
			// uses, so the two agree about which end is which
			const t = 1 - i * invCount;
			const hw = lerpArray(this.widthCurve, t) * halfWidth;
			const s3 = i * 3;
			const sx = sides[s3] * hw;
			const sy = sides[s3 + 1] * hw;
			const sz = sides[s3 + 2] * hw;

			this._gradient.getColorAt(t, this._segmentColor);
			// `toUint32` takes the alpha as an ARGUMENT and defaults it to
			// 1.0 — it does not read the colour's own. Passing it is what
			// makes the age fade reach the vertex at all.
			const alpha = this._segmentColor.alpha * (1 - p.age * invLifetime);
			const packed = this._segmentColor.toUint32(alpha > 0 ? alpha : 0);

			writePair(
				verts,
				uvs,
				colors,
				i,
				p.x - ax - sx,
				p.y - ay - sy,
				p.z - az - sz,
				p.x - ax + sx,
				p.y - ay + sy,
				p.z - az + sz,
				t,
				packed,
			);
		}

		// COLLAPSE the unused tail onto the last live pair, so the surplus
		// quads are zero-area and fully transparent. That is how a varying
		// point count rides a buffer sized once: the geometry stays valid,
		// the bounding box stays the live ribbon's, and nothing has to touch
		// the index buffer the retained path uploads.
		const lastA = (n - 1) * 6;
		const lastB = lastA + 3;
		for (let i = n; i < this._maxPoints; i++) {
			writePair(
				verts,
				uvs,
				colors,
				i,
				verts[lastA],
				verts[lastA + 1],
				verts[lastA + 2],
				verts[lastB],
				verts[lastB + 1],
				verts[lastB + 2],
				1,
				0,
			);
		}
	}

	/**
	 * Which way the ribbon faces, given its billboard mode.
	 * Reads the module-scope `_eye`, which `_buildStrip` has already filled
	 * for this frame, rather than taking the camera again.
	 * @returns {object|null} a fixed facing, or null to face the eye per point
	 * @ignore
	 * @internal
	 */
	_resolveFacing() {
		const mode = this.billboard;
		if (mode === false || mode === "none") {
			return this._ribbonNormal;
		}
		if (mode !== "cylindrical" && mode !== true) {
			// Spherical, and everything unrecognised with it — which is what
			// `Sprite3d` does, so `billboard: "sphere"` cannot mean one thing
			// on a card and another on a ribbon. Per-point, so `ribbonSides`
			// derives the facing from the eye itself.
			return null;
		}
		// `true` / "cylindrical": faces the camera but stays upright, so the
		// facing is the view direction with its world-up component removed.
		// Same meaning the word carries on `Sprite3d`, where `true` is also
		// the cylindrical case rather than the spherical one.
		const dx = _eye.x - this.pos.x;
		const dy = _eye.y - this.pos.y;
		const dz = _eye.z - this.depth;
		const along = dx * WORLD_UP.x + dy * WORLD_UP.y + dz * WORLD_UP.z;
		const fx = dx - WORLD_UP.x * along;
		const fy = dy - WORLD_UP.y * along;
		const fz = dz - WORLD_UP.z * along;
		const len = Math.sqrt(fx * fx + fy * fy + fz * fz);
		if (len <= 0) {
			// the camera is directly along world up from the ribbon, so there
			// is no upright facing to speak of: fall through to spherical
			// rather than divide by zero
			return null;
		}
		_facing.x = fx / len;
		_facing.y = fy / len;
		_facing.z = fz / len;
		return _facing;
	}

	/**
	 * A ribbon's vertices are already world coordinates, so the standard mesh
	 * placement — a scale, the Y-up to Y-down bridge and the renderable's
	 * transform — would move them somewhere they do not belong. Only the
	 * derived anchor is added back.
	 * @param {number} offsetX - world x of the anchor
	 * @param {number} offsetY - world y of the anchor
	 * @param {number} offsetZ - world z of the anchor
	 * @ignore
	 * @internal
	 */
	_projectVerticesWorld(offsetX, offsetY, offsetZ) {
		const src = this.originalVertices;
		const out = this.vertices;
		for (let i = 0; i < this.vertexCount; i++) {
			const i3 = i * 3;
			out[i3] = src[i3] + offsetX;
			out[i3 + 1] = src[i3 + 1] + offsetY;
			out[i3 + 2] = src[i3 + 2] + offsetZ;
		}
	}

	/**
	 * The matrix form of {@link Trail3d#_projectVerticesWorld}: a translation
	 * by the derived anchor and nothing else. No scale, no axis bridge, no
	 * transform, because the geometry is already where it belongs.
	 * @returns {object} the model matrix (reused instance)
	 * @ignore
	 * @internal
	 */
	_composeModelMatrix() {
		const matrix = super._composeModelMatrix();
		const out = matrix.val;
		out[0] = 1;
		out[1] = 0;
		out[2] = 0;
		out[3] = 0;
		out[4] = 0;
		out[5] = 1;
		out[6] = 0;
		out[7] = 0;
		out[8] = 0;
		out[9] = 0;
		out[10] = 1;
		out[11] = 0;
		out[12] = this.pos.x;
		out[13] = this.pos.y;
		out[14] = this.depth;
		out[15] = 1;
		return matrix;
	}

	/**
	 * @ignore
	 * @internal
	 */
	destroy() {
		this._points.length = 0;
		// `Gradient#destroy` is the only path that hands its parsed stop
		// colours back to the pool, and the pool holds them by strong
		// reference. `Trail` does this too.
		this._gradient?.destroy();
		this._gradient = undefined;
		if (this._segmentColor !== undefined) {
			colorPool.release(this._segmentColor);
			this._segmentColor = undefined;
		}
		super.destroy();
	}
}

/**
 * The index buffer for a ribbon of `length` points, built once.
 *
 * Two triangles per quad, wound the same way round for every one so a single
 * front face holds along the strip.
 * @param {number} length - how many points the ribbon can hold
 * @returns {Uint16Array} the indices
 * @ignore
 */
function buildStripIndices(length) {
	// The largest index written is `2 * length - 1`, so a 16-bit buffer runs
	// out at 32768 points and wraps silently: triangles jump back to the head
	// of the ribbon. `Mesh` carries a 32-bit index buffer through rather than
	// coercing it, so widening here is all that is needed.
	const Indices = length * 2 > 65536 ? Uint32Array : Uint16Array;
	const out = new Indices((length - 1) * 6);
	for (let i = 0; i < length - 1; i++) {
		const v = i * 2;
		const o = i * 6;
		out[o] = v;
		out[o + 1] = v + 1;
		out[o + 2] = v + 3;
		out[o + 3] = v;
		out[o + 4] = v + 3;
		out[o + 5] = v + 2;
	}
	return out;
}

/**
 * Write one point's pair of vertices, with their uvs and colour.
 *
 * Pulled out so the live points and the collapsed tail cannot disagree about
 * the layout, which is the kind of thing that shows up as one stray triangle.
 * @param {Float32Array} verts - the vertex buffer
 * @param {Float32Array} uvs - the uv buffer
 * @param {Uint32Array} colors - the packed colour buffer
 * @param {number} i - the point's index
 * @param {number} ax - first vertex x
 * @param {number} ay - first vertex y
 * @param {number} az - first vertex z
 * @param {number} bx - second vertex x
 * @param {number} by - second vertex y
 * @param {number} bz - second vertex z
 * @param {number} u - the u coordinate shared by both
 * @param {number} packed - the packed RGBA8 colour shared by both
 * @ignore
 */
function writePair(verts, uvs, colors, i, ax, ay, az, bx, by, bz, u, packed) {
	const v3 = i * 6;
	verts[v3] = ax;
	verts[v3 + 1] = ay;
	verts[v3 + 2] = az;
	verts[v3 + 3] = bx;
	verts[v3 + 4] = by;
	verts[v3 + 5] = bz;

	const v2 = i * 4;
	uvs[v2] = u;
	// v increases downward, matching the engine's y-down texture convention
	uvs[v2 + 1] = 0;
	uvs[v2 + 2] = u;
	uvs[v2 + 3] = 1;

	const c = i * 2;
	colors[c] = packed;
	colors[c + 1] = packed;
}
