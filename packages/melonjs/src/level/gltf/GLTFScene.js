import { Light3d } from "../../lighting/light3d.ts";
import { getGLTF } from "../../loader/loader.js";
import { boundingRadius } from "../../math/vertex.ts";
import { hasVerticalExtent } from "../../renderable/groundshadow.js";
import InstancedMesh from "../../renderable/instanced_mesh.js";
import Mesh from "../../renderable/mesh.js";
import { writeInstanceTRS } from "../../video/gpu/instancerecord.ts";
import GLTFModel from "./GLTFModel.js";
import { linearToSrgb8 } from "./srgb.js";

/**
 * @classdesc
 * A loadable 3D scene parsed from a glTF / GLB asset. Instances are created
 * and registered with the {@link level} director (usually automatically by
 * the preloader), so a glTF scene loads with the same one-call ergonomics as
 * a Tiled map: `level.load("myScene")`.
 *
 * Each glTF mesh node is instantiated as a {@link Mesh} carrying its own
 * world transform, so the scene's relative scale and layout are preserved.
 * View the result under a `Camera3d` for a coherent perspective.
 */
export default class GLTFScene {
	/**
	 * @param {string} levelId - the glTF/GLB asset name (as preloaded)
	 */
	constructor(levelId) {
		/**
		 * the level/asset name
		 * @type {string}
		 */
		this.name = levelId;
		/**
		 * level format discriminator used by the level director's dispatch
		 * @type {string}
		 */
		this.format = "gltf";
		/**
		 * the parsed scene descriptor (`{ nodes, cameras, lights, bounds }`)
		 * @type {object}
		 */
		this.data = getGLTF(levelId);
	}

	/**
	 * the world-space bounds of the scene (`{ min, max }` in glTF units), or
	 * undefined if the scene failed to load. Handy for framing a `Camera3d`.
	 * @returns {object|undefined}
	 */
	get bounds() {
		return this.data?.bounds;
	}

	/**
	 * the cameras parsed from the glTF scene (each with a world matrix +
	 * perspective parameters), or an empty array.
	 * @returns {Array}
	 */
	get cameras() {
		return this.data?.cameras ?? [];
	}

