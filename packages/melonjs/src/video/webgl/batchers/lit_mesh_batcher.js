import state from "../../../state/state.ts";
import { MAX_LIGHTS } from "../lighting/constants.ts";
import { packMeshLights } from "../lighting/pack3d.ts";
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
	/** add the world-space normal attribute on top of the base layout. @ignore */
	_attributeLayout(renderer) {
		const attributes = super._attributeLayout(renderer);
		attributes.push({
			// aNormal: world-space vertex normal, pushed WITHOUT the view
			// transform so lighting is evaluated in world space.
			name: "aNormal",
			size: 3,
			type: renderer.gl.FLOAT,
			normalized: false,
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
			out[o + 9] = normals ? normals[i3] : 0;
			out[o + 10] = normals ? normals[i3 + 1] : 0;
			out[o + 11] = normals ? normals[i3 + 2] : 0;
			o += this.vertexSize;
		}
		return o;
	}

	/**
	 * Enter the mesh-mode pass (depth state via the inherited base) and upload
	 * the active stage's 3D lights to the lit shader. With NO lights at all
	 * (no directional and no ambient), a white ambient keeps a `lit` mesh
	 * fullbright (so it matches the unlit path); an ambient-only scene still
	 * uses its real ambient.
	 */
	bind() {
		super.bind();
		const stage = state.current();
		const lit = packMeshLights(stage ? stage._activeLights3d : null);
		const shader = this.currentShader;
		shader.setUniform("uLightCount", lit.count);
		if (lit.count > 0) {
			shader.setUniform("uLightDir", lit.directions);
			shader.setUniform("uLightColor", lit.colors);
		}
		// use the packed ambient whenever any light contributed (directional
		// OR ambient); fall back to fullbright white only when the scene has no
		// 3D lights at all — otherwise an ambient-only setup would be ignored.
		const a = lit.ambient;
		const hasLight = lit.count > 0 || a[0] > 0 || a[1] > 0 || a[2] > 0;
		shader.setUniform("uAmbient", hasLight ? a : _WHITE_AMBIENT);
	}
}
