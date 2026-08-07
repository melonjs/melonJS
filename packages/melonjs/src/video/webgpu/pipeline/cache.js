import blitWGSL from "../shaders/blit.wgsl";
import clearWGSL from "../shaders/clear.wgsl";
import primitiveWGSL from "../shaders/primitive.wgsl";
import quadWGSL from "../shaders/quad.wgsl";
import { CLEAR_UNIFORM_SIZE, FRAME_UNIFORM_SIZE } from "./bindgroups.js";

/**
 * Texture slots per quad draw segment — the quad family batches quads
 * across up to this many distinct textures before a flush is forced (the
 * GL sampler-ladder equivalent). 8 texture + 8 sampler bindings stays
 * comfortably inside WebGPU's base limits (16 sampled textures / 16
 * samplers per stage) with headroom for the effect families' samplers.
 * @ignore
 */
export const MAX_QUAD_TEXTURES = 8;

/**
 * The depth-stencil attachment format every pass and every pipeline of this
 * backend declares. Attached from day one — masks use the stencil half now,
 * meshes will use the depth half — because a pipeline's depthStencil state
 * must match the pass attachment, and adding it later would invalidate
 * every cached pipeline.
 * @ignore
 */
export const DEPTH_STENCIL_FORMAT = "depth24plus-stencil8";

/**
 * Blend-mode → GPUBlendState mapping, the pipeline-state port of the GL
 * blendEquation/blendFunc table in `WebGLRenderer.setBlendMode`. Factors
 * are ignored by the min/max operations per spec, matching the GL
 * `MIN`/`MAX` + `(ONE, ONE)` setup for darken/lighten.
 * @param {string} mode - normalized blend mode
 * @param {boolean} premultipliedAlpha - whether sources are premultiplied
 * @returns {GPUBlendState|undefined} the blend state, or undefined for "none" (replace)
 * @ignore
 */
function blendStateFor(mode, premultipliedAlpha) {
	const src = premultipliedAlpha ? "one" : "src-alpha";
	let component;
	switch (mode) {
		case "none":
			return undefined;
		case "additive":
			component = { operation: "add", srcFactor: src, dstFactor: "one" };
			break;
		case "multiply":
			component = {
				operation: "add",
				srcFactor: "dst",
				dstFactor: "one-minus-src-alpha",
			};
			break;
		case "screen":
			component = {
				operation: "add",
				srcFactor: "one",
				dstFactor: "one-minus-src",
			};
			break;
		case "darken":
			component = { operation: "min", srcFactor: "one", dstFactor: "one" };
			break;
		case "lighten":
			component = { operation: "max", srcFactor: "one", dstFactor: "one" };
			break;
		default:
			// "normal" — (premultiplied) source-over
			component = {
				operation: "add",
				srcFactor: src,
				dstFactor: "one-minus-src-alpha",
			};
			break;
	}
	return { color: component, alpha: component };
}

/**
 * Normalize a user-facing blend-mode string to a cache-key token — the
 * same collapsing the WebGL backend applies ("add"/"lighter" → additive,
 * unknown → normal).
 * @param {string} mode - blend mode as set through `setBlendMode`
 * @returns {string} normalized token
 * @ignore
 */
export function normalizeBlendMode(mode) {
	switch (mode) {
		case "none":
		case "multiply":
		case "screen":
		case "darken":
		case "lighten":
		case "normal":
			return mode;
		case "additive":
		case "add":
		case "lighter":
			return "additive";
		default:
			return "normal";
	}
}

/**
 * Stencil-mode → depthStencil/colorWriteMask pipeline states, realizing the
 * GL stencil mask machinery (`setMask`/`clearMask`) as pipeline variants:
 * - "none"  — stencil ignored (default 2D drawing)
 * - "write" — the mask write phase: color writes off, every fragment
 *   increments the stencil (GL's `colorMask(false) + stencilOp INCR`)
 * - "test"  — the masked render phase: fragments pass only where stencil
 *   equals the dynamic `setStencilReference` (GL's `stencilFunc(EQUAL, ref)`)
 * @ignore
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
		let key = this.registeredModules.get(code);
		if (typeof key === "undefined") {
			key = `effect:${this.registeredModules.size}`;
			this.registeredModules.set(code, key);
			this.modules[key] = this.device.createShaderModule({
				label: options.label ?? `melonJS ${key} shader`,
				code,
			});
			this.pipelineLayouts[key] = this.device.createPipelineLayout({
				bindGroupLayouts: options.bindGroupLayouts ?? [
					this.frameLayout,
					this.materialLayout,
				],
			});
			this.vertexLayoutAliases.set(key, options.vertexLayoutKey ?? "quad");
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
	 * Fetch (building on first use) the pipeline for the given state tuple.
	 * @param {string} shaderKey - "quad" | "primitive" | "clear"
	 * @param {string} topology - portable topology name ("triangle-list", …)
	 * @param {string} blendMode - blend mode (normalized internally)
	 * @param {boolean} premultipliedAlpha - source premultiplication flag
	 * @param {string} [stencilMode="none"] - "none" | "write" | "test" | "tag" | "mark"
	 * @param {{cullMode: string, frontFace: string}} [meshState] - mesh pass
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
		const blend = normalizeBlendMode(blendMode);
		const pma = premultipliedAlpha !== false;
		let key = `${shaderKey}|${topology}|${blend}|${pma ? 1 : 0}|${stencilMode}|${this.format}|${this.sampleCount}`;
		if (meshState) {
			key += `|mesh:${meshState.cullMode}:${meshState.frontFace}`;
		}
		let pipeline = this.pipelines.get(key);
		if (typeof pipeline === "undefined") {
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
			pipeline = this.device.createRenderPipeline({
				label: `melonJS ${key}`,
				layout: this.pipelineLayouts[shaderKey],
				vertex: {
					module: this.modules[shaderKey],
					entryPoint: "vertex_main",
					buffers: vertexLayout ?? [],
				},
				fragment: {
					module: this.modules[shaderKey],
					entryPoint: "fragment_main",
					targets: [
						{
							format: this.format,
							blend:
								shaderKey === "clear" ? undefined : blendStateFor(blend, pma),
							writeMask: stencil.colorWriteMask,
						},
					],
				},
				primitive,
				depthStencil: {
					format: DEPTH_STENCIL_FORMAT,
					depthWriteEnabled: !!meshState,
					depthCompare: meshState ? "less-equal" : "always",
					stencilFront: stencil.stencil,
					stencilBack: stencil.stencil,
					stencilReadMask: stencil.readMask,
					stencilWriteMask: stencil.writeMask,
				},
				multisample: { count: this.sampleCount },
			});
			this.pipelines.set(key, pipeline);
		}
		return pipeline;
	}

	/**
	 * drop every cached pipeline (device loss — the whole cache object is
	 * rebuilt by the renderer's restore path, this exists for symmetry)
	 */
	clear() {
		this.pipelines.clear();
	}
}
