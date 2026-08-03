/**
 * The WebGPU realization of a ShaderEffect at draw time: building the
 * device-scoped state (module registration, group-3 layout, resident
 * textures) lazily and per pipeline-cache epoch, and producing — per bind —
 * the group-3 bind group plus dynamic offsets over a fresh uniform
 * snapshot.
 *
 * Snapshot-per-bind is a correctness requirement, not a convenience:
 * `queue.writeBuffer` data executes before EVERY draw recorded in the
 * frame, so an effect bound twice in one frame with different uniform
 * values (a shared effect on two renderables, draw-time mutation) must
 * give each bind its own bytes — exactly the vertex arena's rationale,
 * applied to uniforms.
 * @ignore
 */

/**
 * round up to a power-of-two alignment
 * @ignore
 */
function alignUp(value, alignment) {
	return (value + alignment - 1) & ~(alignment - 1);
}

/**
 * byte size of the engine MEBuiltins struct (3×vec2f, 16-byte rounded)
 * @ignore
 */
const ME_SIZE = 32;

/**
 * (Re)build the device-scoped GPU state of a WGSL effect realization —
 * called lazily on first bind and again after a device loss (detected via
 * the pipeline-cache epoch).
 * @param {import("./webgpu_renderer.js").default} renderer - the renderer
 * @param {import("../effects/wgsl_realization.js").default} realization - the effect's WGSL realization
 * @ignore
 */
function buildEffectGPU(renderer, effect, realization) {
	const cache = renderer.pipelineCache;
	const bindings = realization.builtinBindings;
	const builtins = realization.builtins;
	const hasUniform = realization.structSize > 0;
	const hasME = builtins.noiseUV;

	// ---- the group-3 layout, shared per shape signature ------------------
	const entries = [];
	const signatureParts = [];
	if (hasUniform) {
		entries.push({
			binding: 0,
			visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
			buffer: {
				type: "uniform",
				hasDynamicOffset: true,
				minBindingSize: realization.structSize,
			},
		});
		signatureParts.push(`u${realization.structSize}`);
	}
	for (const texture of realization.textures) {
		entries.push({
			binding: texture.binding,
			visibility: GPUShaderStage.FRAGMENT,
			texture: {},
		});
		entries.push({
			binding: texture.samplerBinding,
			visibility: GPUShaderStage.FRAGMENT,
			sampler: {},
		});
		signatureParts.push(`t${texture.binding}`);
	}
	if (hasME) {
		entries.push({
			binding: bindings.me,
			visibility: GPUShaderStage.VERTEX,
			buffer: {
				type: "uniform",
				hasDynamicOffset: true,
				minBindingSize: ME_SIZE,
			},
		});
		signatureParts.push(`me${bindings.me}`);
	}
	if (builtins.screenTexture) {
		entries.push({
			binding: bindings.screenTexture,
			visibility: GPUShaderStage.FRAGMENT,
			texture: {},
		});
		signatureParts.push(`st${bindings.screenTexture}`);
		if (builtins.screenSamplerClamp) {
			entries.push({
				binding: bindings.screenSamplerClamp,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {},
			});
			// every entry variant must contribute a signature token, or two
			// different shapes share one cached layout and bind groups break
			signatureParts.push("sc");
		}
		if (builtins.screenSamplerRepeat) {
			entries.push({
				binding: bindings.screenSamplerRepeat,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {},
			});
			signatureParts.push("sr");
		}
	}

	const hasEffectGroup = entries.length > 0;
	let effectLayout = null;
	let layouts;
	if (hasEffectGroup) {
		effectLayout = cache.getEffectLayout(signatureParts.join("|"), entries);
		// positional through group 3: the reserved lights slot (group 2)
		// interposes the shared empty layout
		layouts = [
			cache.frameLayout,
			cache.materialLayout,
			cache.emptyLayout,
			effectLayout,
		];
	} else {
		layouts = [cache.frameLayout, cache.materialLayout];
	}

	// identical module text (clones, same-body effects) registers once and
	// shares every pipeline; the shape signature being derived from that
	// same text keeps the pipeline layout consistent per key
	const key = cache.registerShader(realization.code, {
		bindGroupLayouts: layouts,
		vertexLayoutKey: "quad",
		label: "melonJS effect shader",
	});

	// WGSL validation is asynchronous and never throws: a body that parsed
	// but fails compilation would otherwise invalidate every pass drawing
	// it, dropping whole frames forever. Surface it and disable the effect
	// — the same warn-and-disable contract as a missing-language body.
	// (Fire-and-forget: draws recorded before the result resolve harmlessly
	// against the invalid pipeline; once disabled, the effect is filtered.)
	const module = cache.modules?.[key];
	if (typeof module?.getCompilationInfo === "function") {
		module
			.getCompilationInfo()
			.then((info) => {
				const errors = info.messages.filter((message) => {
					return message.type === "error";
				});
				if (errors.length > 0) {
					console.warn(
						`ShaderEffect: WGSL compilation failed — effect disabled\n${errors
							.map((message) => {
								return `  line ${message.lineNum}: ${message.message}`;
							})
							.join("\n")}`,
					);
					effect.enabled = false;
					realization.valid = false;
					realization.releaseGPU();
				}
			})
			.catch(() => {});
	}

	// the per-bind snapshot: uniform struct + ME block share ONE arena
	// region (dynamic offsets must each be minUniformBufferOffsetAlignment
	// aligned, so the ME slice starts at the next aligned boundary)
	const uniformAlignment =
		renderer.device.limits?.minUniformBufferOffsetAlignment ?? 256;
	const meLocalOffset = hasUniform
		? alignUp(realization.structSize, uniformAlignment)
		: 0;
	const snapshotSize = hasME
		? meLocalOffset + ME_SIZE
		: hasUniform
			? realization.structSize
			: 0;

	realization.gpu = {
		epoch: cache.epoch,
		key,
		hasEffectGroup,
		effectLayout,
		hasUniform,
		hasME,
		uniformAlignment,
		meLocalOffset,
		snapshotSize,
		// per-entry resident textures for static setTexture sources
		residentTextures: new Map(),
		bindGroup: null,
		bindKey: "",
		invalidateBindGroup() {
			this.bindGroup = null;
			this.bindKey = "";
		},
	};
}

