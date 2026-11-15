import { createMeshHit } from "../../geometries/ray3d.ts";
import {
	composeTRS,
	composeTRSInto,
	multiplyMatrixInto,
} from "../../loader/parsers/gltf.js";
import { vector3dPool } from "../../math/vector3d.ts";
import { parseAnimationOptions } from "../../renderable/animation.ts";
import Container from "../../renderable/container.js";
import { hasVerticalExtent } from "../../renderable/groundshadow.js";
import InstancedMesh from "../../renderable/instanced_mesh.js";
import Mesh from "../../renderable/mesh.js";
import { fillInstances } from "./GLTFScene.js";
import { sampleChannel, slerpQuat } from "./gltf_sampler.js";
import {
	computeJointMatrices,
	invertMatrixInto,
	skinVertices,
} from "./gltf_skin.js";

/**
 * additional import for TypeScript
 * @import { AnimationOptionsInput } from "../../renderable/animation.ts";
 * @import {Vector3d} from "../../math/vector3d.ts";
 * @import {Color} from "../../math/color.ts";
 * @import {Bounds} from "../../physics/bounds.ts";
 * @import Camera2d from "../../camera/camera2d.ts";
 * @import CanvasRenderer from "../../video/canvas/canvas_renderer.js";
 * @import WebGLRenderer from "../../video/webgl/webgl_renderer.js";
 * @import Renderer from "../../video/renderer.js";
 * @import { MeshHit, Ray3d } from "../../geometries/ray3d.ts";
 */

// column-major identity, the root's parent transform when the model sits
// unplaced at the world origin
const IDENTITY16 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// the model's own placement, expressed in glTF space, reused every frame
const _rootScratch = new Array(16);

/**
 * A part mesh's world position — its own `pos`, full stop.
 *
 * `_applyWorldToMesh` writes each part's FINAL world coordinates, so the
 * inherited implementation (which sums the ancestor chain) would add the
 * model's own placement a second time. That mis-measures nothing while the rig
 * sits at the origin, but as soon as it moves the frustum-culling sphere drifts
 * to twice the offset and the whole rig blinks out while still drawing in the
 * right place. Same reason {@link Particle} overrides this: a renderable
 * positioned in a frame other than its parent's cannot sum up the chain.
 * @returns {Vector3d} this part's absolute position
 * @ignore
 * @internal
 */
function partAbsolutePosition() {
	if (this._absPos === undefined) {
		this._absPos = vector3dPool.get();
	}
	return this._absPos.set(this.pos.x, this.pos.y, this.depth);
}

// per-frame scratch reused while composing one node's local matrix (DFS visits
// a node fully before recursing, and the local matrix is consumed by the
// world-matrix multiply before the next node is touched, so a single shared
// set is safe and keeps update() allocation-free per node)
const _t = [0, 0, 0];
const _r = [0, 0, 0, 1];
const _s = [1, 1, 1];
const _val = [0, 0, 0, 0];
const _localScratch = new Array(16);
// the crossfade's FROM pose for the node being composed, and the two
// quaternions packed for `slerpQuat`
const _ft = [0, 0, 0];
const _fr = [0, 0, 0, 1];
const _fs = [1, 1, 1];
const _qpair = [0, 0, 0, 1, 0, 0, 0, 1];
// the inverse of the model's placement, which skinned parts are expressed in
const _meshInverse = new Float64Array(16);
// nodes driven by nothing, the FROM side of a crossfade out of the rest pose
const NO_NODES = new Set();
// the per-part hit `intersectRay` tests into
const _partHit = createMeshHit();

/**
 * A rig-driven 3D model loaded from an animated glTF/GLB asset. Unlike a static
 * {@link GLTFScene} (which flattens each node into an independent {@link Mesh}),
 * a `GLTFModel` keeps the node **hierarchy** intact so a parent transform
 * carries its children — e.g. rotating a character's `torso` moves the attached
 * `arm` and `head`. Each frame, the active animation clip is sampled, world
 * matrices are propagated down the tree, and every part mesh's placement is
 * re-derived.
 *
 * The animation API mirrors {@link Sprite} for familiarity — `setCurrentAnimation`,
 * `isCurrentAnimation`, `getAnimationNames`, `play`/`pause`, `animationpause` —
 * but uses the cleaner options form everywhere: `setCurrentAnimation(name, {
 * loop, speed, onComplete, next })`. Here `animationspeed` is a **playback
 * multiplier** (1 = authored speed), not a per-frame delay.
 *
 * A **skinned** asset (a mesh bound to joints through `JOINTS_0` /
 * `WEIGHTS_0`, the format of Mixamo, Quaternius and most rigged character
 * packs) deforms with its joints: each posed frame the skinned parts are
 * deformed on the CPU from their bind pose, so they bend the same way on
 * WebGPU, WebGL and Canvas. Pass `crossfade` (milliseconds) to
 * `setCurrentAnimation` to blend into a clip rather than snap to it.
 *
 * The model is placed like any other renderable: `pos`, `depth` and the
 * transform helpers (`rotate`, `scale`) move the **whole rig**, and compose
 * with whatever the active clip is doing — so a walk cycle plays wherever the
 * character happens to stand.
 *
 * Instances are created automatically by {@link GLTFScene} when the asset
 * defines animation channels; you usually obtain one via `level.load(...)`
 * rather than constructing it directly.
 * @augments Container
 * @example
 * const boat = new me.GLTFModel(me.loader.getGLTF("boat"), { scale: 30, lit: true });
 * boat.setCurrentAnimation("paddle", { loop: true });
 * app.world.addChild(boat);
 *
 * // ...then drive it like anything else
 * boat.setPosition(steerX, waterLevel, travelled);
 * boat.rotate(lean - lastLean, AXIS_Z);
 *
 * // a skinned character: blend from walking into running over 250 ms
 * const fox = new me.GLTFModel(me.loader.getGLTF("fox"), { scale: 2, lit: true });
 * fox.setCurrentAnimation("Walk");
 * fox.setCurrentAnimation("Run", { crossfade: 250 });
 */
