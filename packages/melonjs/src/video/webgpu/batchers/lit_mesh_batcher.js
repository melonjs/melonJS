import state from "../../../state/state.ts";
import { buildLitMeshVertexData } from "../../gpu/meshvertex.ts";
// the lighting math modules are pure CPU code shared with the GL backend
// (published std140 layout, no GL calls)
import { packMeshLights } from "../../webgl/lighting/pack3d.ts";
import {
	BLOCK3D_BYTES,
	BLOCK3D_FLOATS,
	writeLight3dBlock,
} from "../../webgl/lighting/std140.ts";
import { LIT_INSTANCED } from "../shaders/mesh-instanced.js";
import litMeshWGSL from "../shaders/mesh-lit.wgsl";
import WebGPUMeshBatcher from "./mesh_batcher.js";

// ambient used when a lit mesh is drawn with no active 3D lights at all —
// render it fullbright (white ambient) rather than dark, so a `lit` mesh in
// a scene without lights still looks like the unlit path.
const WHITE_AMBIENT = new Float32Array([1, 1, 1]);

/**
 * The WebGPU lit mesh batcher — meshes shaded by the active stage's
 * {@link Light3d} lights (half-Lambert diffuse from directional lights +
 * ambient), the port of the GL `LitMeshBatcher`:
 *
 * - adds the `aNormal` vertex attribute (48-byte layout vs 36) and the lit
 *   shader family; meshes opt in via `mesh.lit`, so unlit meshes keep the
 *   lean base batcher and pay nothing for lighting
 * - the std140 `Light3dBlock` binds at group 2 with a dynamic offset. The
 *   GL batcher re-packs and dirty-compares per draw
 *   (`UniformBlock.upload`); here a change lands in a FRESH arena region
 *   (queue-write law — an in-place write would retroactively re-light
 *   draws already recorded this frame), and an unchanged rig re-uses the
 *   frame's existing snapshot at zero upload cost
 * @augments WebGPUMeshBatcher
 * @category Rendering
 */
export default class WebGPULitMeshBatcher extends WebGPUMeshBatcher {
	/**
	 * @override
	 */
	init(renderer, settings) {
		// a new device invalidates the device-scoped lights layout — drop
		// it so it is recreated below (base init sets this.device)
		if (renderer.device !== this.device) {
			this.lightsLayout = undefined;
		}
		super.init(renderer, settings);
		// the base init may have short-circuited on an already-registered
		// module (never calling bindGroupLayoutList) — the snapshot path
		// still needs a live layout on THIS instance
		this.ensureLightsLayout();

		// CPU staging for the std140 block + the bytes of the frame's last
		// snapshot (the dirty compare)
		this.blockData = new Float32Array(BLOCK3D_FLOATS);
		this.uploadedBlock = new Float32Array(BLOCK3D_FLOATS);
		// light-block bind group per arena page (pages persist across frames)
		this.lightBindGroups = new Map();
		// the current snapshot binding: {bindGroup, dynamicOffset, frameId}
		this.lightBinding = null;
	}

	/**
	 * @override
	 * @ignore
	 */
	defaultSettings() {
		const settings = super.defaultSettings();
		settings.shaderKey = "meshLit";
		return settings;
	}

	/**
	 * @override
	 * @ignore
	 */
	/**
	 * the lit tier's instanced variant: its geometry attributes run to
	 * location 3 (the normal), so the instance slots start at 4
	 * @ignore
	 */
	instancedVariant() {
		return LIT_INSTANCED;
	}

	shaderSource() {
		return litMeshWGSL;
	}

	/** add the normal attribute on top of the base layout. @ignore */
	attributeLayout() {
		const attributes = super.attributeLayout();
		attributes.push({
			// aNormal: model-space on the retained path (the shader rotates
			// it), world-space on the accumulated path (identity model)
			name: "aNormal",
			format: "float32x3",
			offset: 9 * Float32Array.BYTES_PER_ELEMENT,
		});
		return attributes;
	}