/**
 * upload a static setTexture source into a resident effect-owned texture
 * @ignore
 */
function residentTexture(renderer, gpu, name, entry) {
	let resident = gpu.residentTextures.get(name);
	if (typeof resident === "undefined" || resident.image !== entry.image) {
		if (typeof resident !== "undefined") {
			renderer.retireTexture(resident.texture);
		}
		const width = entry.image.width || 1;
		const height = entry.image.height || 1;
		const texture = renderer.device.createTexture({
			label: "melonJS effect texture",
			size: [width, height],
			format: "rgba8unorm",
			usage:
				GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_DST |
				GPUTextureUsage.RENDER_ATTACHMENT,
		});
		renderer.device.queue.copyExternalImageToTexture(
			{ source: entry.image },
			// effect inputs keep raw texel values (GL parity: uploaded with
			// premultiply OFF)
			{ texture, premultipliedAlpha: false },
			[width, height],
		);
		resident = { image: entry.image, texture, view: texture.createView() };
		gpu.residentTextures.set(name, resident);
	}
	return resident;
}

/**
 * Prepare an effect for a draw: ensure device state, snapshot the uniform
 * mirror(s) into the effect uniform arena, and return the pipeline family
 * key plus the group-3 binding for the pass.
 * @param {import("./webgpu_renderer.js").default} renderer - the renderer
 * @param {import("../effects/shadereffect.js").default} effect - the effect to bind
 * @returns {{key: string, hasEffectGroup: boolean, bindGroup: GPUBindGroup|null, dynamicOffsets: number[]}|null}
 *   the binding, or null when the effect has no WGSL realization
 * @ignore
 */