	/**
	 * Instantiate every glTF mesh node as a `Mesh` in the given container.
	 * Called by the level director on `level.load(...)`.
	 * @param {Container} container - the target container (e.g. `game.world`)
	 * @param {object} [options]
	 * @param {number} [options.scale=1] - pixels per glTF unit (uniform scene scale)
	 * @param {boolean} [options.rightHanded=true] - convert glTF Y-up right-handed
	 * geometry to the engine's Y-down via a rotation (no mirror). See the wiki.
	 * @param {boolean} [options.lights=true] - add the scene's authored
	 * `KHR_lights_punctual` lights — directional suns, point and spot lamps
	 * (plus a soft ambient fill) — to the world as {@link Light3d}
	 * renderables, so the meshes are lit as set up in the authoring tool.
	 * Set false to keep the meshes unlit / manage lighting yourself with
	 * `world.addChild(new Light3d(...))`. Each instantiated light carries
	 * its authored name, so `world.getChildByName("Sun")` finds it for
	 * runtime tuning (day/night cycles, flicker).
	 * @param {number} [options.lightIntensityScale] - multiply each light's
	 * AUTHORED intensity by this factor instead of normalizing it to 1.
	 * glTF stores physical units — lux for suns (a Blender daylight sun is
	 * ~1000+), candela for lamps — which blow out the engine's stylized
	 * half-Lambert shading when used raw, so the default keeps every light
	 * at unit intensity and lets the app tune. With this option the
	 * authored ratios survive: e.g. `0.001` maps a 1000-lux sun to 1 while
	 * a half-strength 500-lux fill lands at 0.5.
	 * @param {boolean} [options.castGroundShadow] - give this scene's meshes a
	 * ground shadow ({@link Mesh#castGroundShadow}), overriding the
	 * application's setting for this scene in both directions; omit it to
	 * inherit. As a scene-wide opt-in it skips nodes with no vertical extent —
	 * a scene's ground plane is exactly that, and shadowing it with itself
	 * smears a blob across the whole floor.
	 * @param {number} [options.shadowGroundY] - world Y of the floor those
	 * shadows land on ({@link Mesh#shadowGroundY}); omit it and each blob sits
	 * at its own object's base at full strength, which is right for a scene
	 * whose props already rest on the ground.
	 */
	addTo(container, options = {}) {
		if (!this.data) {
			return;
		}
		const scale = options.scale ?? 1;
		const rightHanded = options.rightHanded !== false;
		// tri-state on purpose: `undefined` means "the caller said nothing",
		// which falls through to the application setting at draw time
		const castGroundShadow =
			typeof options.castGroundShadow === "boolean"
				? options.castGroundShadow
				: undefined;
		const zSign = rightHanded ? -1 : 1;

		// the scene is lit when it carries ANY shading-capable authored light
		// (directional sun, point or spot lamp) and the caller didn't opt out
		// — meshes then render through the lit batcher. A lamp-only scene must
		// count too, or its instantiated lights would shine on unlit meshes.
		const lit =
			options.lights !== false &&
			(this.data.lights ?? []).some((l) => {
				return (
					l.type === "directional" || l.type === "point" || l.type === "spot"
				);
			});

		// scene meshes carry their own world transform — keep the container
		// from reassigning per-child depth (the GPU depth test resolves
		// occlusion between meshes under Camera3d)
		container.autoDepth = false;

		// Animated asset → keep the node hierarchy intact inside one rig-driven
		// GLTFModel (a parent transform carries its children). Static asset →
		// the flat-mesh path below. The model is named after the asset so it can
		// be retrieved from the world (`world.getChildByName(name)[0]`) to drive
		// playback. Lights are still instantiated (shared block at the end).
		if ((this.data.animations ?? []).length > 0) {
			const model = new GLTFModel(this.data, {
				scale,
				rightHanded,
				lit,
				castGroundShadow,
				shadowGroundY: options.shadowGroundY,
			});
			model.name = this.name;
			container.addChild(model);
			this._addLights(container, zSign, scale, options);
			return;
		}

		for (const node of this.data.nodes) {
			const m = node.world;

			// The node's world placement splits into a CENTER (the matrix
			// translation, in render space) carried by the renderable's
			// pos/depth, and the rotation/scale carried by currentTransform.
			// Why: Camera3d frustum culling and depth sorting key off the
			// renderable's pos — if every mesh stayed at pos (0,0,0) with all
			// placement hidden inside currentTransform, they would all cull as
			// a single point at the world origin and the whole scene would pop
			// in/out together. The rendered geometry is identical either way
			// (`_projectVerticesWorld` adds the pos offset back).
			const cx = m[12] * scale;
			const cy = -m[13] * scale;
			const cz = zSign * m[14] * scale;

			// Conservative world-space bounding radius: the farthest vertex
			// from the node origin, taken through the node's rotation/scale
			// columns and the scene scale. Feeds the renderable's bounds so
			// Camera3d's bounding-sphere test only culls a mesh once its
			// geometry is genuinely outside the view (not just its center).
			const radius = boundingRadius(node.vertices, node.vertexCount, m) * scale;
			// Camera3d derives the cull sphere radius as √(w² + h²) / 2, so a
			// square bounds box of side `radius · √2` yields a sphere of
			// exactly `radius`. Guard against a zero-size (point) box.
			const boxSize = Math.max(radius, 1) * Math.SQRT2;

			// EXT_mesh_gpu_instancing: the node is one geometry stamped out
			// many times (a scattered forest, a crowd). One InstancedMesh
			// draws the lot in a single call instead of N separate meshes,
			// each with its own GPU copy of identical geometry.
			const instances = node.instances;
			// `count: 0` is an authored EMPTY scatter (everything culled at
			// author time) — it must draw zero copies, not one stray prototype
			// at the node origin, so it still becomes an InstancedMesh
			const MeshClass = instances ? InstancedMesh : Mesh;
			const mesh = new MeshClass(0, 0, {
				vertices: node.vertices,
				uvs: node.uvs,
				indices: node.indices,
				normals: node.normals,
				texture: node.image,
				width: boxSize,
				height: boxSize,
				scale,
				normalize: false,
				rightHanded,
				// honor the glTF sampler wrap (default REPEAT) so tiling UVs
				// (UVs outside [0,1]) sample correctly instead of clamping flat
				textureRepeat: node.textureRepeat,
				// honor the glTF sampler magnification filter (nearest for pixel-art)
				textureFilter: node.textureFilter,
				// alpha cutout threshold (glTF alphaMode MASK) — discard fully
				// transparent texels so cutout props (foliage, fences) read crisp
				alphaCutoff: node.alphaCutoff,
				// emissive color (glTF emissiveFactor) — self-illumination so neon /
				// lava / screens glow regardless of scene lighting
				emissive: node.emissive,
				// specular highlight approximated from the material's
				// metallic/roughness factors (#1575)
				specular: node.specular,
				shininess: node.shininess,
				// light this mesh (via the lit batcher) when the scene has lights —
				// unless the material is KHR_materials_unlit (baked lighting, must
				// not be shaded again)
				lit: lit && node.unlit !== true,
				// honor the glTF material's double-sided flag: thin/flat props
				// (coins, fences, foliage) are double-sided and must NOT be
				// back-face culled, or half their faces vanish
				cullBackFaces: node.doubleSided !== true,
				// Ground shadows (#1515). A scene-wide opt-in skips nodes with
				// no vertical extent: a glTF scene ships its ground as a flat
				// plane, and shadowing that with itself smears a blob across
				// the whole floor. Left unset by the caller this stays
				// `undefined`, which is what lets the application-level
				// setting through — passing `false` explicitly opts the scene
				// out of that default.
				castGroundShadow:
					castGroundShadow === true
						? hasVerticalExtent(node.vertices, node.vertexCount)
						: castGroundShadow,
				shadowGroundY: options.shadowGroundY,
			});
			if (instances) {
				fillInstances(mesh, instances);
			}
			// material baseColorFactor → mesh tint, so an untextured solid-color
			// material renders its color instead of the white-pixel fallback.
			// (RGB only; alpha/transparency is a separate feature — the mesh
			// path renders opaque.) Composes with COLOR_0 and the texture: the
			// batcher does factor × vertexColor × texel, matching glTF.
			//
			// The factor is LINEAR per the glTF spec and a tint is 8-bit sRGB,
			// so it has to be encoded rather than scaled by 255 — see
			// `linearToSrgb8`.
			const f = node.baseColorFactor;
			if (f) {
				mesh.tint.setColor(
					linearToSrgb8(f[0]),
					linearToSrgb8(f[1]),
					linearToSrgb8(f[2]),
				);
			}
			// per-vertex colors (COLOR_0) — multiplied by the tint per vertex
			if (node.colors) {
				mesh.vertexColors = node.colors;
			}

			// rotation/scale only — the translation is carried by pos/depth
			const local = m.slice();
			local[12] = 0;
			local[13] = 0;
			local[14] = 0;
			mesh.currentTransform.val.set(local);
			mesh.pos.set(cx, cy);
			mesh.depth = cz;
			mesh.name = node.name;
			container.addChild(mesh);
		}

		this._addLights(container, zSign, scale, options);
	}