export default class GLTFModel extends Container {
	/**
	 * @param {import("../../loader/parsers/gltf.js").GLTFData} data - the parsed glTF descriptor, as returned by {@link loader.getGLTF}
	 * @param {object} [options]
	 * @param {number} [options.scale=1] - pixels per glTF unit (uniform scene scale)
	 * @param {boolean} [options.rightHanded=true] - glTF Y-up → engine Y-down via a rotation (no mirror)
	 * @param {boolean} [options.lit=false] - render the part meshes through the lit batcher
	 * @param {boolean} [options.castGroundShadow] - give the parts a ground shadow; omit to inherit the application setting
	 * @param {number} [options.shadowGroundY] - world Y of the floor those shadows land on
	 * @param {number} [options.shadowOpacity=0.45] - opacity of those shadows before any height fade
	 * @param {number} [options.shadowScale=1] - size multiplier for those shadows (see {@link Mesh#shadowScale})
	 * @param {number} [options.shadowOffset=0] - how far to slide them along their direction, in multiples of each blob's own radius; needs `shadowGroundY` (see {@link Mesh#shadowOffset}). `shadowGroundPoint` is deliberately not a scene option: one floor point shared by every part would stack their blobs on a single spot
	 * @param {number} [options.shadowStretch=1] - how much longer they are along that direction, clamped to 3
	 * @param {number} [options.shadowDirectionX=0] - x of the ground direction they are cast along
	 * @param {number} [options.shadowDirectionZ=0] - z of the ground direction they are cast along
	 * @param {number[]|Vector3d} [options.shadowGroundNormal] - the UP normal of the floor those shadows land on; needs `shadowGroundY` (see {@link Mesh#shadowGroundNormal})
	 * @param {Light3d} [options.shadowLight] - a {@link Light3d} to take that direction from instead
	 * @param {number} [options.toonBands=0] - cel-shade the lit parts into this many bands (see {@link Mesh#toonBands})
	 * @param {number} [options.outlineWidth=0] - outline every part this many world units wide (see {@link Mesh#outlineWidth})
	 * @param {Color|string|number[]} [options.outlineColor="#000000"] - the outline colour (see {@link Mesh#outlineColor})
	 */
	constructor(data, options = {}) {
		super(0, 0);

		/**
		 * pixels per glTF unit (uniform scene scale), as given by
		 * `options.scale`. Kept under its own name: stored as `this.scale` it
		 * shadowed the inherited {@link Renderable#scale} method, so
		 * `model.scale(2)` threw instead of growing the rig.
		 * @type {number}
		 * @ignore
		 * @internal
		 */
		this._sceneScale = options.scale ?? 1;
		// right-handed (glTF) → negate Z as well as Y so the Y-up→Y-down bridge
		// is a rotation, matching Mesh#rightHanded / GLTFScene
		/**
		 * @ignore
		 * @internal
		 */
		this._zSign = options.rightHanded !== false ? -1 : 1;

		// scene meshes carry their own world transform; the GPU depth test
		// resolves occlusion, so don't let the container reassign child depth
		this.autoDepth = false;

		// The rig's placement reaches the part meshes through `_rootMatrix`,
		// which bakes it into each part's own world position. The renderer must
		// therefore NOT apply it a second time: `Container.draw` translates by
		// `pos`, and `preDraw` folds `currentTransform` in, both of which land
		// on top of geometry that already carries the placement. Left alone
		// that doubles every move and every turn — a boat steering to x = -400
		// draws as though it were at -800, off the side of the view, while its
		// reported position stays perfectly correct.
		this.autoTransform = false;

		// This container is a logical group sitting at the world origin — its
		// child meshes carry absolute world placement themselves. It has no
		// meaningful anchor box, and its width/height are Infinity (the Container
		// default), so the base `preDraw` anchor offset `width * anchorPoint`
		// would be `Infinity * 0 = NaN` and NaN-poison the renderer transform,
		// silently dropping every child mesh. Opt out of the anchor offset
		// entirely (same mechanism Mesh uses on the Camera3d world path).
		this.applyAnchorTransform = false;

		// ...but a model still has to report WHERE IT IS. Those Infinity
		// dimensions also mean `Container#updateBounds` takes neither of its
		// branches, so `getBounds()` returns the EMPTY bounds it was
		// initialised with (min `+Infinity`, max `-Infinity`) — a model that
		// claims to be nowhere. Anything reading bounds is then wrong about it,
		// and the physics broadphase, which files every item by `getBounds()`,
		// could not place one: a model carrying a `Body` was sorted by that
		// infinite rect into a node unrelated to where it stood and silently
		// collided with nothing.
		//
		// A model's size is known at load — the glTF scene AABB — so it is
		// measured once here and placed by `updateBounds`, costing nothing per
		// frame. Aggregating the parts instead (`enableChildBoundsUpdate`)
		// would walk the whole rig on every bounds update; that flag is for a
		// group whose extent genuinely IS its members' union and changes as
		// they move, like a flock or a squad, which a rig is not.

		/**
		 * the node hierarchy keyed by glTF node index
		 * @ignore
		 * @internal
		 */
		this._nodes = data.graph.nodes;
		/**
		 * root node indices
		 * @ignore
		 * @internal
		 */
		this._roots = data.graph.roots;
		/**
		 * glTF node index → its part Mesh instances (one per primitive)
		 * @ignore
		 * @internal
		 */
		this._meshByNode = {};
		/**
		 * glTF node index → cached rest (bind-pose) local matrix
		 * @ignore
		 * @internal
		 */
		this._restMatrix = {};
		/**
		 * glTF node index → its world matrix, a persistent 16-element buffer
		 * recomputed in place every pose (a child reads its parent's buffer
		 * during the DFS, so each node needs its own). Preallocated here so the
		 * per-frame pose path allocates nothing.
		 * @ignore
		 * @internal
		 */
		this._world = {};

		// a generous per-part cull radius taken from the whole scene's bounds so
		// the model culls as a unit (a limb never pops out while the body is on
		// screen). Camera3d derives the cull sphere as √(w²+h²)/2, so a square
		// box of side `radius·√2` yields a sphere of exactly `radius`.
		const b = data.bounds;
		const dx = b.max[0] - b.min[0];
		const dy = b.max[1] - b.min[1];
		const dz = b.max[2] - b.min[2];
		const radius = (Math.hypot(dx, dy, dz) / 2) * this._sceneScale;
		const boxSize = Math.max(radius, 1) * Math.SQRT2;
		// A skinned part is placed at the model's own origin (its joints, not
		// its node, say where it is), so its cull sphere is centred there and
		// must reach the farthest corner of the rig — with headroom, since an
		// animated pose can reach past the rest pose it was measured in.
		const reach =
			Math.hypot(
				Math.max(Math.abs(b.min[0]), Math.abs(b.max[0])),
				Math.max(Math.abs(b.min[1]), Math.abs(b.max[1])),
				Math.max(Math.abs(b.min[2]), Math.abs(b.max[2])),
			) *
			1.5 *
			this._sceneScale;
		const skinnedBoxSize = Math.max(reach, 1) * Math.SQRT2;

		/**
		 * The rig's own 2D extent, as a half-size and a centre offset from
		 * `pos`, in RENDER space — so `updateBounds` is a placement rather than
		 * a measurement. A sphere's square rather than the AABB's XY face, so
		 * that a turned model still reports a box that contains it: bounds may
		 * be generous without harm (it costs broadphase pruning), but must
		 * never be tight enough to miss.
		 *
		 * The centre is the AABB's, NOT the origin: a model authored standing
		 * on the ground has its origin at the feet.
		 * @ignore
		 * @internal
		 */
		this._extent = Math.max(radius, 1);
		/**
		 * @ignore
		 * @internal
		 */
		this._extentX = ((b.min[0] + b.max[0]) / 2) * this._sceneScale;
		// render space is Y-DOWN and the model is bridged from glTF's Y-up
		/**
		 * @ignore
		 * @internal
		 */
		this._extentY = -((b.min[1] + b.max[1]) / 2) * this._sceneScale;

		/**
		 * the skinned parts, each deformed from its bind pose on every pose
		 * that moves its joints
		 * @ignore
		 * @internal
		 */
		this._skinned = [];
		const skins = data.skins ?? [];

		const lit = options.lit === true;
		const rightHanded = options.rightHanded !== false;
		// tri-state: `undefined` falls through to the application setting
		const castGroundShadow =
			typeof options.castGroundShadow === "boolean"
				? options.castGroundShadow
				: undefined;

		// build the rest matrices + instantiate a Mesh per mesh-node primitive
		for (const idx in this._nodes) {
			const node = this._nodes[idx];
			this._restMatrix[idx] = node.matrix
				? node.matrix
				: composeTRS(node.translation, node.rotation, node.scale);
			// persistent per-node world-matrix buffer (recomputed in place each pose)
			this._world[idx] = new Array(16);

			for (const prim of node.primitives) {
				// an instanced node inside an ANIMATED asset still instances:
				// the node's own TRS is animated, the records place the copies
				// within it
				const MeshClass = prim.instances ? InstancedMesh : Mesh;
				// a skinned primitive is deformed in place every pose, so the
				// mesh gets its own copy of the geometry: the descriptor's
				// arrays stay the bind pose, shared by every model built from it
				const skin =
					prim.instances === undefined &&
					prim.joints !== undefined &&
					prim.weights !== undefined
						? skins[prim.skin ?? node.skin]
						: undefined;
				const mesh = new MeshClass(0, 0, {
					vertices: skin !== undefined ? prim.vertices.slice() : prim.vertices,
					uvs: prim.uvs,
					indices: prim.indices,
					normals:
						skin !== undefined && prim.normals !== undefined
							? prim.normals.slice()
							: prim.normals,
					texture: prim.image,
					width: skin !== undefined ? skinnedBoxSize : boxSize,
					height: skin !== undefined ? skinnedBoxSize : boxSize,
					scale: this._sceneScale,
					normalize: false,
					rightHanded,
					// KHR_materials_unlit materials skip the lit path even in a lit scene
					lit: lit && prim.unlit !== true,
					// honor the glTF sampler wrap (default REPEAT) — many exporters
					// author UVs outside [0,1] that tile; clamping flattens them
					textureRepeat: prim.textureRepeat,
					// honor the glTF sampler magnification filter (nearest = pixel-art)
					textureFilter: prim.textureFilter,
					// alpha cutout threshold (glTF alphaMode MASK)
					alphaCutoff: prim.alphaCutoff,
					// emissive color (glTF emissiveFactor) — self-illumination
					emissive: prim.emissive,
					// specular highlight approximated from the material's
					// metallic/roughness factors (#1575)
					specular: prim.specular,
					shininess: prim.shininess,
					// thin/flat double-sided parts must not be back-face culled
					cullBackFaces: prim.doubleSided !== true,
					// ground shadows (#1515), same scene-wide rule as the static
					// path: a blanket opt-in skips parts with no vertical extent
					castGroundShadow:
						castGroundShadow === true
							? hasVerticalExtent(prim.vertices, prim.vertexCount)
							: castGroundShadow,
					shadowGroundY: options.shadowGroundY,
					// the rest of the shadow controls, which did not reach a
					// glTF model at all before: a wide flat-bottomed prop is
					// exactly the case they exist for, and a prop is usually
					// loaded rather than built
					shadowOpacity: options.shadowOpacity,
					shadowScale: options.shadowScale,
					shadowOffset: options.shadowOffset,
					shadowStretch: options.shadowStretch,
					shadowDirectionX: options.shadowDirectionX,
					shadowDirectionZ: options.shadowDirectionZ,
					shadowGroundNormal: options.shadowGroundNormal,
					shadowLight: options.shadowLight,
					baseColorFactor: prim.baseColorFactor,
					toonBands: options.toonBands,
					outlineWidth: options.outlineWidth,
					outlineColor: options.outlineColor,
				});
				if (prim.instances) {
					fillInstances(mesh, prim.instances);
				}
				if (prim.colors) {
					mesh.vertexColors = prim.colors;
				}
				if (skin !== undefined) {
					this._skinned.push({
						mesh,
						skin,
						bindVertices: prim.vertices,
						// a hand-built descriptor may carry no normals, in
						// which case a lit mesh generated its own: those are the
						// bind-pose normals to deform
						bindNormals:
							prim.normals ??
							(mesh.originalNormals !== undefined
								? mesh.originalNormals.slice()
								: undefined),
						joints: prim.joints,
						weights: prim.weights,
						jointMatrices: new Float32Array(skin.joints.length * 16),
					});
				}
				mesh.name = node.name;
				mesh.getAbsolutePosition = partAbsolutePosition;
				// a skinned part is placed by `_skin()` instead, at the model's
				// origin: the spec has a skinned mesh ignore its node's transform
				if (skin === undefined) {
					(this._meshByNode[idx] ??= []).push(mesh);
				}
				this.addChild(mesh);
			}
		}

		// index the animation clips, pre-grouping each clip's channels by the
		// node they target (so sampling a node is a single map lookup)
		/**
		 * name → clip `{ name, duration, channelsByNode, animatedNodes }`
		 * @ignore
		 * @internal
		 */
		this.anim = {};
		for (const clip of data.animations ?? []) {
			const channelsByNode = new Map();
			for (const ch of clip.channels) {
				if (!channelsByNode.has(ch.node)) {
					channelsByNode.set(ch.node, []);
				}
				channelsByNode.get(ch.node).push(ch);
			}
			this.anim[clip.name] = {
				name: clip.name,
				duration: clip.duration,
				channelsByNode,
				animatedNodes: new Set(channelsByNode.keys()),
			};
		}

		/**
		 * playback multiplier for the current animation (1 = authored speed).
		 * @type {number}
		 * @default 1
		 */
		this.animationspeed = 1;

		/**
		 * pause/resume the current animation without losing its pose or time.
		 * @type {boolean}
		 * @default false
		 */
		this.animationpause = false;

		/**
		 * a callback fired each time the current animation completes a cycle.
		 * @type {Function}
		 * @default undefined
		 */
		// this.onended;

		// current animation state
		/**
		 * @ignore
		 * @internal
		 */
		this.current = { name: undefined, time: 0, length: 0 };
		/**
		 * loop-completion callback (built from the options)
		 * @ignore
		 * @internal
		 */
		this.resetAnim = undefined;
		/**
		 * set when a `loop:false` clip has finished its single cycle
		 * @ignore
		 * @internal
		 */
		this._animDone = false;

		/**
		 * The crossfade in progress, or null. `clip` / `time` / `speed` / `done`
		 * describe the clip being faded OUT, which keeps playing underneath;
		 * `pose` instead holds a frozen per-node TRS when a crossfade was
		 * interrupted by another, so the blend starts from what was on screen.
		 * `nodes` are the nodes the FROM side drives.
		 * @ignore
		 * @internal
		 */
		this._fade = null;

		/**
		 * Whether the current clip plays once (`loop: false`, or chained to
		 * another with `next`) rather than looping: faded out, it then holds
		 * its last frame instead of starting over under the blend.
		 * @ignore
		 * @internal
		 */
		this._animOnce = false;

		/**
		 * a world-matrix lookup handed to the skinning helpers
		 * @ignore
		 * @internal
		 */
		this._worldOf = (j) => {
			return this._world[j];
		};

		/**
		 * The placement the rig was last posed with: `pos.x`, `pos.y`, `pos.z`
		 * then the 16 entries of `currentTransform`. `update()` compares the
		 * live placement against it, so a model whose clip is not advancing
		 * (never played, paused, finished, stopped, zero length) still follows
		 * a move, a turn or a resize, and a still one is not re-posed.
		 * @ignore
		 * @internal
		 */
		this._posedPlacement = new Float64Array(19);

		// pose to the bind/rest pose so the model is correctly assembled even
		// before any clip plays
		this._pose();
	}