export function prepareEffectBinding(renderer, effect) {
	const realization = effect.wgslRealization;
	if (typeof realization === "undefined" || !realization.valid) {
		return null;
	}
	if (
		realization.gpu === null ||
		realization.gpu.epoch !== renderer.pipelineCache.epoch
	) {
		buildEffectGPU(renderer, effect, realization);
	}
	const gpu = realization.gpu;
	if (!gpu.hasEffectGroup) {
		return {
			key: gpu.key,
			hasEffectGroup: false,
			bindGroup: null,
			dynamicOffsets: [],
		};
	}

	// ---- snapshot the CPU mirrors into a fresh arena region --------------
	const dynamicOffsets = [];
	let region = null;
	if (gpu.snapshotSize > 0) {
		region = renderer.effectUniformArena.alloc(
			gpu.snapshotSize,
			gpu.uniformAlignment,
		);
		if (gpu.hasUniform) {
			renderer.device.queue.writeBuffer(
				region.buffer,
				region.offset,
				realization.cpu,
				0,
				realization.structSize,
			);
			dynamicOffsets.push(region.offset);
		}
		if (gpu.hasME) {
			renderer.device.queue.writeBuffer(
				region.buffer,
				region.offset + gpu.meLocalOffset,
				realization.meMirror.buffer,
				0,
				ME_SIZE,
			);
			dynamicOffsets.push(region.offset + gpu.meLocalOffset);
		}
	}

	// ---- (re)build the bind group when any referenced resource moved ----
	const capture = renderer.captureTexture;
	const bindKey = [
		region === null ? "-" : region.buffer.label,
		// only screen_texture consumers key on the capture — a capture
		// reallocation must not rebuild unrelated effects' bind groups
		realization.builtins.screenTexture ? (capture?.generation ?? -1) : -1,
		gpu.residentTextures.size,
	].join("|");
	let stale = gpu.bindGroup === null || gpu.bindKey !== bindKey;
	// a live extra texture (frame capture passed via setTexture) re-keys on
	// its own generation
	if (!stale) {
		for (const entry of effect._extraTextures.values()) {
			if (entry.live && entry.image.generation !== entry.boundGeneration) {
				stale = true;
				break;
			}
		}
	}
	if (stale) {
		const entries = [];
		if (gpu.hasUniform) {
			entries.push({
				binding: 0,
				resource: { buffer: region.buffer, size: realization.structSize },
			});
		}
		for (const texture of realization.textures) {
			const entry = effect._extraTextures.get(texture.name);
			let view;
			if (typeof entry === "undefined") {
				// declared but never set: bind the renderer's 1×1 stub so the
				// bind group stays valid (samples transparent black)
				view = renderer.getStubTextureView();
			} else if (entry.live === true) {
				view = entry.image.view ?? renderer.getStubTextureView();
				entry.boundGeneration = entry.image.generation;
			} else {
				view = residentTexture(renderer, gpu, texture.name, entry).view;
			}
			entries.push({ binding: texture.binding, resource: view });
			entries.push({
				binding: texture.samplerBinding,
				resource: renderer.textureStore.getSampler(
					"linear",
					entry?.repeat ?? "no-repeat",
				),
			});
		}
		if (gpu.hasME) {
			entries.push({
				binding: realization.builtinBindings.me,
				resource: { buffer: region.buffer, size: ME_SIZE },
			});
		}
		if (realization.builtins.screenTexture) {
			entries.push({
				binding: realization.builtinBindings.screenTexture,
				resource: capture?.view ?? renderer.getStubTextureView(),
			});
			if (realization.builtins.screenSamplerClamp) {
				entries.push({
					binding: realization.builtinBindings.screenSamplerClamp,
					resource: renderer.textureStore.getSampler("linear", "no-repeat"),
				});
			}
			if (realization.builtins.screenSamplerRepeat) {
				entries.push({
					binding: realization.builtinBindings.screenSamplerRepeat,
					resource: renderer.textureStore.getSampler("linear", "repeat"),
				});
			}
		}
		gpu.bindGroup = renderer.device.createBindGroup({
			label: "melonJS effect binding",
			layout: gpu.effectLayout,
			entries,
		});
		gpu.bindKey = bindKey;
	}

	return {
		key: gpu.key,
		hasEffectGroup: true,
		bindGroup: gpu.bindGroup,
		dynamicOffsets,
	};
}
