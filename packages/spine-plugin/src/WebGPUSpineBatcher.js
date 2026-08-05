import { SkeletonRendererCore } from "@esotericsoftware/spine-core";
import { TextureAtlas, WebGPUBatcher } from "melonjs";

/**
 * Spine blend mode enum to melonJS blend mode string mapping
 */
const SPINE_BLEND_MODES = ["normal", "additive", "multiply", "screen"];

/**
 * Vertex layout: position(2 × f32) + lightColor(unorm8x4) + uv(2 × f32) +
 * darkColor(unorm8x4) = 24 bytes / 6 float slots. The packed colors ride
 * one 32-bit slot each (the engine quad batcher's packed-tint convention),
 * unpacked by the vertex format — no per-vertex float expansion.
 */
const VERTEX_SIZE = 6;

/**
 * Matches the WebGL SpineBatcher's staging capacity (Spine's own
 * PolygonBatcher size). A single skeleton render command larger than this
 * cannot be split (its indices reference arbitrary vertices), so it is
 * skipped with a one-shot warning — no real skeleton comes close.
 */
const MAX_VERTICES = 10920;

/**
 * The WGSL twin of Spine's official two-colored-textured shader: the
 * tint-black equation
 * `out.rgb = ((tex.a - 1) × dark.a + 1 - tex.rgb) × dark.rgb + tex.rgb × light.rgb`
 * per pixel, with `dark.a` carrying the premultiplied-alpha flag exactly
 * as `SkeletonRendererCore` packs it. Positions arrive in world space
 * (the skeleton root bone carries placement and scale — this batcher
 * ignores `currentTransform`, like its WebGL counterpart), so the vertex
 * stage applies the frame projection only, with the engine's clip-z remap.
 * Packed colors are ARGB uint32s — bytes read back as (B, G, R, A) by the
 * unorm8x4 vertex format, hence the `.bgr` swizzle.
 */
const spineWGSL = `
struct FrameUniforms {
	projection : mat4x4<f32>,
	lineWidth : f32,
};

@group(0) @binding(0) var<uniform> uFrame : FrameUniforms;
@group(1) @binding(0) var uTexture : texture_2d<f32>;
@group(1) @binding(1) var uSampler : sampler;

struct VSOut {
	@builtin(position) position : vec4f,
	@location(0) vLight : vec4f,
	@location(1) vUV : vec2f,
	@location(2) vDark : vec4f,
};

@vertex
fn vertex_main(
	@location(0) aPosition : vec2f,
	@location(1) aLight : vec4f,
	@location(2) aUV : vec2f,
	@location(3) aDark : vec4f,
) -> VSOut {
	var out : VSOut;
	let clip = uFrame.projection * vec4f(aPosition, 0.0, 1.0);
	out.position = vec4f(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
	out.vLight = vec4f(aLight.bgr, aLight.a);
	out.vDark = vec4f(aDark.bgr, aDark.a);
	out.vUV = aUV;
	return out;
}

@fragment
fn fragment_main(in : VSOut) -> @location(0) vec4f {
	let tex = textureSample(uTexture, uSampler, in.vUV);
	let alpha = tex.a * in.vLight.a;
	let rgb = ((tex.a - 1.0) * in.vDark.a + 1.0 - tex.rgb) * in.vDark.rgb
		+ tex.rgb * in.vLight.rgb;
	return vec4f(rgb, alpha);
}
`;

/**
 * A custom melonJS WebGPU batcher rendering Spine skeletons with full
 * two-color tinting — the WebGPU counterpart of the WebGL `SpineBatcher`.
 *
 * Geometry comes from spine-core's backend-neutral `SkeletonRendererCore`:
 * one linked list of render commands per skeleton (positions, UVs, packed
 * light/dark colors, indices, blend mode, texture — clipping already
 * applied, compatible slots already merged). Each command records as one
 * indexed draw: vertices into the frame's vertex arena, indices into the
 * index arena, the texture resolved through the renderer's texture store
 * from the image-backed atlas the canvas asset path already loads.
 * @augments WebGPUBatcher
 * @category Rendering
 */
