import { blendStateFor, normalizeBlendMode } from "../../blendmodes.js";
import blitWGSL from "../shaders/blit.wgsl";

import clearWGSL from "../shaders/clear.wgsl";
import primitiveWGSL from "../shaders/primitive.wgsl";
import quadWGSL from "../shaders/quad.wgsl";
import { CLEAR_UNIFORM_SIZE, FRAME_UNIFORM_SIZE } from "./bindgroups.js";

/**
 * A `GPUBlendState` for a mode — the shared, backend-neutral blend table
 * (`video/blendmodes.js`) in the shape WebGPU's pipeline descriptor wants.
 *
 * The neutral table describes ONE component, because every mode the engine
 * defines blends colour and alpha identically. Duplicating it across the two
 * channels is a WebGPU API detail, so it lives here rather than in the shared
 * table, which the WebGL backend also reads.
 * @param {string} mode - a canonical mode from `normalizeBlendMode`
 * @param {boolean} premultipliedAlpha - whether sources are premultiplied
 * @returns {GPUBlendState|undefined} the blend state, or `undefined` for
 * `"none"`, which means replace (no blending)
 * @ignore
 * @internal
 */
function gpuBlendState(mode, premultipliedAlpha) {
	const component = blendStateFor(mode, premultipliedAlpha);
	return typeof component === "undefined"
		? undefined
		: { color: component, alpha: component };
}

/**
 * Texture slots per quad draw segment — the quad family batches quads
 * across up to this many distinct textures before a flush is forced (the
 * GL sampler-ladder equivalent). 8 texture + 8 sampler bindings stays
 * comfortably inside WebGPU's base limits (16 sampled textures / 16
 * samplers per stage) with headroom for the effect families' samplers.
 * @ignore
 * @internal
 */
export const MAX_QUAD_TEXTURES = 8;

/**
 * How many pipelines {@link WebGPUPipelineCache#warm} compiles at once.
 *
 * Asynchronous creation moves the compile off the frame, but it still runs
 * in the browser's GPU process, which is also the process presenting frames.
 * Handing it every pipeline a scene could want in one go starves the frames
 * in between, which is the stutter the warm-up exists to remove, so the rest
 * queue behind this many.
 * @ignore
 * @internal
 */
const MAX_WARM_IN_FLIGHT = 16;

/**
 * How many mid-frame pipeline keys {@link WebGPUPipelineCache#inFrameMissKeys}
 * keeps, newest last. Enough to read a scene's misses off, small enough that
 * a game creating pipelines forever does not grow it forever.
 * @ignore
 * @internal
 */
const MISS_KEYS_KEPT = 64;

/**
 * The depth-stencil attachment format every pass and every pipeline of this
 * backend declares. Attached from day one — masks use the stencil half now,
 * meshes will use the depth half — because a pipeline's depthStencil state
 * must match the pass attachment, and adding it later would invalidate
 * every cached pipeline.
 * @ignore
 * @internal
 */
export const DEPTH_STENCIL_FORMAT = "depth24plus-stencil8";

/**
 * Stencil-mode → depthStencil/colorWriteMask pipeline states, realizing the
 * GL stencil mask machinery (`setMask`/`clearMask`) as pipeline variants:
 * - "none"  — stencil ignored (default 2D drawing)
 * - "write" — the mask write phase: color writes off, every fragment
 *   increments the stencil (GL's `colorMask(false) + stencilOp INCR`)
 * - "test"  — the masked render phase: fragments pass only where stencil
 *   equals the dynamic `setStencilReference` (GL's `stencilFunc(EQUAL, ref)`)
 * @ignore
 * @internal
 */
const STENCIL_STATES = {
	none: {
		stencil: {
			compare: "always",
			failOp: "keep",
			depthFailOp: "keep",
			passOp: "keep",
		},
		readMask: 0xff,
		writeMask: 0,
		colorWriteMask: 0xf,
	},
	write: {
		stencil: {
			compare: "always",
			failOp: "keep",
			depthFailOp: "keep",
			passOp: "increment-clamp",
		},
		readMask: 0xff,
		writeMask: 0xff,
		colorWriteMask: 0,
	},
	test: {
		stencil: {
			compare: "equal",
			failOp: "keep",
			depthFailOp: "keep",
			passOp: "keep",
		},
		readMask: 0xff,
		writeMask: 0,
		colorWriteMask: 0xf,
	},
	// gradient-mask phases (the GL #gradientMask parity):
	// - "tag" stamps the shape's pixels with the dynamic stencil reference
	//   on a cleared stencil (GL's ALWAYS/REPLACE, color writes off) —
	//   replace, not increment, so overdrawing shape geometry is harmless
	// - "mark" writes the reference only where the stencil's low 7 bits
	//   already equal the reference's low bits — tags/untags the high-bit
	//   marker inside an active mask without disturbing mask levels
	tag: {
		stencil: {
			compare: "always",
			failOp: "keep",
			depthFailOp: "keep",
			passOp: "replace",
		},
		readMask: 0xff,
		writeMask: 0xff,
		colorWriteMask: 0,
	},
	mark: {
		stencil: {
			compare: "equal",
			failOp: "keep",
			depthFailOp: "keep",
			passOp: "replace",
		},
		readMask: 0x7f,
		writeMask: 0xff,
		colorWriteMask: 0,
	},
};

