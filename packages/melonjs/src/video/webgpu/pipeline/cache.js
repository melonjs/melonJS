import clearWGSL from "../shaders/clear.wgsl";
import primitiveWGSL from "../shaders/primitive.wgsl";
import quadWGSL from "../shaders/quad.wgsl";
import { CLEAR_UNIFORM_SIZE, FRAME_UNIFORM_SIZE } from "./bindgroups.js";

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

		// ---- shader modules ----------------------------------------------
		this.modules = {
			quad: device.createShaderModule({
				label: "melonJS quad shader",
				code: quadWGSL,
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
	 * @param {string} shaderKey - "quad" | "primitive"
	 * @param {number} stride - vertex byte stride
	 * @param {{format: string, offset: number}[]} attributes - frozen records
	 */
	registerVertexLayout(shaderKey, stride, attributes) {
		this.vertexLayouts.set(shaderKey, {
			arrayStride: stride,
			attributes: attributes.map((a, i) => {
				return {
					format: a.format,
					offset: a.offset,
					shaderLocation: i,
				};
			}),
		});
	}

	/**
	 * Fetch (building on first use) the pipeline for the given state tuple.
	 * @param {string} shaderKey - "quad" | "primitive" | "clear"
	 * @param {string} topology - portable topology name ("triangle-list", …)
	 * @param {string} blendMode - blend mode (normalized internally)
	 * @param {boolean} premultipliedAlpha - source premultiplication flag
	 * @param {string} [stencilMode="none"] - "none" | "write" | "test" | "tag" | "mark"
	 * @returns {GPURenderPipeline} the pipeline
	 */
	get(
		shaderKey,
		topology,
		blendMode,
		premultipliedAlpha,
		stencilMode = "none",
	) {
		const blend = normalizeBlendMode(blendMode);
		const pma = premultipliedAlpha !== false;
		const key = `${shaderKey}|${topology}|${blend}|${pma ? 1 : 0}|${stencilMode}|${this.format}|${this.sampleCount}`;
		let pipeline = this.pipelines.get(key);
		if (typeof pipeline === "undefined") {
			const stencil = STENCIL_STATES[stencilMode] ?? STENCIL_STATES.none;
			// registered families may alias a built-in vertex layout (effect
			// blits ride the frozen quad layout)
			const vertexLayout = this.vertexLayouts.get(
				this.vertexLayoutAliases.get(shaderKey) ?? shaderKey,
			);
			pipeline = this.device.createRenderPipeline({
				label: `melonJS ${key}`,
				layout: this.pipelineLayouts[shaderKey],
				vertex: {
					module: this.modules[shaderKey],
					entryPoint: "vertex_main",
					buffers: vertexLayout ? [vertexLayout] : [],
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
				primitive: {
					topology,
					stripIndexFormat: topology.endsWith("-strip") ? "uint32" : undefined,
				},
				depthStencil: {
					format: DEPTH_STENCIL_FORMAT,
					depthWriteEnabled: false,
					depthCompare: "always",
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