export default class WebGPUSpineBatcher extends WebGPUBatcher {
	/**
	 * Initialize (or re-initialize after a device loss) the batcher —
	 * settings are rebuilt here so the renderer's device-restore recovery
	 * can re-create every GPU-facing registration with a bare
	 * `batcher.init(renderer)` call, matching the engine's built-ins.
	 * @param {object} renderer - the current WebGPU renderer
	 * @param {object} [settings] - batcher settings override
	 * @ignore
	 */
	init(renderer, settings) {
		super.init(
			renderer,
			settings ?? {
				shaderKey: "spine",
				topology: "triangle-list",
				maxVertices: MAX_VERTICES,
				attributes: [
					{ name: "aPosition", format: "float32x2", offset: 0 },
					{ name: "aLight", format: "unorm8x4", offset: 8 },
					{ name: "aUV", format: "float32x2", offset: 12 },
					{ name: "aDark", format: "unorm8x4", offset: 20 },
				],
			},
		);

		// register the two-color family against this batcher's vertex
		// layout; the default group list (frame globals + material) is
		// exactly what the shader binds. Re-registering against a surviving
		// cache dedupes on the module text; a fresh cache (device loss)
		// re-creates the module and pipeline layout.
		const vertexLayoutKey = this.shaderKey;
		this.shaderKey = renderer.pipelineCache.registerShader(spineWGSL, {
			vertexLayoutKey,
			label: "melonJS spine two-color shader",
		});

		// the backend-neutral skeleton → render-command pass (world
		// vertices, clipping, per-slot colors, command batching)
		this.skeletonRendererCore ??= new SkeletonRendererCore();

		// spine page texture → engine texture-store wrapper. Persistent
		// across device re-inits: the engine's texture cache keys units on
		// wrapper identity, so a fresh map per init would leak stale units.
		this.pageWrappers ??= new Map();

		// CPU index staging (uint32 — the backend's index convention)
		this.indexData = new Uint32Array(MAX_VERTICES * 3);
		this.indexCount = 0;

		// the material bind group the pending vertices were queued under
		this.currentMaterial = null;

		this.overflowWarned = false;
	}

	/**
	 * Resolve a spine page texture to the engine texture-store material
	 * bind group, creating the stable atlas-shaped wrapper on first use.
	 * @param {object} texture - a spine `Texture` (image-backed)
	 * @param {boolean} premultipliedAlpha - the atlas page's pma flag
	 * @returns {GPUBindGroup} the material bind group
	 * @ignore
	 */
	materialFor(texture, premultipliedAlpha) {
		let wrapper = this.pageWrappers.get(texture);
		if (typeof wrapper === "undefined") {
			// a real single-frame TextureAtlas over the page image — the
			// same wrap the engine's own createPattern uses, so the texture
			// cache and store treat it like any engine texture
			const image = texture.getImage();
			wrapper = new TextureAtlas(
				{
					meta: {
						app: "melonJS",
						size: { w: image.width, h: image.height },
						repeat: "no-repeat",
						image: "default",
					},
					frames: [
						{
							filename: "default",
							frame: { x: 0, y: 0, w: image.width, h: image.height },
						},
					],
				},
				image,
			);
			// the store uploads premultiplied unless told otherwise — spine
			// atlases declare their own pma per page
			wrapper.premultipliedAlpha = premultipliedAlpha;
			this.pageWrappers.set(texture, wrapper);
		}
		return this.renderer.textureStore.getBinding(wrapper);
	}