	/**
	 * the names of every animation clip defined by the source asset.
	 * @returns {string[]}
	 * @example
	 * model.getAnimationNames(); // ["idle", "walk", "sprint", ...]
	 */
	getAnimationNames() {
		return Object.keys(this.anim);
	}

	/**
	 * return true if `name` is the currently playing animation.
	 * @param {string} name - animation clip id
	 * @returns {boolean}
	 */
	isCurrentAnimation(name) {
		return this.current.name === name;
	}

	/**
	 * play the given animation clip. The second argument mirrors {@link Sprite}
	 * and accepts the same forms: omit to loop forever, a `string` to chain to
	 * another clip when this one ends, a `function` legacy completion callback
	 * (return `false` to hold the final pose), or an options object.
	 *
	 * `crossfade` (in milliseconds, options form only) blends into the clip
	 * instead of snapping to it: the previous clip keeps playing underneath
	 * while its weight falls to 0, so a walk turns into a run without a pop.
	 * With no clip playing, the blend starts from the rest pose. A clip chained
	 * with `next` is entered with the same crossfade.
	 * @param {string} name - animation clip id (see {@link GLTFModel#getAnimationNames})
	 * @param {AnimationOptionsInput} [options] - loop / chain / completion behavior
	 * @param {boolean} [preserveTime=false] - keep the current playback time instead of restarting at 0
	 * @returns {GLTFModel} this, for chaining
	 * @example
	 * model.setCurrentAnimation("walk");                       // loop forever
	 * model.setCurrentAnimation("die", { loop: false });       // play once, hold last pose
	 * model.setCurrentAnimation("jump", { next: "idle" });     // jump, then idle
	 * model.setCurrentAnimation("walk", { speed: 2 });         // twice as fast
	 * model.setCurrentAnimation("emote-yes", () => spawnFx()); // legacy callback
	 * model.setCurrentAnimation("run", { crossfade: 250 });     // blend in over 250 ms
	 */
	setCurrentAnimation(name, options, preserveTime = false) {
		if (this.anim[name] === undefined) {
			throw new Error("animation id '" + name + "' not defined");
		}
		if (this.isCurrentAnimation(name)) {
			return this;
		}
		const opts = parseAnimationOptions(options);
		// capture what is being faded out BEFORE the current clip changes
		const crossfade = opts.crossfade;
		this._fade =
			typeof crossfade === "number" && crossfade > 0
				? this._beginFade(crossfade)
				: null;
		this.current.name = name;
		this.current.length = this.anim[name].duration;
		this.animationspeed = opts.speed;
		this._animDone = false;
		// a legacy callback decides at the end whether to loop: as before,
		// such a clip loops while it is faded out
		this._animOnce =
			!opts.legacyFn && (typeof opts.next === "string" || opts.loop === false);
		const onComplete = opts.onComplete;
		if (opts.legacyFn) {
			// legacy bare-function callback (return false → hold the last pose)
			this.resetAnim = onComplete;
		} else if (typeof opts.next === "string") {
			const next = opts.next;
			this.resetAnim = () => {
				if (typeof onComplete === "function") {
					onComplete();
					// re-entering the engine below, still inside this call, so
					// the guard in `update()` (which runs after `resetAnim`
					// RETURNS) would be too late for a destroyed host
					if (!this._isLive()) {
						return false;
					}
				}
				this.setCurrentAnimation(
					next,
					crossfade !== undefined ? { crossfade } : undefined,
				);
			};
		} else if (opts.loop === false) {
			// play once: fire onComplete, hold the final pose
			this.resetAnim = () => {
				if (typeof onComplete === "function") {
					onComplete();
					// see the chain wrapper above
					if (!this._isLive()) {
						return false;
					}
				}
				this._animDone = true;
				return false;
			};
		} else if (typeof onComplete === "function") {
			this.resetAnim = () => {
				onComplete();
			};
		} else {
			this.resetAnim = undefined;
		}
		if (!preserveTime) {
			this.current.time = 0;
		}
		this._pose();
		this.isDirty = true;
		return this;
	}

