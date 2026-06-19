import { Light3d } from "../../lighting/light3d.ts";
import { LightingEnvironment } from "../../lighting/lighting_environment.ts";
import { getGLTF } from "../../loader/loader.js";
import { boundingRadius } from "../../math/vertex.ts";
import Mesh from "../../renderable/mesh.js";

/**
 * @classdesc
 * A loadable 3D scene parsed from a glTF / GLB asset. Instances are created
 * and registered with the {@link level} director (usually automatically by
 * the preloader), so a glTF scene loads with the same one-call ergonomics as
 * a Tiled map: `me.level.load("myScene")`.
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
		/**
		 * the Light3d instances this scene added to the active
		 * LightingEnvironment, so they can be removed on reload / destroy.
		 * @type {Light3d[]}
		 * @ignore
		 */
		this._lights = [];
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
	 * Called by the level director on `me.level.load(...)`.
	 * @param {Container} container - the target container (e.g. `game.world`)
	 * @param {object} [options]
	 * @param {number} [options.scale=1] - pixels per glTF unit (uniform scene scale)
	 * @param {boolean} [options.rightHanded=true] - convert glTF Y-up right-handed
	 * geometry to the engine's Y-down via a rotation (no mirror). See the wiki.
	 * @param {boolean} [options.lights=true] - instantiate the scene's authored
	 * `KHR_lights_punctual` directional lights into {@link LightingEnvironment}.default
	 * so the meshes are lit by the sun set up in the authoring tool. Set false to
	 * keep the meshes unlit / manage lighting yourself.
	 */
	addTo(container, options = {}) {
		if (!this.data) {
			return;
		}
		const scale = options.scale ?? 1;
		const rightHanded = options.rightHanded !== false;
		const zSign = rightHanded ? -1 : 1;

		// the scene is lit when it carries authored directional lights and the
		// caller didn't opt out — meshes then render through the lit batcher.
		const lit =
			options.lights !== false &&
			(this.data.lights ?? []).some((l) => {
				return l.type === "directional";
			});

		// scene meshes carry their own world transform — keep the container
		// from reassigning per-child depth (the GPU depth test resolves
		// occlusion between meshes under Camera3d)
		container.autoDepth = false;

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

			const mesh = new Mesh(0, 0, {
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
				// light this mesh (via the lit batcher) when the scene has lights
				lit,
				// honor the glTF material's double-sided flag: thin/flat props
				// (coins, fences, foliage) are double-sided and must NOT be
				// back-face culled, or half their faces vanish
				cullBackFaces: node.doubleSided !== true,
			});
			// material baseColorFactor → mesh tint, so an untextured solid-color
			// material renders its color instead of the white-pixel fallback.
			// (RGB only; alpha/transparency is a separate feature — the mesh
			// path renders opaque.) Composes with COLOR_0 and the texture: the
			// batcher does factor × vertexColor × texel, matching glTF.
			const f = node.baseColorFactor;
			if (f) {
				mesh.tint.setColor(
					Math.round(f[0] * 255),
					Math.round(f[1] * 255),
					Math.round(f[2] * 255),
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

		// Instantiate the scene's authored directional lights into the active
		// LightingEnvironment so the meshes are lit by the same sun set up in
		// the authoring tool (Blender etc.). Re-loading replaces this scene's
		// own lights (tracked in `_lights`); other lights are left alone.
		this._removeLights();
		if (options.lights !== false) {
			for (const light of this.data.lights ?? []) {
				if (light.type !== "directional") {
					// point / spot lights are parsed but not yet shaded
					continue;
				}
				const d = light.direction;
				const l3d = new Light3d({
					type: "directional",
					// bring the glTF-space direction into render space (same
					// Y-down / rightHanded Y/Z bridge the geometry uses)
					direction: [d[0], -d[1], zSign * d[2]],
					color: [light.color[0], light.color[1], light.color[2]],
					// glTF directional intensity is in lux (often thousands) —
					// not meaningful for a stylized Lambert shader, so use a unit
					// intensity and let the app tune `light.intensity` if needed.
					intensity: 1,
				});
				LightingEnvironment.default.addLight(l3d);
				this._lights.push(l3d);
			}
		}
	}

	/** Remove the lights this scene previously added. @ignore */
	_removeLights() {
		for (const light of this._lights) {
			LightingEnvironment.default.removeLight(light);
		}
		this._lights.length = 0;
	}

	/**
	 * Director cleanup hook (parity with `TMXTileMap.destroy`). The meshes are
	 * owned by the container (reset by the director on the next load); here we
	 * also pull this scene's lights back out of the active LightingEnvironment.
	 * @ignore
	 */
	destroy() {
		this._removeLights();
	}
}