	/**
	 * build the light-block layout once per device (init drops it when the
	 * device changes)
	 * @ignore
	 */
	ensureLightsLayout() {
		if (typeof this.lightsLayout === "undefined") {
			this.lightsLayout = this.device.createBindGroupLayout({
				label: "melonJS light3d block",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.FRAGMENT,
						buffer: {
							type: "uniform",
							hasDynamicOffset: true,
							minBindingSize: BLOCK3D_BYTES,
						},
					},
				],
			});
		}
		return this.lightsLayout;
	}

	/**
	 * the lit family swaps the group-2 filler for the light-block layout
	 * @override
	 * @ignore
	 */
	bindGroupLayoutList(cache) {
		return [
			cache.frameLayout,
			cache.materialLayout,
			this.ensureLightsLayout(),
			this.meshLayout,
		];
	}

	/** push the 12-float lit vertex, appending the world-space normal. @ignore */
	pushVertex(vertexData, x, y, z, u, v, color, mesh, i3) {
		const n = mesh.normals;
		vertexData.pushMeshLit(
			x,
			y,
			z,
			u,
			v,
			color,
			n ? n[i3] : 0,
			n ? n[i3 + 1] : 0,
			n ? n[i3 + 2] : 0,
		);
	}

	/**
	 * Same as the base layout plus the model-space normal (zero-normal
	 * guarded), via the shared neutral builder — see `gpu/meshvertex.ts`.
	 * @param {object} mesh - the mesh to read geometry from
	 * @param {Float32Array} out - destination scratch
	 * @returns {number} number of floats written
	 * @override
	 * @ignore
	 */
	buildRetainedVertexData(mesh, out) {
		return buildLitMeshVertexData(mesh, out, this.vertexSize);
	}

	/**
	 * Refresh the light snapshot before a draw. Per draw and not per bind,
	 * for the same reason as the GL batcher: `setBatcher` early-returns
	 * when this batcher is already current, so a purely-lit scene would
	 * otherwise shade every frame with its first frame's lights.
	 *
	 * Cost when the rig is static: one pack plus one array compare, zero
	 * queue writes — the frame's existing snapshot region is re-bound.
	 * With NO lights at all a white ambient keeps a `lit` mesh fullbright
	 * (matching the unlit path); an ambient-only scene uses its real
	 * ambient.
	 * @override
	 * @ignore
	 */
	updatePassState() {
		const renderer = this.renderer;
		const stage = state.current();
		const lit = packMeshLights(stage ? stage._activeLights3d : null);
		const a = lit.ambient;
		const hasLight = lit.count > 0 || a[0] > 0 || a[1] > 0 || a[2] > 0;
		writeLight3dBlock(this.blockData, {
			count: lit.count,
			posRange: lit.posRange,
			dirCone: lit.dirCone,
			colorInner: lit.colorInner,
			ambient: hasLight ? a : WHITE_AMBIENT,
		});

		// an unchanged block within the frame re-uses its snapshot
		if (
			this.lightBinding !== null &&
			this.lightBinding.frameId === renderer.frameId
		) {
			const prev = this.uploadedBlock;
			const next = this.blockData;
			let dirty = false;
			for (let i = 0; i < BLOCK3D_FLOATS; i++) {
				if (prev[i] !== next[i]) {
					dirty = true;
					break;
				}
			}
			if (dirty === false) {
				return;
			}
		}

		// a change (or a new frame — the arenas were reset) snapshots into
		// a fresh region: draws already recorded keep their own bytes
		const device = this.device;
		const region = renderer.effectUniformArena.alloc(
			BLOCK3D_BYTES,
			device.limits.minUniformBufferOffsetAlignment,
		);
		device.queue.writeBuffer(
			region.buffer,
			region.offset,
			this.blockData.buffer,
			0,
			BLOCK3D_BYTES,
		);
		let bindGroup = this.lightBindGroups.get(region.buffer);
		if (typeof bindGroup === "undefined") {
			bindGroup = device.createBindGroup({
				label: "melonJS light3d block",
				layout: this.lightsLayout,
				entries: [
					{
						binding: 0,
						resource: { buffer: region.buffer, size: BLOCK3D_BYTES },
					},
				],
			});
			this.lightBindGroups.set(region.buffer, bindGroup);
		}
		this.lightBinding = {
			bindGroup,
			dynamicOffset: region.offset,
			frameId: renderer.frameId,
		};
		this.uploadedBlock.set(this.blockData);
	}

	/**
	 * lit draws bind the light block at group 2
	 * @override
	 * @ignore
	 */
	bindLights(pass) {
		// a stale or missing snapshot (a flush outside the drawMesh bracket,
		// a new frame) refreshes first — the arena region it pointed into
		// was reset
		if (
			this.lightBinding === null ||
			this.lightBinding.frameId !== this.renderer.frameId
		) {
			this.updatePassState();
		}
		pass.setBindGroup(2, this.lightBinding.bindGroup, [
			this.lightBinding.dynamicOffset,
		]);
	}

	/**
	 * @override
	 */
	reset() {
		super.reset();
		this.lightBindGroups.clear();
		this.lightBinding = null;
	}
}