	/**
	 * Play an animation clip, or resume the current one. A shorthand for
	 * {@link GLTFModel#setCurrentAnimation}: call with a clip name to switch to
	 * (and start) it, or with no argument to resume after {@link GLTFModel#pause}.
	 * Always clears the paused state.
	 * @param {string} [name] - clip id to play; omit to just resume
	 * @param {AnimationOptionsInput} [options] - loop / chain / completion behavior (see {@link GLTFModel#setCurrentAnimation})
	 * @returns {GLTFModel} this, for chaining
	 * @example
	 * model.play("walk");                  // switch to + play "walk"
	 * model.play("die", { loop: false });  // play once, hold the last pose
	 * model.pause();
	 * model.play();                        // resume
	 */
	play(name, options) {
		this.animationpause = false;
		if (name !== undefined) {
			this.setCurrentAnimation(name, options);
		}
		return this;
	}

	/**
	 * Pause the current animation, freezing it at its current pose. Resume with
	 * {@link GLTFModel#play}.
	 * @returns {GLTFModel} this, for chaining
	 */
	pause() {
		this.animationpause = true;
		return this;
	}

	/**
	 * Stop playback and reset the rig to its bind/rest pose (no clip active).
	 * After this {@link GLTFModel#isCurrentAnimation} is false for every clip;
	 * call {@link GLTFModel#play} to start again. (Use {@link GLTFModel#pause}
	 * instead to freeze in place.)
	 * @returns {GLTFModel} this, for chaining
	 */
	stop() {
		this.current.name = undefined;
		this.current.time = 0;
		this.current.length = 0;
		this.resetAnim = undefined;
		this._animDone = false;
		this._animOnce = false;
		this._fade = null;
		this.animationpause = false;
		// re-pose with no active clip → every node falls back to its rest matrix
		this._pose();
		this.isDirty = true;
		return this;
	}