	/**
	 * Render a skeleton: run the neutral geometry pass and record its
	 * command list — one indexed draw per texture/blend-compatible batch.
	 * @param {object} skeleton - the spine Skeleton (posed for this frame)
	 * @param {boolean} premultipliedAlpha - whether the atlas pages are premultiplied
	 */
	drawSkeleton(skeleton, premultipliedAlpha) {
		const renderer = this.renderer;
		for (
			let command = this.skeletonRendererCore.render(
				skeleton,
				premultipliedAlpha,
			);
			command;
			command = command.next
		) {
			if (command.numVertices === 0 || command.numIndices === 0) {
				continue;
			}
			if (command.numVertices >= MAX_VERTICES) {
				// a command's indices reference arbitrary vertices, so it
				// cannot be split — and no real skeleton reaches this size
				if (!this.overflowWarned) {
					this.overflowWarned = true;
					console.warn(
						`Spine plugin: a render command exceeds ${MAX_VERTICES} vertices and was skipped`,
					);
				}
				continue;
			}

			// blend is pipeline state — the renderer flushes pending
			// vertices itself when the mode actually changes
			renderer.setBlendMode(
				SPINE_BLEND_MODES[command.blendMode],
				premultipliedAlpha,
			);

			// a material change (or overflow) draws what is queued first
			const material = this.materialFor(command.texture, premultipliedAlpha);
			if (material !== this.currentMaterial) {
				this.flush();
				this.currentMaterial = material;
			} else if (
				this.vertexData.isFull(command.numVertices) ||
				this.indexCount + command.numIndices > this.indexData.length
			) {
				this.flush();
			}

			this.appendCommand(command);
		}
	}

	/**
	 * Append one render command's geometry to the staging buffers,
	 * rebasing its indices onto the pending vertex count.
	 * @param {object} command - a SkeletonRendererCore render command
	 * @ignore
	 */
	appendCommand(command) {
		const vertexData = this.vertexData;
		const f32 = vertexData.bufferF32;
		const u32 = vertexData.bufferU32;
		const positions = command.positions;
		const uvs = command.uvs;
		const colors = command.colors;
		const darkColors = command.darkColors;

		const base = vertexData.vertexCount;
		let offset = base * VERTEX_SIZE;
		for (let i = 0; i < command.numVertices; i++) {
			const i2 = i * 2;
			f32[offset] = positions[i2];
			f32[offset + 1] = positions[i2 + 1];
			u32[offset + 2] = colors[i];
			f32[offset + 3] = uvs[i2];
			f32[offset + 4] = uvs[i2 + 1];
			u32[offset + 5] = darkColors[i];
			offset += VERTEX_SIZE;
		}
		vertexData.vertexCount += command.numVertices;

		const indices = command.indices;
		let o = this.indexCount;
		for (let i = 0; i < command.numIndices; i++) {
			this.indexData[o++] = base + indices[i];
		}
		this.indexCount = o;
	}

	/**
	 * Record the pending spine vertices as one indexed draw.
	 * @override
	 */
	flush() {
		const vertexData = this.vertexData;
		const vertexCount = vertexData.vertexCount;
		const indexCount = this.indexCount;
		if (vertexCount === 0 || indexCount === 0) {
			return;
		}
		const renderer = this.renderer;
		const device = this.device;
		const pass = renderer.ensurePass();

		const byteLength = vertexCount * this.stride;
		const vertexRegion = renderer.vertexArena.alloc(byteLength);
		device.queue.writeBuffer(
			vertexRegion.buffer,
			vertexRegion.offset,
			vertexData.toUint8(),
			0,
			byteLength,
		);

		const indexBytes = indexCount * 4;
		const indexRegion = renderer.indexArena.alloc(indexBytes);
		device.queue.writeBuffer(
			indexRegion.buffer,
			indexRegion.offset,
			this.indexData.buffer,
			0,
			indexBytes,
		);

		const pipeline = renderer.pipelineCache.get(
			this.shaderKey,
			"triangle-list",
			renderer.currentBlendMode,
			renderer.premultipliedAlpha,
			renderer.stencilMode,
		);
		if (pipeline !== renderer.currentPipeline) {
			pass.setPipeline(pipeline);
			renderer.currentPipeline = pipeline;
		}
		const frame = renderer.currentFrameBinding;
		pass.setBindGroup(0, frame.bindGroup, [frame.dynamicOffset]);
		pass.setBindGroup(1, this.currentMaterial);
		pass.setVertexBuffer(
			0,
			vertexRegion.buffer,
			vertexRegion.offset,
			byteLength,
		);
		pass.setIndexBuffer(
			indexRegion.buffer,
			"uint32",
			indexRegion.offset,
			indexBytes,
		);
		pass.drawIndexed(indexCount);

		vertexData.clear();
		this.indexCount = 0;
	}

	/**
	 * @override
	 */
	reset() {
		super.reset();
		this.indexCount = 0;
		this.currentMaterial = null;
	}
}
