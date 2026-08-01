import state from "../../../state/state.ts";
import UniformBlock from "../buffer/uniformblock.js";
import { MAX_LIGHTS } from "../lighting/constants.ts";
import { packMeshLights } from "../lighting/pack3d.ts";
import { BLOCK_FLOATS, writeLight3dBlock } from "../lighting/std140.ts";
import litFragment from "./../shaders/mesh-lit.frag";
import litVertex from "./../shaders/mesh-lit.vert";
import MeshBatcher from "./mesh_batcher.js";

// resolve the lit fragment shader's light-array size from the single source of
// truth (MAX_LIGHTS) so the GLSL array can't diverge from the uniform packer.
// replaceAll: the token appears at every use site (the GLSL preprocessor may
// have already expanded any macro, leaving multiple occurrences).
const litFragmentResolved = litFragment.replaceAll(
	"__MAX_LIGHTS__",
	String(MAX_LIGHTS),
);

// ambient used when a lit mesh is drawn with no active directional lights —
// render it fullbright (white ambient) rather than dark, so a `lit` mesh in a
// scene without lights still looks like the unlit path.
const _WHITE_AMBIENT = new Float32Array([1, 1, 1]);

/**
 * A {@link MeshBatcher} variant that shades meshes with the active stage's
 * {@link Light3d} lights (half-Lambert diffuse from directional lights +
 * ambient). It extends the unlit batcher, adding a world-space `aNormal`
 * vertex attribute (12-float layout vs 9) and a lit shader.
 *
 * Meshes opt in via `mesh.lit` — so standalone, unlit meshes keep the lean
 * 9-float `MeshBatcher` and pay nothing for lighting. Both batchers share the
 * mesh-mode depth-clear state (a single clear per target) since this one
 * inherits {@link MeshBatcher#bind}.
 * @category Rendering
 */
export default class LitMeshBatcher extends MeshBatcher {
	/**
	 * Allocate the `Light3dBlock` uniform buffer alongside the base setup.
	 * Re-run on context restore (`WebGLRenderer.reset` calls `init` rather
	 * than `reset` while the context is invalid), so the previous block —
	 * whose GL name belonged to the dead context — is dropped first.
	 * @ignore
	 */
	init(renderer) {
		super.init(renderer);

		this.lightBlock?.destroy();

		/**
		 * The `Light3dBlock` uniform buffer, refreshed before each draw in
		 * {@link LitMeshBatcher#updatePassState}.
		 * @type {UniformBlock}
		 * @ignore
		 */
		// Claim a binding point once and hold it: `init()` re-runs on context
		// restore, and claiming again each time would walk through the
		// device's budget over a long session.
		this._bindingPoint ??= renderer.reserveUniformBindingPoint();
		this.lightBlock = new UniformBlock(
			renderer.gl,
			BLOCK_FLOATS,
			this._bindingPoint,
		);
		this._lightBlockProgram = null;
		// see the note in LitQuadBatcher.init: an active-but-unbound uniform
		// block makes the program undrawable, so bind it at birth rather than
		// on first activation
		this._bindLightBlock();
	}

	/**
	 * Point the active program's `Light3dBlock` at our uniform buffer.
	 *
	 * A block binding is program state, so it has to be re-established
	 * whenever the program changes: a context restore recompiles it, `init`
	 * re-runs on reset, and `useShader` can swap one in without a batcher
	 * transition. Comparing against the program we last bound covers all
	 * three — a pointer compare in the steady state.
	 * @ignore
	 */
	_bindLightBlock() {
		const shader = this.currentShader || this.defaultShader;
		const program = shader?.program;
		if (!program || program === this._lightBlockProgram) {
			return;
		}
		this._lightBlockProgram = program;
		this.lightBlock.bindTo(program, "Light3dBlock");
	}

	/** release the light block along with the rest. @ignore */
	destroy() {
		this.lightBlock?.destroy();
		this.lightBlock = undefined;
		this._lightBlockProgram = null;
		super.destroy();
	}

	/** add the world-space normal attribute on top of the base layout. @ignore */
	_attributeLayout(renderer) {
		// the parameter is kept for the subclass contract even though a
		// format-declared layout no longer needs a rendering context
		const attributes = super._attributeLayout(renderer);
		attributes.push({
			// aNormal: world-space vertex normal, pushed WITHOUT the view
			// transform so lighting is evaluated in world space.
			name: "aNormal",
			format: "float32x3",
			offset: 9 * Float32Array.BYTES_PER_ELEMENT,
		});
		return attributes;
	}