	/**
	 * Advance the active clip and re-pose the rig. With no clip advancing
	 * (none set, paused, finished or of zero length) the rig is re-posed only
	 * when the model was moved, turned or resized since its last pose.
	 * @param {number} dt - elapsed time since the last update, in milliseconds
	 * @returns {boolean} true if the model (or any child) needs redrawing
	 * @protected
	 */
	update(dt) {
		// a crossfade keeps posing even under a finished or zero-length clip:
		// its FROM side is still moving and its weight still changing
		const fading = this._fade !== null && !this.animationpause;
		if (fading) {
			this._advanceFade(dt);
		}
		if (
			this.current.name !== undefined &&
			!this.animationpause &&
			!this._animDone &&
			this.current.length > 0
		) {
			const duration = this.current.length;
			// glTF keyframe times are in seconds; dt is in milliseconds
			this.current.time += (dt / 1000) * this.animationspeed;
			if (this.current.time >= duration) {
				if (typeof this.onended === "function") {
					this.onended();
					// the handler may have removed this model
					if (!this._isLive()) {
						return super.update(dt);
					}
				}
				if (typeof this.resetAnim === "function") {
					if (this.resetAnim() === false) {
						// hold the final pose
						this.current.time = duration;
					} else if (this.current.time >= duration) {
						// default loop / loop-with-callback: wrap the overflow
						// (guarded — a chain may already have reset the time)
						this.current.time %= duration;
					}
				} else {
					this.current.time %= duration;
				}
			}
			// `resetAnim` above is user code too, and `_pose()` writes into the
			// part meshes it may have destroyed
			if (!this._isLive()) {
				return super.update(dt);
			}
			this._pose();
			this.isDirty = true;
		} else if (fading && this._isLive()) {
			this._pose();
			this.isDirty = true;
		} else if (this._isLive() && this._placementChanged()) {
			// no clip is advancing, but the model itself was moved, turned or
			// resized: the placement only reaches the parts through `_pose()`,
			// so re-pose at the clip's current time, which leaves a paused or
			// finished clip exactly where it is. The joints did not move
			// relative to the skinned parts, so their deformation stands.
			this._pose(false);
			this.isDirty = true;
		}
		return super.update(dt);
	}

