import {
	composeTRS,
	composeTRSInto,
	multiplyMatrixInto,
} from "../../loader/parsers/gltf.js";
import { parseAnimationOptions } from "../../renderable/animation.ts";
import Container from "../../renderable/container.js";
import Mesh from "../../renderable/mesh.js";
import { sampleChannel } from "./gltf_sampler.js";

/**
 * additional import for TypeScript
 * @import { AnimationOptions } from "../../renderable/animation.ts";
 */

// column-major identity, the root's parent transform
const IDENTITY16 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// per-frame scratch reused while composing one node's local matrix (DFS visits
// a node fully before recursing, and the local matrix is consumed by the
// world-matrix multiply before the next node is touched, so a single shared
// set is safe and keeps update() allocation-free per node)
const _t = [0, 0, 0];
const _r = [0, 0, 0, 1];
const _s = [1, 1, 1];
const _val = [0, 0, 0, 0];
const _localScratch = new Array(16);

/**
 * @classdesc
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
 * Instances are created automatically by {@link GLTFScene} when the asset
 * defines animation channels; you usually obtain one via `level.load(...)`
 * rather than constructing it directly.
 * @augments Container
 */
export default class GLTFModel extends Container {
	/**
	 * @param {object} data - the parsed glTF descriptor (`{ graph, animations, bounds, ... }`)
	 * @param {object} [options]
	 * @param {number} [options.scale=1] - pixels per glTF unit (uniform scene scale)
	 * @param {boolean} [options.rightHanded=true] - glTF Y-up → engine Y-down via a rotation (no mirror)
	 * @param {boolean} [options.lit=false] - render the part meshes through the lit batcher
	 */
	constructor(data, options = {}) {
		super(0, 0);

		/**
		 * pixels per glTF unit (uniform scene scale)
		 * @type {number}
		 * @ignore
		 */
		this.scale = options.scale ?? 1;
		// right-handed (glTF) → negate Z as well as Y so the Y-up→Y-down bridge
		// is a rotation, matching Mesh#rightHanded / GLTFScene
		this._zSign = options.rightHanded !== false ? -1 : 1;

		// scene meshes carry their own world transform; the GPU depth test
		// resolves occlusion, so don't let the container reassign child depth
		this.autoDepth = false;

		// This container is a logical group sitting at the world origin — its
		// child meshes carry absolute world placement themselves. It has no
		// meaningful anchor box, and its width/height are Infinity (the Container
		// default), so the base `preDraw` anchor offset `width * anchorPoint`
		// would be `Infinity * 0 = NaN` and NaN-poison the renderer transform,
		// silently dropping every child mesh. Opt out of the anchor offset
		// entirely (same mechanism Mesh uses on the Camera3d world path).
		this.applyAnchorTransform = false;

		/** the node hierarchy keyed by glTF node index @ignore */
		this._nodes = data.graph.nodes;
		/** root node indices @ignore */
		this._roots = data.graph.roots;
		/** glTF node index → its part Mesh instances (one per primitive) @ignore */
		this._meshByNode = {};
		/** glTF node index → cached rest (bind-pose) local matrix @ignore */
		this._restMatrix = {};
		/**
		 * glTF node index → its world matrix, a persistent 16-element buffer
		 * recomputed in place every pose (a child reads its parent's buffer
		 * during the DFS, so each node needs its own). Preallocated here so the
		 * per-frame pose path allocates nothing.
		 * @ignore
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
		const radius = (Math.hypot(dx, dy, dz) / 2) * this.scale;
		const boxSize = Math.max(radius, 1) * Math.SQRT2;

		const lit = options.lit === true;
		const rightHanded = options.rightHanded !== false;

		// build the rest matrices + instantiate a Mesh per mesh-node primitive
		for (const idx in this._nodes) {
			const node = this._nodes[idx];
			this._restMatrix[idx] = node.matrix
				? node.matrix
				: composeTRS(node.translation, node.rotation, node.scale);
			// persistent per-node world-matrix buffer (recomputed in place each pose)
			this._world[idx] = new Array(16);

			for (const prim of node.primitives) {
				const mesh = new Mesh(0, 0, {
					vertices: prim.vertices,
					uvs: prim.uvs,
					indices: prim.indices,
					normals: prim.normals,
					texture: prim.image,
					width: boxSize,
					height: boxSize,
					scale: this.scale,
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
					// thin/flat double-sided parts must not be back-face culled
					cullBackFaces: prim.doubleSided !== true,
				});
				const f = prim.baseColorFactor;
				if (f) {
					mesh.tint.setColor(
						Math.round(f[0] * 255),
						Math.round(f[1] * 255),
						Math.round(f[2] * 255),
					);
				}
				if (prim.colors) {
					mesh.vertexColors = prim.colors;
				}
				mesh.name = node.name;
				(this._meshByNode[idx] ??= []).push(mesh);
				this.addChild(mesh);
			}
		}

		// index the animation clips, pre-grouping each clip's channels by the
		// node they target (so sampling a node is a single map lookup)
		/** name → clip `{ name, duration, channelsByNode, animatedNodes }` @ignore */
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
		/** @ignore */
		this.current = { name: undefined, time: 0, length: 0 };
		/** loop-completion callback (built from the options) @ignore */
		this.resetAnim = undefined;
		/** set when a `loop:false` clip has finished its single cycle @ignore */
		this._animDone = false;

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
	 * @param {string} name - animation clip id (see {@link GLTFModel#getAnimationNames})
	 * @param {string|Function|AnimationOptions} [options] - loop / chain / completion behavior
	 * @param {boolean} [preserveTime=false] - keep the current playback time instead of restarting at 0
	 * @returns {GLTFModel} this, for chaining
	 * @example
	 * model.setCurrentAnimation("walk");                       // loop forever
	 * model.setCurrentAnimation("die", { loop: false });       // play once, hold last pose
	 * model.setCurrentAnimation("jump", { next: "idle" });     // jump, then idle
	 * model.setCurrentAnimation("walk", { speed: 2 });         // twice as fast
	 * model.setCurrentAnimation("emote-yes", () => spawnFx()); // legacy callback
	 */
	setCurrentAnimation(name, options, preserveTime = false) {
		if (this.anim[name] === undefined) {
			throw new Error("animation id '" + name + "' not defined");
		}
		if (this.isCurrentAnimation(name)) {
			return this;
		}
		this.current.name = name;
		this.current.length = this.anim[name].duration;
		const opts = parseAnimationOptions(options);
		this.animationspeed = opts.speed;
		this._animDone = false;
		const onComplete = opts.onComplete;
		if (opts.legacyFn) {
			// legacy bare-function callback (return false → hold the last pose)
			this.resetAnim = onComplete;
		} else if (typeof opts.next === "string") {
			const next = opts.next;
			this.resetAnim = () => {
				if (typeof onComplete === "function") {
					onComplete();
				}
				this.setCurrentAnimation(next);
			};
		} else if (opts.loop === false) {
			// play once: fire onComplete, hold the final pose
			this.resetAnim = () => {
				if (typeof onComplete === "function") {
					onComplete();
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
	 * @param {string|Function|AnimationOptions} [options] - loop / chain / completion behavior (see {@link GLTFModel#setCurrentAnimation})
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
		this.animationpause = false;
		// re-pose with no active clip → every node falls back to its rest matrix
		this._pose();
		this.isDirty = true;
		return this;
	}

	/**
	 * Advance the active clip and re-pose the rig.
	 * @param {number} dt - elapsed time since the last update, in milliseconds
	 * @returns {boolean} true if the model (or any child) needs redrawing
	 * @protected
	 */
	update(dt) {
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
			this._pose();
			this.isDirty = true;
		}
		return super.update(dt);
	}

	/**
	 * Sample the active clip (if any) and propagate world transforms down the
	 * node tree, writing each part mesh's placement. Nodes the current clip does
	 * not animate use their cached rest matrix.
	 * @ignore
	 */
	_pose() {
		const clip = this.current.name ? this.anim[this.current.name] : null;
		const t = this.current.time;
		for (const root of this._roots) {
			this._visit(root, IDENTITY16, clip, t);
		}
	}

	/**
	 * DFS one node: compose its local matrix, multiply by the parent world,
	 * apply to its meshes, recurse into children.
	 * @ignore
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
	 * The node's local matrix: sampled TRS when the active clip animates it
	 * (starting from the rest pose, overriding only the animated components),
	 * otherwise the cached rest matrix.
	 * @returns {number[]} 16-element column-major matrix
	 * @ignore
	 */
	_localMatrix(idx, clip, t) {
		const node = this._nodes[idx];
		if (clip === null || !clip.animatedNodes.has(node.index)) {
			// cached rest matrix — never mutated, safe to return directly
			return this._restMatrix[idx];
		}
		// start from the rest TRS, then override the channels this clip drives
		_t[0] = node.translation[0];
		_t[1] = node.translation[1];
		_t[2] = node.translation[2];
		_r[0] = node.rotation[0];
		_r[1] = node.rotation[1];
		_r[2] = node.rotation[2];
		_r[3] = node.rotation[3];
		_s[0] = node.scale[0];
		_s[1] = node.scale[1];
		_s[2] = node.scale[2];
		for (const ch of clip.channelsByNode.get(node.index)) {
			sampleChannel(ch, t, _val);
			if (ch.path === "translation") {
				_t[0] = _val[0];
				_t[1] = _val[1];
				_t[2] = _val[2];
			} else if (ch.path === "rotation") {
				_r[0] = _val[0];
				_r[1] = _val[1];
				_r[2] = _val[2];
				_r[3] = _val[3];
			} else {
				_s[0] = _val[0];
				_s[1] = _val[1];
				_s[2] = _val[2];
			}
		}
		// in-place into the shared scratch (consumed immediately by the caller's
		// world multiply, before the next node is visited)
		return composeTRSInto(_localScratch, _t, _r, _s);
	}

	/**
	 * Split a node's world matrix into the renderable placement a {@link Mesh}'s
	 * Camera3d path expects: the translation (scaled, Y/Z-bridged) becomes
	 * `pos`/`depth`, the rotation+scale becomes `currentTransform` (translation
	 * zeroed). Mirrors the static {@link GLTFScene} center-split, recomputed per
	 * frame.
	 * @ignore
	 */
	_applyWorldToMesh(mesh, world) {
		mesh.pos.set(world[12] * this.scale, -world[13] * this.scale);
		mesh.depth = this._zSign * world[14] * this.scale;
		const v = mesh.currentTransform.val;
		v.set(world);
		v[12] = 0;
		v[13] = 0;
		v[14] = 0;
		mesh.isDirty = true;
	}
}