	/**
	 * Add the scene's authored lights — directional, point and spot — (plus a soft ambient fill) to
	 * the world as {@link Light3d} renderables, so the meshes are lit by the
	 * same sun set up in the authoring tool (Blender etc.). Shared by the static
	 * and animated paths. The lights are ordinary world children — the level
	 * director's `container.reset()` removes them on the next load, exactly like
	 * {@link Light2d}, so there's nothing to track or tear down here.
	 * @param {Container} container - the target container the lights are added to
	 * @param {number} zSign - the Y-up→Y-down Z bridge sign (rightHanded → -1)
	 * @param {number} scale - the scene's world scale (positions/ranges follow it)
	 * @param {object} options - the `addTo` options (`lights` toggle)
	 * @ignore
	 */
	_addLights(container, zSign, scale, options) {
		if (options.lights === false) {
			return;
		}
		// glTF intensities are physical units (lux for directional, candela for
		// point/spot — often in the thousands), which blow out the stylized
		// half-Lambert shading when used raw. Default: normalize every light to
		// unit intensity and let the app tune. With `lightIntensityScale` the
		// authored values are kept, multiplied by the given factor, so relative
		// light strengths from the authoring tool survive.
		const intensityScale =
			typeof options.lightIntensityScale === "number"
				? options.lightIntensityScale
				: null;
		let added = 0;
		for (const light of this.data.lights ?? []) {
			const d = light.direction;
			// glTF-space → render space: the same Y-down / rightHanded Y/Z
			// bridge the geometry uses, for directions AND positions
			const direction = [d[0], -d[1], zSign * d[2]];
			const intensity =
				intensityScale !== null ? light.intensity * intensityScale : 1;
			let light3d;
			if (light.type === "directional") {
				light3d = new Light3d({
					type: "directional",
					direction,
					color: [light.color[0], light.color[1], light.color[2]],
					intensity,
				});
			} else if (light.type === "point" || light.type === "spot") {
				const p = light.position;
				light3d = new Light3d({
					type: light.type,
					position: [p[0] * scale, -p[1] * scale, zSign * p[2] * scale],
					direction,
					color: [light.color[0], light.color[1], light.color[2]],
					intensity,
					// glTF range is in source units — scale like the geometry.
					// Absent means unbounded in the spec; the engine's quadratic
					// falloff needs a scale, so fall back to the Light3d default
					range:
						typeof light.range === "number" ? light.range * scale : undefined,
					innerConeAngle: light.innerConeAngle,
					outerConeAngle: light.outerConeAngle,
				});
			} else {
				continue;
			}
			// carry the authored name so the app can look the light up for
			// runtime tuning (e.g. `world.getChildByName("Sun")`)
			if (light.name) {
				light3d.name = light.name;
			}
			container.addChild(light3d);
			added++;
		}
		// a soft ambient fill so the shadow side of lit meshes isn't pure black.
		// `KHR_lights_punctual` has no ambient light type, so this is an engine
		// default; only meaningful when the scene actually has directional lights
		// (otherwise the meshes render fullbright / unlit).
		if (added > 0) {
			container.addChild(
				new Light3d({ type: "ambient", color: "#ffffff", intensity: 0.3 }),
			);
		}
	}