	/**
	 * Whether the model's placement differs from the one the rig was last
	 * posed with (see `_posedPlacement`).
	 * @returns {boolean} true if `pos` or `currentTransform` changed
	 * @ignore
	 * @internal
	 */
	_placementChanged() {
		const p = this._posedPlacement;
		const pos = this.pos;
		if (p[0] !== pos.x || p[1] !== pos.y || p[2] !== pos.z) {
			return true;
		}
		const t = this.currentTransform.val;
		for (let i = 0; i < 16; i++) {
			if (p[i + 3] !== t[i]) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Sample the active clip (if any) and propagate world transforms down the
	 * node tree, writing each part mesh's placement. Nodes the current clip does
	 * not animate use their cached rest matrix.
	 * @ignore
	 * @internal
	 */
	/**
	 * Whether this model is still alive.
	 *
	 * `update()` hands control to user code — `onended`, and the completion
	 * callback behind `resetAnim` — and then poses the hierarchy. A callback
	 * that removed the model (a death animation removing its own model is the
	 * obvious case) has had `Renderable.destroy()` run, which releases `pos` to
	 * the pool and leaves it undefined on every part. `_pose()` writes
	 * `mesh.pos`, so it must not run on a torn-down model.
	 *
	 * `pos` and not `ancestor`: a model that was never added to a container is
	 * perfectly poseable, and several callers do exactly that.
	 * @ignore
	 * @internal
	 * @returns {boolean} true while the model can still be posed
	 */
	_isLive() {
		return this.pos !== undefined;
	}

	/**
	 * Where a world-space ray first meets this model: the nearest hit among
	 * its parts, tested against their triangles in the pose they were last
	 * given (see {@link Mesh#intersectRay}). The hit's `renderable` is the
	 * part, so `hit.renderable.name` is the glTF node that was hit — a
	 * character's head rather than its body.
	 *
	 * What a pointer event registered on the model hit-tests under a
	 * {@link Camera3d}, and what {@link Camera3d#pick} asks the model.
	 * @param {Ray3d} ray - the ray, in world space (see {@link Camera3d#screenToRay})
	 * @param {MeshHit} [out] - hit record to write into; a new one is allocated when omitted
	 * @returns {MeshHit|null} the nearest hit, or `null` when the ray misses every part
	 * @example
	 * input.registerPointerEvent("pointerdown", hero, (pointer) => {
	 *     console.log("clicked the", pointer.hit3d.renderable.name);
	 * });
	 */
	intersectRay(ray, out) {
		let best = null;
		for (const child of this.getChildren()) {
			if (typeof child.intersectRay !== "function") {
				continue;
			}
			const hit = child.intersectRay(ray, _partHit);
			if (hit !== null && (best === null || hit.distance < best.distance)) {
				best = best ?? out ?? createMeshHit();
				best.renderable = hit.renderable;
				best.point.copy(hit.point);
				best.normal.copy(hit.normal);
				best.distance = hit.distance;
				best.triangle = hit.triangle;
				best.instance = hit.instance;
			}
		}
		return best;
	}

	/**
	 * {@link Container#draw} translates the renderer by `pos` so children draw
	 * in container-local space. This rig's children are already in world space,
	 * so that translation is undone here rather than doubling the placement.
	 * Paired with `autoTransform = false`, which suppresses the matching
	 * rotation fold.
	 * @param {Renderer} renderer - a renderer instance
	 * @param {Camera2d} [viewport] - the camera rendering this frame
	 */
	draw(renderer, viewport) {
		renderer.translate(-this.pos.x, -this.pos.y);
		super.draw(renderer, viewport);
	}

	/**
	 * Under a perspective camera {@link Container#draw} also moves its
	 * children by the container's depth. The parts already carry this
	 * model's depth (see `_rootMatrix`), so for the same reason as the x/y
	 * cancelled in {@link GLTFModel#draw}, it must not be applied again.
	 * @returns {number} always 0
	 * @ignore
	 * @internal
	 */
	_drawDepth() {
		return 0;
	}

	/**
	 * Where this model is, as a 2D box — what culling, picking and the physics
	 * broadphase all read.
	 *
	 * A `Container` has no dimensions of its own, and one left that way reports
	 * an EMPTY bounds: a model claiming to be nowhere, which the broadphase
	 * cannot place. A rig's size is known at load from the glTF scene AABB, so
	 * this is a placement of a measurement taken once in the constructor rather
	 * than a walk of the parts — `Container#updateBounds` with
	 * `enableChildBoundsUpdate` would re-measure the whole rig on every call,
	 * and that flag is for a group whose extent really is its members' union.
	 *
	 * The box is the model's bounding SPHERE squared off, so a turned model
	 * still reports something that contains it. Generous bounds only cost
	 * broadphase pruning; tight ones lose contacts.
	 * @param {boolean} [absolute=true] - in world rather than local coordinates
	 * @returns {Bounds} this model's bounding box
	 */
	updateBounds(absolute = true) {
		const bounds = this.getBounds();
		// `scale()` grows the rig through `currentTransform`, so the measured
		// extent grows with it: the radius by the longest of the three axes,
		// which keeps the box containing a non-uniformly scaled model, and the
		// centre offset along each axis by that axis's own length. A pure
		// rotation leaves every axis at length 1, so a turned model reports
		// exactly what it did before.
		let e = this._extent;
		let cx = this._extentX;
		let cy = this._extentY;
		// (the base constructor measures before `currentTransform` exists)
		const m = this.currentTransform;
		if (m !== undefined && !m.isIdentity()) {
			const t = m.val;
			const sx = Math.hypot(t[0], t[1], t[2]);
			const sy = Math.hypot(t[4], t[5], t[6]);
			const sz = Math.hypot(t[8], t[9], t[10]);
			e *= Math.max(sx, sy, sz);
			cx *= sx;
			cy *= sy;
		}
		bounds.setMinMax(cx - e, cy - e, cx + e, cy + e);
		if (absolute === true) {
			const absPos = this.getAbsolutePosition();
			bounds.translate(absPos.x, absPos.y);
		}
		return bounds;
	}

	/**
	 * @ignore
	 * @internal
	 */
	_pose(reskin = true) {
		const clip = this.current.name ? this.anim[this.current.name] : null;
		const t = this.current.time;
		const parent = this._rootMatrix();
		for (const root of this._roots) {
			this._visit(root, parent, clip, t);
		}
		// every joint has its world matrix now, so the skinned parts can
		// follow them
		this._skin(parent, reskin);
		// remember the placement this pose was built from
		const p = this._posedPlacement;
		p[0] = this.pos.x;
		p[1] = this.pos.y;
		p[2] = this.pos.z;
		p.set(this.currentTransform.val, 3);
	}

	/**
	 * The model's own placement, as the parent transform every root node hangs
	 * from — so `pos`, `depth` and `currentTransform` move, turn and scale the
	 * whole rig the way they do for any other renderable.
	 *
	 * It has to be handed to the DFS in **glTF space**, because that is where
	 * the node matrices live and `_applyWorldToMesh` only bridges to engine
	 * space afterwards. The bridge is `D = diag(1, -1, zSign)` and a uniform
	 * `scale`, so the inverse trip is a division by `scale` for the translation
	 * and a conjugation `D · R · D` for the rotation/scale — `D` is its own
	 * inverse, which is what makes the conjugation this cheap.
	 * @returns {number[]} 16-element column-major matrix
	 * @ignore
	 * @internal
	 */
	_rootMatrix() {
		const { x, y, z } = this.pos;
		const t = this.currentTransform.val;
		const s = this._sceneScale;
		// An unplaced, unrotated model must pose exactly as it did before this
		// existed, so take the identity straight out rather than composing one.
		if (x === 0 && y === 0 && z === 0 && this.currentTransform.isIdentity()) {
			return IDENTITY16;
		}
		const out = _rootScratch;
		const zs = this._zSign;
		// D · R · D, one entry at a time: out[col][row] = d[row] · R · d[col]
		for (let col = 0; col < 3; col++) {
			const dc = col === 0 ? 1 : col === 1 ? -1 : zs;
			out[col * 4] = t[col * 4] * dc;
			out[col * 4 + 1] = -t[col * 4 + 1] * dc;
			out[col * 4 + 2] = zs * t[col * 4 + 2] * dc;
			out[col * 4 + 3] = 0;
		}
		out[12] = x / s;
		out[13] = -y / s;
		out[14] = (zs * z) / s;
		out[15] = 1;
		return out;
	}

	/**
	 * DFS one node: compose its local matrix, multiply by the parent world,
	 * apply to its meshes, recurse into children.
	 * @ignore
	 * @internal
	 */
	_visit(idx, parentWorld, clip, t) {
		const node = this._nodes[idx];
		if (node === undefined) {
			return;
		}
		// `local` may be the shared `_localScratch` (animated node) — it's
		// consumed by the multiply below before any child overwrites it.
		const local = this._localMatrix(idx, clip, t);
		// write into this node's persistent world buffer (distinct from
		// parentWorld and local, so the in-place multiply is safe); children
		// read it as their parentWorld during recursion.
		const world = multiplyMatrixInto(this._world[idx], parentWorld, local);
		const meshes = this._meshByNode[idx];
		if (meshes !== undefined) {
			for (const mesh of meshes) {
				this._applyWorldToMesh(mesh, world);
			}
		}
		for (const child of node.children) {
			this._visit(child, world, clip, t);
		}
	}

	/**
	 * The node's local matrix: sampled TRS when the active clip (or either
	 * side of a crossfade) animates it, starting from the rest pose and
	 * overriding only the animated components; otherwise the cached rest
	 * matrix.
	 * @returns {number[]} 16-element column-major matrix
	 * @ignore
	 * @internal
	 */
	_localMatrix(idx, clip, t) {
		const node = this._nodes[idx];
		const fade = this._fade;
		if (
			(clip === null || !clip.animatedNodes.has(node.index)) &&
			(fade === null || !fade.nodes.has(node.index))
		) {
			// cached rest matrix — never mutated, safe to return directly
			return this._restMatrix[idx];
		}
		this._blendedTRS(node, clip, t, _t, _r, _s);
		// in-place into the shared scratch (consumed immediately by the caller's
		// world multiply, before the next node is visited)
		return composeTRSInto(_localScratch, _t, _r, _s);
	}

	/**
	 * A node's TRS under one clip at time `t`: its rest TRS with the channels
	 * the clip drives overridden. A null clip yields the rest TRS.
	 * @ignore
	 * @internal
	 */
	_sampleTRS(node, clip, t, T, R, S) {
		T[0] = node.translation[0];
		T[1] = node.translation[1];
		T[2] = node.translation[2];
		R[0] = node.rotation[0];
		R[1] = node.rotation[1];
		R[2] = node.rotation[2];
		R[3] = node.rotation[3];
		S[0] = node.scale[0];
		S[1] = node.scale[1];
		S[2] = node.scale[2];
		const channels =
			clip !== null ? clip.channelsByNode.get(node.index) : undefined;
		if (channels === undefined) {
			return;
		}
		for (const ch of channels) {
			sampleChannel(ch, t, _val);
			if (ch.path === "translation") {
				T[0] = _val[0];
				T[1] = _val[1];
				T[2] = _val[2];
			} else if (ch.path === "rotation") {
				R[0] = _val[0];
				R[1] = _val[1];
				R[2] = _val[2];
				R[3] = _val[3];
			} else {
				S[0] = _val[0];
				S[1] = _val[1];
				S[2] = _val[2];
			}
		}
	}

	/**
	 * A node's TRS as it is shown: the current clip's, blended with the
	 * crossfade's FROM side while one is in progress (translation and scale
	 * lerped, rotation slerped along the shortest arc).
	 * @ignore
	 * @internal
	 */
	_blendedTRS(node, clip, t, T, R, S) {
		this._sampleTRS(node, clip, t, T, R, S);
		const fade = this._fade;
		if (fade === null) {
			return;
		}
		if (fade.pose !== null) {
			const snap = fade.pose.get(node.index);
			if (snap !== undefined) {
				_ft[0] = snap[0];
				_ft[1] = snap[1];
				_ft[2] = snap[2];
				_fr[0] = snap[3];
				_fr[1] = snap[4];
				_fr[2] = snap[5];
				_fr[3] = snap[6];
				_fs[0] = snap[7];
				_fs[1] = snap[8];
				_fs[2] = snap[9];
			} else {
				this._sampleTRS(node, null, 0, _ft, _fr, _fs);
			}
		} else {
			this._sampleTRS(node, fade.clip, fade.time, _ft, _fr, _fs);
		}
		const w = Math.min(fade.elapsed / fade.duration, 1);
		for (let i = 0; i < 3; i++) {
			T[i] = _ft[i] + (T[i] - _ft[i]) * w;
			S[i] = _fs[i] + (S[i] - _fs[i]) * w;
		}
		_qpair[0] = _fr[0];
		_qpair[1] = _fr[1];
		_qpair[2] = _fr[2];
		_qpair[3] = _fr[3];
		_qpair[4] = R[0];
		_qpair[5] = R[1];
		_qpair[6] = R[2];
		_qpair[7] = R[3];
		slerpQuat(_qpair, 0, 4, w, R);
	}

	/**
	 * Start a crossfade of `duration` ms out of whatever is showing now: the
	 * current clip, which keeps playing underneath, or, when a crossfade is
	 * already running, the blended pose frozen as it stands (restarting from
	 * either side alone would pop).
	 * @param {number} duration - the crossfade length, in milliseconds
	 * @returns {object} the new fade state
	 * @ignore
	 * @internal
	 */
	_beginFade(duration) {
		const prev =
			this.current.name !== undefined ? this.anim[this.current.name] : null;
		const running = this._fade;
		if (running === null) {
			// a clip that plays once holds its last frame from where it ended
			// (a chain into the next clip starts this fade at or past its
			// end); a looping one carries on from where it is in its loop
			const length = prev !== null ? prev.duration : 0;
			const once = this._animOnce;
			let time = this.current.time;
			if (length > 0) {
				time = once ? Math.min(time, length) : time % length;
			}
			return {
				clip: prev,
				time,
				speed: this.animationspeed,
				once,
				done: this._animDone || (once && time >= length),
				pose: null,
				nodes: prev !== null ? prev.animatedNodes : NO_NODES,
				elapsed: 0,
				duration,
			};
		}
		// freeze every node either side of the running fade drives
		const pose = new Map();
		const t = this.current.time;
		const nodes = new Set(running.nodes);
		if (prev !== null) {
			for (const n of prev.animatedNodes) {
				nodes.add(n);
			}
		}
		for (const n of nodes) {
			const node = this._nodes[n];
			if (node === undefined) {
				continue;
			}
			this._blendedTRS(node, prev, t, _t, _r, _s);
			pose.set(
				n,
				Float64Array.of(
					_t[0],
					_t[1],
					_t[2],
					_r[0],
					_r[1],
					_r[2],
					_r[3],
					_s[0],
					_s[1],
					_s[2],
				),
			);
		}
		return {
			clip: null,
			time: 0,
			speed: 0,
			once: true,
			done: true,
			pose,
			nodes: new Set(pose.keys()),
			elapsed: 0,
			duration,
		};
	}

	/**
	 * Advance the running crossfade by `dt` ms: its weight, and the clip being
	 * faded out, which keeps looping, or, if it plays once, runs on to its
	 * last frame and holds it. Ends the fade once it is complete.
	 * @param {number} dt - elapsed time, in milliseconds
	 * @ignore
	 * @internal
	 */
	_advanceFade(dt) {
		const fade = this._fade;
		fade.elapsed += dt;
		if (fade.elapsed >= fade.duration) {
			this._fade = null;
			return;
		}
		const clip = fade.clip;
		if (clip !== null && !fade.done && clip.duration > 0) {
			const time = fade.time + (dt / 1000) * fade.speed;
			if (!fade.once) {
				fade.time = time % clip.duration;
			} else if (time >= clip.duration) {
				fade.time = clip.duration;
				fade.done = true;
			} else {
				fade.time = time;
			}
		}
	}

	/**
	 * Place every skinned part at the model's origin and, when the joints may
	 * have moved, deform it from its bind pose by their current world matrices
	 * (see `gltf_skin.js`), telling the renderer its geometry changed.
	 *
	 * The deformation is expressed relative to the model's own placement, so
	 * moving, turning or scaling the model needs no re-skin: the placement
	 * reaches the part through `_applyWorldToMesh`, exactly as for a rigid
	 * part.
	 * @param {number[]} root - the model's placement, in glTF space (see `_rootMatrix`)
	 * @param {boolean} reskin - whether the joints may have moved since the last pose
	 * @ignore
	 * @internal
	 */
	_skin(root, reskin) {
		if (this._skinned.length === 0) {
			return;
		}
		// a degenerate (zero-scale) placement has nowhere to express the skin
		// in; leave the parts as they last were rather than writing NaN
		const invertible = reskin && invertMatrixInto(_meshInverse, root);
		for (const part of this._skinned) {
			const mesh = part.mesh;
			this._applyWorldToMesh(mesh, root);
			if (!invertible) {
				continue;
			}
			computeJointMatrices(
				part.jointMatrices,
				part.skin,
				this._worldOf,
				_meshInverse,
			);
			skinVertices(
				part.bindVertices,
				part.bindNormals,
				part.joints,
				part.weights,
				part.jointMatrices,
				mesh.vertexCount,
				mesh.originalVertices,
				mesh.originalNormals,
			);
			mesh.needsUpdate = true;
		}
	}

	/**
	 * Split a node's world matrix into the renderable placement a {@link Mesh}'s
	 * Camera3d path expects: the translation (scaled, Y/Z-bridged) becomes
	 * `pos`/`depth`, the rotation+scale becomes `currentTransform` (translation
	 * zeroed). Mirrors the static {@link GLTFScene} center-split, recomputed per
	 * frame.
	 * @ignore
	 * @internal
	 */
	_applyWorldToMesh(mesh, world) {
		mesh.setPosition(
			world[12] * this._sceneScale,
			-world[13] * this._sceneScale,
			this._zSign * world[14] * this._sceneScale,
		);
		const v = mesh.currentTransform.val;
		v.set(world);
		v[12] = 0;
		v[13] = 0;
		v[14] = 0;
		mesh.isDirty = true;
	}
}