/**
 * Lazily-built cache of `GPURenderPipeline`s for the WebGPU backend, keyed
 * by everything that is pipeline state under WebGPU but dynamic state under
 * GL: shader family, topology, blend mode, premultiplied-alpha flag,
 * stencil mode (and, held constant today, the canvas format and sample
 * count — both stay in the key so render targets and MSAA slot in later
 * without a reshape).
 *
 * Also owns the shader modules, bind-group layouts and pipeline layouts —
 * the objects every pipeline shares and the uniform ring / texture store
 * build their bind groups against.
 * @ignore
 * @internal
 */
export default class WebGPUPipelineCache {
	/**
	 * @param {GPUDevice} device - the device to build pipelines on
	 * @param {string} format - the canvas color format (preferredFormat)
	 */
	constructor(device, format) {
		this.device = device;
		this.format = format;
		this.sampleCount = 1;
		/** @type {Map<string, GPURenderPipeline>} */
		this.pipelines = new Map();
		/** @type {Map<string, {stride: number, attributes: object[]}>} */
		this.vertexLayouts = new Map();

		/**
		 * `true` between the renderer's frame start and its submit. A pipeline
		 * created while it is set was compiled in the middle of a frame, which
		 * is the first-use stall {@link WebGPUPipelineCache#warm} exists to
		 * prevent, so {@link WebGPUPipelineCache#get} counts it.
		 * @type {boolean}
		 */
		this.inFrame = false;
		/**
		 * pipelines created in the middle of a frame since this cache was
		 * built: the number a warm-up drives toward zero
		 * @type {number}
		 */
		this.inFrameMisses = 0;
		/**
		 * the keys behind {@link WebGPUPipelineCache#inFrameMisses}, newest
		 * last, capped at the last {@link MISS_KEYS_KEPT}
		 * @type {string[]}
		 */
		this.inFrameMissKeys = [];
		/**
		 * warm-ups still compiling, by key, so a second request for the same
		 * pipeline waits on the first rather than compiling it twice
		 * @type {Map<string, Promise<void>>}
		 */
		this.pending = new Map();
		/**
		 * where {@link WebGPUPipelineCache#collect} is gathering the warm-ups
		 * asked for, while it runs
		 * @type {Promise<void>[]|undefined}
		 */
		this.collecting = undefined;
		/** @type {{run: Function, resolve: Function}[]} */
		this.warmQueue = [];
		this.warmInFlight = 0;
		/** @type {Map<string, GPURenderPipeline[]>} format|sampleCount → pipelines */
		this.touchQueue = new Map();
		/** @type {Map<string, {color: GPUTexture, depth: GPUTexture}>} */
		this.scratchTargets = new Map();
		/**
		 * bumped by {@link WebGPUPipelineCache#clear}: a warm-up that started
		 * before a clear must not put its pipeline back into the emptied cache
		 * @type {number}
		 */
		this.generation = 0;

		// ---- bind-group layouts (shared by pipelines and resource caches) --
		this.frameLayout = device.createBindGroupLayout({
			label: "melonJS frame globals layout",
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: {
						type: "uniform",
						hasDynamicOffset: true,
						minBindingSize: FRAME_UNIFORM_SIZE,
					},
				},
			],
		});
		this.clearFrameLayout = device.createBindGroupLayout({
			label: "melonJS clear color layout",
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: "uniform",
						hasDynamicOffset: true,
						minBindingSize: CLEAR_UNIFORM_SIZE,
					},
				},
			],
		});
		this.materialLayout = device.createBindGroupLayout({
			label: "melonJS material layout",
			entries: [
				{ binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
				{ binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
			],
		});
		// The MESH family's group 1: the diffuse pair plus a second pair for
		// the per-texel opacity map (MTL `map_d`, #1575). Always four
		// bindings, even for a mesh with no alpha map — the batcher points
		// the second pair at the shared white pixel then, which costs one
		// extra bind-group entry and keeps every mesh pipeline on one
		// layout instead of splitting the family in two.
		//
		// Widening the layout does not break the documented custom-WGSL mesh
		// contract: a module may declare a SUBSET of its layout's bindings,
		// so a custom mesh shader declaring only texture+sampler still
		// validates against this.
		this.meshMaterialLayout = device.createBindGroupLayout({
			label: "melonJS mesh material layout",
			entries: [
				{ binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
				{ binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
				{ binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
				{ binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
				// the tangent-space normal map (MTL `map_bump`), and like the
				// alpha pair above it is always bound — the diffuse texture
				// stands in as filler when a mesh has none, so the layout is
				// one shape for every mesh
				{ binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: {} },
				{ binding: 5, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
			],
		});
		// the quad family's group 1: eight texture slots (bindings 0-7) and
		// their samplers (8-15) — one draw segment spans up to eight
		// distinct textures, selected per quad by aTextureId
		const multiEntries = [];
		for (let slot = 0; slot < MAX_QUAD_TEXTURES; slot++) {
			multiEntries.push({
				binding: slot,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {},
			});
			multiEntries.push({
				binding: MAX_QUAD_TEXTURES + slot,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {},
			});
		}
		this.multiMaterialLayout = device.createBindGroupLayout({
			label: "melonJS quad materials layout",
			entries: multiEntries,
		});

		// ---- shader modules ----------------------------------------------
		this.modules = {
			quad: device.createShaderModule({
				label: "melonJS quad shader",
				code: quadWGSL,
			}),
			// the single-texture compositing family (render-target blits) —
			// same group-1 shape as the effect scaffold
			blit: device.createShaderModule({
				label: "melonJS blit shader",
				code: blitWGSL,
			}),
			primitive: device.createShaderModule({
				label: "melonJS primitive shader",
				code: primitiveWGSL,
			}),
			clear: device.createShaderModule({
				label: "melonJS clear shader",
				code: clearWGSL,
			}),
		};

		// ---- pipeline layouts --------------------------------------------
		this.pipelineLayouts = {
			quad: device.createPipelineLayout({
				bindGroupLayouts: [this.frameLayout, this.multiMaterialLayout],
			}),
			blit: device.createPipelineLayout({
				bindGroupLayouts: [this.frameLayout, this.materialLayout],
			}),
			primitive: device.createPipelineLayout({
				bindGroupLayouts: [this.frameLayout],
			}),
			clear: device.createPipelineLayout({
				bindGroupLayouts: [this.clearFrameLayout],
			}),
		};

		// ---- registered (non-built-in) shader families -------------------
		// effect modules are deduplicated by their exact module text: clones
		// and same-shape effects share one module and its pipelines
		/** @type {Map<string, string>} moduleText → family key */
		this.registeredModules = new Map();
		// compiled GPUShaderModule per source text, shared across the families
		// that source serves (one module, several vertex layouts)
		this.modulesBySource = new Map();
		/** @type {Map<string, {stride: number, attributes: object[]}>} family key → vertex-layout alias */
		this.vertexLayoutAliases = new Map();
		// the blit family rides the frozen quad vertex layout
		this.vertexLayoutAliases.set("blit", "quad");
		/** @type {Map<string, GPUBindGroupLayout>} shape signature → group-3 layout */
		this.effectLayouts = new Map();

		// group 2 (lights) is reserved but unused by the 2D tier: pipeline
		// layouts are positional, so families binding group 3 interpose a
		// shared empty layout — and passes set the matching empty bind group,
		// which some implementations validate even for empty layouts
		this.emptyLayout = device.createBindGroupLayout({
			label: "melonJS empty group layout",
			entries: [],
		});
		this.emptyBindGroup = device.createBindGroup({
			label: "melonJS empty group",
			layout: this.emptyLayout,
			entries: [],
		});

		/**
		 * Device generation this cache belongs to — bumped once per cache
		 * construction. Consumers holding device-scoped objects built
		 * against this cache (effect modules, bind groups) compare their
		 * recorded epoch and lazily rebuild after a device loss.
		 * @type {number}
		 */
		this.epoch = ++WebGPUPipelineCache.epochCounter;
	}

	/**
	 * monotonic construction counter backing {@link WebGPUPipelineCache#epoch}
	 * @ignore
	 * @internal
	 */
	static epochCounter = 0;

	/**
	 * Register a shader family beyond the built-in three, routing it through
	 * the same keyed {@link WebGPUPipelineCache#get} lookup. Identical module
	 * text registers once — the returned key is stable per text, so clones
	 * and same-body effects share the module and every pipeline built on it.
	 * @param {string} code - the complete WGSL module text
	 * @param {object} [options] - family options
	 * @param {GPUBindGroupLayout[]} [options.bindGroupLayouts] - full positional
	 *   bind-group-layout list (defaults to `[frameLayout, materialLayout]`)
	 * @param {string} [options.vertexLayoutKey="quad"] - reuse a registered
	 *   vertex layout under this family (the effect blit rides the quad layout)
	 * @param {string} [options.label] - debug label for the shader module
	 * @returns {string} the family key to pass to {@link WebGPUPipelineCache#get}
	 */
	registerShader(code, options = {}) {
		const alias = options.vertexLayoutKey ?? "quad";
		// Keyed by (source, vertex layout), not by source alone. One module can
		// legitimately serve several vertex layouts — the instanced ground
		// shadow (#1515) reads only the transform rows, so one module covers
		// every record shape while the instance buffer's `arrayStride` still
		// differs per shape. Keying on the source alone silently handed every
		// later caller the FIRST registration's layout, which reads the records
		// at the wrong stride. Callers registering one layout per module (all
		// of them, until now) are unaffected: same source + same alias still
		// dedupes to the same family.
		const cacheKey = `${alias}\u0000${code}`;
		let key = this.registeredModules.get(cacheKey);
		if (typeof key === "undefined") {
			key = `effect:${this.registeredModules.size}`;
			this.registeredModules.set(cacheKey, key);
			// the compiled module IS shared across layouts — only the pipeline
			// layout and vertex-layout alias below are per-family
			let module = this.modulesBySource.get(code);
			if (module === undefined) {
				module = this.device.createShaderModule({
					label: options.label ?? `melonJS ${key} shader`,
					code,
				});
				this.modulesBySource.set(code, module);
			}
			this.modules[key] = module;
			this.pipelineLayouts[key] = this.device.createPipelineLayout({
				bindGroupLayouts: options.bindGroupLayouts ?? [
					this.frameLayout,
					this.materialLayout,
				],
			});
			this.vertexLayoutAliases.set(key, alias);
		}
		return key;
	}

	/**
	 * Fetch (building on first use) the group-3 bind-group layout for an
	 * effect shape. Effects with the same shape — same uniform block size,
	 * same texture/sampler bindings, same builtins — share one layout, so
	 * their pipeline layouts (and pipelines) are shareable too.
	 * @param {string} signature - the shape signature (caller-composed)
	 * @param {GPUBindGroupLayoutEntry[]} entries - the layout entries
	 * @returns {GPUBindGroupLayout} the cached layout
	 */
	getEffectLayout(signature, entries) {
		let layout = this.effectLayouts.get(signature);
		if (typeof layout === "undefined") {
			layout = this.device.createBindGroupLayout({
				label: `melonJS effect layout ${signature}`,
				entries,
			});
			this.effectLayouts.set(signature, layout);
		}
		return layout;
	}

	/**
	 * Register a shader family's vertex buffer layout from a batcher's
	 * frozen attribute records — the declarative consumption of the
	 * backend-neutral vertex formats (#1492): the records already carry
	 * `format` and `offset` in WebGPU vocabulary, shader locations are
	 * declaration order.
	 * Accepts either the single-buffer form `(key, stride, attributes)` or a
	 * list of buffer groups `(key, [{stride, stepMode, attributes}, …])` —
	 * the latter is what an instanced family registers, with the geometry
	 * group at index 0 and a `stepMode: "instance"` group after it. Shader
	 * locations are assigned in declaration order and continue **across**
	 * groups, since WGSL locations are a single namespace.
	 * @param {string} shaderKey - "quad" | "primitive"
	 * @param {number|object[]} stride - vertex byte stride, or the buffer-group list
	 * @param {{format: string, offset: number}[]} [attributes] - frozen records (single-buffer form)
	 */
	registerVertexLayout(shaderKey, stride, attributes) {
		const groups = Array.isArray(stride)
			? stride
			: [{ stride, attributes, stepMode: "vertex" }];
		let location = 0;
		this.vertexLayouts.set(
			shaderKey,
			groups.map((group) => {
				const layout = {
					arrayStride: group.stride,
					attributes: group.attributes.map((a) => {
						// an attribute may pin its own location. Instanced
						// families do: their optional slots come and go per
						// variant, and sequential numbering would shift the
						// remaining ones, so every WGSL variant would need
						// renumbering. Pinned locations keep the module text
						// identical whichever slots are present.
						const shaderLocation = a.shaderLocation ?? location;
						location = shaderLocation + 1;
						return {
							format: a.format,
							offset: a.offset,
							shaderLocation,
						};
					}),
				};
				// omitted entirely for per-vertex groups: "vertex" is the
				// WebGPU default, and emitting it would change the descriptor
				// every existing pipeline is built from
				if (group.stepMode === "instance") {
					layout.stepMode = "instance";
				}
				return layout;
			}),
		);
	}

	/**
	 * The cache key for a pipeline state tuple.
	 *
	 * The ONE place a key is composed. A draw looks its pipeline up through
	 * {@link WebGPUPipelineCache#get} and a warm-up builds one ahead of time
	 * through {@link WebGPUPipelineCache#warm}, and both come here, so the two
	 * cannot drift into building the same pipeline under two names: a warm-up
	 * whose key differs from the draw's by one character compiles a pipeline
	 * nothing will ever ask for, and the draw still compiles its own.
	 *
	 * The colour format and sample count default to the cache's CURRENT ones,
	 * which the renderer rewrites per render target. A warm-up runs outside
	 * any pass, where those describe whatever was bound last, so it passes
	 * the target it is warming for explicitly.
	 * @param {string} shaderKey - "quad" | "primitive" | "clear" | a registered family
	 * @param {string} topology - portable topology name ("triangle-list", …)
	 * @param {string} blendMode - blend mode (normalized internally)
	 * @param {boolean} premultipliedAlpha - source premultiplication flag
	 * @param {string} [stencilMode="none"] - "none" | "write" | "test" | "tag" | "mark"
	 * @param {object} [meshState] - the mesh pass state, see {@link WebGPUPipelineCache#get}
	 * @param {string} [format] - colour target format, the current one by default
	 * @param {number} [sampleCount] - pass sample count, the current one by default
	 * @returns {string} the key
	 */
	keyFor(
		shaderKey,
		topology,
		blendMode,
		premultipliedAlpha,
		stencilMode = "none",
		meshState,
		format = this.format,
		sampleCount = this.sampleCount,
	) {
		const blend = normalizeBlendMode(blendMode);
		// `"none"` writes the source as-is, so the premultiplied flag selects
		// nothing in the descriptor. Keying on it anyway split one pipeline in
		// two on a flag that is runtime state (whatever drew last leaves it),
		// and a warm-up cannot know which half a later draw will land on.
		const pma = blend === "none" || premultipliedAlpha !== false;
		let key = `${shaderKey}|${topology}|${blend}|${pma ? 1 : 0}|${stencilMode}|${format}|${sampleCount}`;
		if (meshState) {
			key += `|mesh:${meshState.cullMode}:${meshState.frontFace}`;
			// Appended ONLY when it differs from the default. Adding it
			// unconditionally would remint every existing mesh pipeline for a
			// value none of them changed.
			if (meshState.depthWrite === false) {
				key += "|dw0";
			}
			// Same treatment, and a separate axis: writing and testing are
			// different questions, and a mesh may want either without the
			// other. Appended only when off, so no existing pipeline moves.
			if (meshState.depthTest === false) {
				key += "|dt0";
			}
			// Fog is a PIPELINE axis, not a uniform test: the mesh modules
			// declare an `enable_fog` overridable constant, and specializing it
			// here lets the implementation fold the branch and drop the dead
			// side. Appended only when set, so no existing pipeline is
			// reminted for a value none of them changed.
			if (meshState.fog === true) {
				key += "|fog";
			}
		}
		return key;
	}

	/**
	 * Fetch (building on first use) the pipeline for the given state tuple.
	 * @param {string} shaderKey - "quad" | "primitive" | "clear"
	 * @param {string} topology - portable topology name ("triangle-list", …)
	 * @param {string} blendMode - blend mode (normalized internally)
	 * @param {boolean} premultipliedAlpha - source premultiplication flag
	 * @param {string} [stencilMode="none"] - "none" | "write" | "test" | "tag" | "mark"
	 * @param {{cullMode: string, frontFace: string, depthWrite?: boolean, depthTest?: boolean, fog?: boolean}} [meshState] - mesh pass
	 *   state: its presence switches the depth half of the attachment on —
	 *   depth writes enabled, "less-equal" testing (the GL mesh mode's
	 *   LEQUAL, keeping coplanar geometry stable) — and sets the per-mesh
	 *   face-culling axes. Omitted by the whole 2D tier, whose keys and
	 *   descriptors stay byte-identical to a build without a mesh path.
	 * @returns {GPURenderPipeline} the pipeline
	 */
	get(
		shaderKey,
		topology,
		blendMode,
		premultipliedAlpha,
		stencilMode = "none",
		meshState,
	) {
		const key = this.keyFor(
			shaderKey,
			topology,
			blendMode,
			premultipliedAlpha,
			stencilMode,
			meshState,
		);
		let pipeline = this.pipelines.get(key);
		if (typeof pipeline === "undefined") {
			pipeline = this.device.createRenderPipeline(
				this._descriptor(
					key,
					shaderKey,
					topology,
					blendMode,
					premultipliedAlpha,
					stencilMode,
					meshState,
					this.format,
					this.sampleCount,
				),
			);
			this.pipelines.set(key, pipeline);
			if (this.inFrame === true) {
				this.inFrameMisses++;
				this.inFrameMissKeys.push(key);
				if (this.inFrameMissKeys.length > MISS_KEYS_KEPT) {
					this.inFrameMissKeys.shift();
				}
			}
		}
		return pipeline;
	}

	/**
	 * Build a pipeline ahead of the draw that will need it, without blocking.
	 *
	 * Takes the same tuple as {@link WebGPUPipelineCache#get}, plus the colour
	 * format and sample count of the target the draw will land on, since a
	 * warm-up runs outside any pass. Compiles through
	 * `createRenderPipelineAsync` where the device has it, so the work
	 * happens off the frame, and files the result under the same key `get`
	 * will look up. Asking twice for one pipeline compiles it once.
	 *
	 * Never rejects. A pipeline that fails to build is left for the draw to
	 * build and report, exactly as it would have without the warm-up.
	 * @param {string} shaderKey - the family, already registered
	 * @param {string} topology - portable topology name
	 * @param {string} blendMode - blend mode
	 * @param {boolean} premultipliedAlpha - source premultiplication flag
	 * @param {string} stencilMode - stencil mode
	 * @param {object|undefined} meshState - mesh pass state, read NOW: a later
	 *   change to the object does not reach the pipeline being built
	 * @param {string} format - colour target format the draw will use
	 * @param {number} sampleCount - sample count the draw will use
	 * @returns {Promise<void>} settles once the pipeline is in the cache, or
	 *   has failed to get there
	 */
	warm(
		shaderKey,
		topology,
		blendMode,
		premultipliedAlpha,
		stencilMode,
		meshState,
		format,
		sampleCount,
	) {
		const key = this.keyFor(
			shaderKey,
			topology,
			blendMode,
			premultipliedAlpha,
			stencilMode,
			meshState,
			format,
			sampleCount,
		);
		if (this.pipelines.has(key)) {
			return Promise.resolve();
		}
		const inFlight = this.pending.get(key);
		if (inFlight !== undefined) {
			this.collecting?.push(inFlight);
			return inFlight;
		}
		// the descriptor is assembled now, not when the queue reaches it:
		// `meshState` is a batcher's scratch object, rewritten per draw
		const descriptor = this._descriptor(
			key,
			shaderKey,
			topology,
			blendMode,
			premultipliedAlpha,
			stencilMode,
			meshState,
			format,
			sampleCount,
		);
		const generation = this.generation;
		const promise = new Promise((resolve) => {
			this.warmQueue.push({
				run: () => {
					// A draw that could not wait while this sat in the queue
					// has built the pipeline itself by now: compiling it again
					// would only compete with the frames for the compiler. One
					// already compiling when the draw came cannot be stopped,
					// and is the copy the draw's makes redundant.
					if (this.pipelines.has(key)) {
						return undefined;
					}
					return typeof this.device.createRenderPipelineAsync === "function"
						? this.device.createRenderPipelineAsync(descriptor)
						: this.device.createRenderPipeline(descriptor);
				},
				resolve: (pipeline) => {
					this.pending.delete(key);
					// a draw that could not wait built its own copy meanwhile;
					// keep that one, the draws already recorded hold it
					if (
						pipeline !== undefined &&
						generation === this.generation &&
						!this.pipelines.has(key)
					) {
						this.pipelines.set(key, pipeline);
						this._touch(pipeline, format, sampleCount);
					}
					resolve();
				},
			});
		});
		this.pending.set(key, promise);
		this.collecting?.push(promise);
		this._pumpWarmQueue();
		return promise;
	}

	/**
	 * Run `ask` and hand back the warm-ups it asked for that are not built
	 * yet: the ones it started, and the ones already compiling that it asked
	 * for again. A pipeline already in the cache is not waited on, so a scene
	 * entered a second time hands back nothing.
	 * @param {Function} ask - asks for warm-ups, through {@link WebGPUPipelineCache#warm}
	 * @returns {Promise<void>[]} one promise per pipeline still on its way
	 */
	collect(ask) {
		const outer = this.collecting;
		const asked = [];
		this.collecting = asked;
		try {
			ask();
		} finally {
			this.collecting = outer;
		}
		return asked;
	}

	/**
	 * Start queued warm-ups until {@link MAX_WARM_IN_FLIGHT} are compiling.
	 * @ignore
	 * @internal
	 */
	_pumpWarmQueue() {
		while (
			this.warmInFlight < MAX_WARM_IN_FLIGHT &&
			this.warmQueue.length > 0
		) {
			const job = this.warmQueue.shift();
			this.warmInFlight++;
			// `then(run)` rather than `run()`: a synchronous throw from the
			// device (the fallback path, or a lost device) becomes a rejection
			// handled below instead of escaping into the caller
			Promise.resolve()
				.then(job.run)
				.then(job.resolve, () => {
					job.resolve(undefined);
				})
				.finally(() => {
					this.warmInFlight--;
					this._pumpWarmQueue();
				});
		}
	}

	/**
	 * Bind a freshly warmed pipeline once, in a pass of its own, so it is
	 * compiled now rather than at the first draw that uses it.
	 *
	 * Some implementations accept `createRenderPipelineAsync` and still defer
	 * the native compile to the first `setPipeline`, which puts it right back
	 * in the frame the warm-up was meant to keep it out of. Setting it on a
	 * throwaway 1×1 pass makes that first use happen here, while nothing is
	 * on screen waiting for it. Where the compile already happened this is
	 * one cheap bind.
	 * @param {GPURenderPipeline} pipeline - the pipeline to bind
	 * @param {string} format - its colour format
	 * @param {number} sampleCount - its sample count
	 * @ignore
	 * @internal
	 */
	_touch(pipeline, format, sampleCount) {
		const target = `${format}|${sampleCount}`;
		let batch = this.touchQueue.get(target);
		if (batch === undefined) {
			batch = [];
			this.touchQueue.set(target, batch);
		}
		batch.push(pipeline);
		if (this.touchQueue.size === 1 && batch.length === 1) {
			// one submit for everything that resolves in the same tick
			queueMicrotask(() => {
				this._flushTouches();
			});
		}
	}

	/**
	 * Record and submit the passes queued by {@link WebGPUPipelineCache#_touch}.
	 * @ignore
	 * @internal
	 */
	_flushTouches() {
		const device = this.device;
		const batches = [...this.touchQueue];
		this.touchQueue.clear();
		if (typeof device.createCommandEncoder !== "function") {
			return;
		}
		try {
			const encoder = device.createCommandEncoder({
				label: "melonJS pipeline warm-up",
			});
			for (const [target, pipelines] of batches) {
				const [format, samples] = target.split("|");
				const scratch = this._scratchTarget(format, Number(samples));
				const pass = encoder.beginRenderPass({
					label: "melonJS pipeline warm-up",
					colorAttachments: [
						{ view: scratch.colorView, loadOp: "clear", storeOp: "discard" },
					],
					depthStencilAttachment: {
						view: scratch.depthView,
						depthClearValue: 1,
						depthLoadOp: "clear",
						depthStoreOp: "discard",
						stencilLoadOp: "clear",
						stencilStoreOp: "discard",
					},
				});
				for (const pipeline of pipelines) {
					pass.setPipeline(pipeline);
				}
				pass.end();
			}
			device.queue.submit([encoder.finish()]);
		} catch {
			// a lost device mid-warm-up: the draws will rebuild on the new one
		}
	}

	/**
	 * The 1×1 colour + depth-stencil pair a warm-up pass binds for one
	 * target shape, built once per shape.
	 * @param {string} format - colour format
	 * @param {number} sampleCount - sample count
	 * @returns {{colorView: GPUTextureView, depthView: GPUTextureView}} the views
	 * @ignore
	 * @internal
	 */
	_scratchTarget(format, sampleCount) {
		const key = `${format}|${sampleCount}`;
		let scratch = this.scratchTargets.get(key);
		if (scratch === undefined) {
			const color = this.device.createTexture({
				label: "melonJS warm-up target",
				size: [1, 1],
				format,
				sampleCount,
				usage: GPUTextureUsage.RENDER_ATTACHMENT,
			});
			const depth = this.device.createTexture({
				label: "melonJS warm-up depth",
				size: [1, 1],
				format: DEPTH_STENCIL_FORMAT,
				sampleCount,
				usage: GPUTextureUsage.RENDER_ATTACHMENT,
			});
			scratch = {
				color,
				depth,
				colorView: color.createView(),
				depthView: depth.createView(),
			};
			this.scratchTargets.set(key, scratch);
		}
		return scratch;
	}

	/**
	 * Assemble a pipeline descriptor.
	 *
	 * Split out of `get()` so the descriptor can be read on its own — it is
	 * long, and every field in it is load-bearing for cache correctness: a
	 * pipeline built from a descriptor that differs from the one a draw would
	 * have produced is worse than no cache entry at all, because the draw
	 * silently builds a second one under a key nothing will hit again.
	 * @param {string} key - the cache key, used as the label
	 * @param {string} shaderKey - the module family
	 * @param {string} topology - portable topology name
	 * @param {string} blendMode - blend mode (normalized here)
	 * @param {boolean} premultipliedAlpha - source premultiplication flag
	 * @param {string} stencilMode - stencil mode
	 * @param {object|undefined} meshState - mesh pass state
	 * @param {string} format - colour target format
	 * @param {number} sampleCount - pass sample count
	 * @returns {GPURenderPipelineDescriptor} the descriptor
	 * @ignore
	 * @internal
	 */
	_descriptor(
		key,
		shaderKey,
		topology,
		blendMode,
		premultipliedAlpha,
		stencilMode,
		meshState,
		format,
		sampleCount,
	) {
		const blend = normalizeBlendMode(blendMode);
		const pma = premultipliedAlpha !== false;
		const stencil = STENCIL_STATES[stencilMode] ?? STENCIL_STATES.none;
		// registered families may alias a built-in vertex layout (effect
		// blits ride the frozen quad layout)
		const vertexLayout = this.vertexLayouts.get(
			this.vertexLayoutAliases.get(shaderKey) ?? shaderKey,
		);
		const primitive = {
			topology,
			stripIndexFormat: topology.endsWith("-strip") ? "uint32" : undefined,
		};
		if (meshState) {
			primitive.cullMode = meshState.cullMode;
			primitive.frontFace = meshState.frontFace;
		}
		// booleans are not valid override values in the WebGPU API — the
		// constants record takes numbers, and 0/1 specialize a `bool` override
		const fogFlag = meshState?.fog === true ? 1 : 0;
		return {
			label: `melonJS ${key}`,
			layout: this.pipelineLayouts[shaderKey],
			vertex: {
				module: this.modules[shaderKey],
				entryPoint: "vertex_main",
				buffers: vertexLayout ?? [],
				...(meshState ? { constants: { enable_fog: fogFlag } } : {}),
			},
			fragment: {
				module: this.modules[shaderKey],
				entryPoint: "fragment_main",
				...(meshState ? { constants: { enable_fog: fogFlag } } : {}),
				targets: [
					{
						format,
						blend:
							shaderKey === "clear" ? undefined : gpuBlendState(blend, pma),
						writeMask: stencil.colorWriteMask,
					},
				],
			},
			primitive,
			depthStencil: {
				format: DEPTH_STENCIL_FORMAT,
				// `!== false`, not `!!`: mesh draws that never set the field (and
				// every bare `{cullMode, frontFace}` literal) must keep writing
				// depth exactly as they did before the axis existed
				depthWriteEnabled: meshState ? meshState.depthWrite !== false : false,
				// "always" IS the depth test switched off: every fragment
				// passes, whatever is already in the buffer. The 2D tier
				// reaches it by having no `meshState` at all; a mesh reaches
				// it by asking, which is what `Mesh#depthTest = false` does.
				depthCompare:
					meshState && meshState.depthTest !== false ? "less-equal" : "always",
				stencilFront: stencil.stencil,
				stencilBack: stencil.stencil,
				stencilReadMask: stencil.readMask,
				stencilWriteMask: stencil.writeMask,
			},
			multisample: { count: sampleCount },
		};
	}

	/**
	 * drop every cached pipeline (device loss — the whole cache object is
	 * rebuilt by the renderer's restore path, this exists for symmetry)
	 */
	clear() {
		this.pipelines.clear();
		// warm-ups still compiling belong to the device being dropped. The
		// generation bump keeps those out of the emptied cache; the queued
		// ones are settled here so nothing awaiting them waits forever
		this.generation++;
		for (const job of this.warmQueue.splice(0)) {
			job.resolve(undefined);
		}
		this.pending.clear();
		this.touchQueue.clear();
		for (const scratch of this.scratchTargets.values()) {
			scratch.color.destroy?.();
			scratch.depth.destroy?.();
		}
		this.scratchTargets.clear();
	}
}
