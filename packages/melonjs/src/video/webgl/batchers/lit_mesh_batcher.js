import { LightingEnvironment } from "../../../lighting/lighting_environment.ts";
import { MAX_LIGHTS } from "../lighting/constants.ts";
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

// ambient used when a lit mesh is drawn with no active lights — render it
// fullbright (white ambient) rather than dark, so a `lit` mesh without a
// populated LightingEnvironment still looks like the unlit path.
const _WHITE_AMBIENT = new Float32Array([1, 1, 1]);

/**
 * A {@link MeshBatcher} variant that shades meshes with the active
 * {@link LightingEnvironment} (half-Lambert diffuse from directional lights +
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
	 * Enter the mesh-mode pass (depth state via the inherited base) and upload
	 * the active lighting environment to the lit shader. With no lights, a
	 * white ambient keeps the mesh fullbright.
	 */
	bind() {
		super.bind();
		const lit = LightingEnvironment.default.pack();
		const shader = this.currentShader;
		shader.setUniform("uLightCount", lit.count);
		if (lit.count > 0) {
			shader.setUniform("uLightDir", lit.directions);
			shader.setUniform("uLightColor", lit.colors);
			shader.setUniform("uAmbient", lit.ambient);
		} else {
			shader.setUniform("uAmbient", _WHITE_AMBIENT);
		}
	}
}