	/**
	 * Director cleanup hook (parity with `TMXTileMap.destroy`). Nothing to do —
	 * the meshes and lights are ordinary world children, removed by the
	 * director's `container.reset()` on the next load.
	 * @ignore
	 */
	destroy() {}
}

/**
 * Fill an {@link InstancedMesh}'s records from an
 * `EXT_mesh_gpu_instancing` node's per-instance TRS arrays.
 *
 * The records are written in the node's own (glTF, Y-up, right-handed)
 * space, **verbatim** — no scene scale, no axis bridge. That is not a
 * simplification but the consequence of where the instance transform sits
 * in the chain the shader evaluates:
 *
 *     clip = projection × view × model(group) × instance × vertex
 *
 * The group's model matrix already carries the scene scale and the Y/Z
 * bridge, and it is applied AFTER the instance transform — so an instance
 * expressed in the same space as the vertices comes out placed correctly.
 * Pre-scaling or pre-bridging the records here applies both twice (which
 * put the first version of this forest 26× too far out, and well outside
 * the far plane).
 * @param {InstancedMesh} mesh - the mesh to fill
 * @param {object} instances - `{count, translation, rotation, scale}`
 * @ignore
 */
export function fillInstances(mesh, instances) {
	const { count, translation, rotation, scale } = instances;
	// A negative per-instance scale mirrors the geometry, which inverts its
	// winding — but face culling is decided once per mesh, so those instances
	// would render inside-out. Blender mirrors on linked duplicates produce
	// exactly this, so say so rather than let it look like a modelling error.
	if (scale !== undefined && mesh.cullBackFaces === true) {
		for (let i = 0; i < scale.length; i++) {
			if (scale[i] < 0) {
				console.warn(
					"glTF: EXT_mesh_gpu_instancing has mirrored (negative-scale) instances — face culling is per-mesh, so those instances render inside-out; set `doubleSided` on the material to avoid it",
				);
				break;
			}
		}
	}
	mesh.instanceCount = count;
	const floats = mesh.instanceLayout.floats;
	for (let i = 0; i < count; i++) {
		const t3 = i * 3;
		const r4 = i * 4;
		writeInstanceTRS(
			mesh.instanceBuffer,
			i * floats,
			translation ? translation[t3] : 0,
			translation ? translation[t3 + 1] : 0,
			translation ? translation[t3 + 2] : 0,
			rotation ? rotation[r4] : 0,
			rotation ? rotation[r4 + 1] : 0,
			rotation ? rotation[r4 + 2] : 0,
			rotation ? rotation[r4 + 3] : 1,
			scale ? scale[t3] : 1,
			scale ? scale[t3 + 1] : 1,
			scale ? scale[t3 + 2] : 1,
		);
	}
	mesh.markInstancesDirty(0, count);
}