	/** use the lit (half-Lambert) shader. @ignore */
	_shaderSources() {
		return { vertex: litVertex, fragment: litFragmentResolved };
	}

	/** push the 12-float lit vertex, appending the mesh's world-space normal. @ignore */
	_pushVertex(vertexData, x, y, z, u, v, color, mesh, i3) {
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
	 * Same as the base layout plus the model-space normal, so lighting can be
	 * evaluated after the shader rotates it into world space.
	 * @param {object} mesh - the mesh to read geometry from
	 * @param {Float32Array} out - destination scratch
	 * @returns {number} number of floats written
	 * @ignore
	 */
	buildRetainedVertexData(mesh, out) {
		const vertices = mesh.originalVertices;
		const normals = mesh.originalNormals;
		const uvs = mesh.uvs;
		const colors = mesh.vertexColors;
		const count = mesh.vertexCount;
		let o = 0;
		for (let i = 0; i < count; i++) {
			const i3 = i * 3;
			const i2 = i * 2;
			const c = colors ? colors[i] : 0xffffffff;
			out[o] = vertices[i3];
			out[o + 1] = vertices[i3 + 1];
			out[o + 2] = vertices[i3 + 2];
			out[o + 3] = uvs[i2];
			out[o + 4] = uvs[i2 + 1];
			out[o + 5] = ((c >> 16) & 0xff) / 255;
			out[o + 6] = ((c >> 8) & 0xff) / 255;
			out[o + 7] = (c & 0xff) / 255;
			out[o + 8] = ((c >>> 24) & 0xff) / 255;
			// A zero-length normal must not reach the shader: it does
			// `normalize(vNormal)`, and normalize(vec3(0)) is NaN — every
			// fragment touching that vertex goes black or garbage. Degenerate
			// triangles in OBJ/glTF assets produce these, so substitute a unit
			// vector, matching what `_projectNormalsWorld` does on the CPU path.
			const nx = normals ? normals[i3] : 0;
			const ny = normals ? normals[i3 + 1] : 0;
			const nz = normals ? normals[i3 + 2] : 0;
			if (nx * nx + ny * ny + nz * nz > 1e-16) {
				out[o + 9] = nx;
				out[o + 10] = ny;
				out[o + 11] = nz;
			} else {
				out[o + 9] = 0;
				out[o + 10] = 1;
				out[o + 11] = 0;
			}
			o += this.vertexSize;
		}
		return o;
	}

	/**
	 * Refresh the light block on top of the inherited depth handling.
	 *
	 * Deliberately here and not in `bind()`: `setBatcher` returns early when
	 * this batcher is already current, so a scene made only of lit meshes binds
	 * once and never again. Uploading in `bind()` meant such a scene shaded
	 * every frame with the lights it had on the first one — move a `Light3d`
	 * and nothing happened. Most scenes escape it by accident, because a sprite
	 * or an unlit mesh forces a switch (`night-city`'s emissive windows are
	 * `lit: false`, which is what keeps it correct); a purely lit scene does
	 * not.
	 *
	 * Costs nothing when the lights are unchanged: `UniformBlock.upload`
	 * compares against the previous upload and skips the `bufferSubData`
	 * outright, so a static light rig is one pack plus one array compare per
	 * draw and zero GL calls.
	 *
	 * With NO lights at all (no directional and no ambient), a white ambient
	 * keeps a `lit` mesh fullbright — matching the unlit path — while an
	 * ambient-only scene still uses its real ambient.
	 * @ignore
	 */
	updatePassState() {
		super.updatePassState();

		this._bindLightBlock();

		const stage = state.current();
		const lit = packMeshLights(stage ? stage._activeLights3d : null);
		// use the packed ambient whenever any light contributed (directional
		// OR ambient); fall back to fullbright white only when the scene has no
		// 3D lights at all — otherwise an ambient-only setup would be ignored.
		const a = lit.ambient;
		const hasLight = lit.count > 0 || a[0] > 0 || a[1] > 0 || a[2] > 0;
		this.lightBlock.upload(
			writeLight3dBlock(this.lightBlock.data, {
				count: lit.count,
				directions: lit.directions,
				colors: lit.colors,
				ambient: hasLight ? a : _WHITE_AMBIENT,
			}),
		);
	}
}
