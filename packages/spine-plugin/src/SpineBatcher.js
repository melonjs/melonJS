import { Shader } from "@esotericsoftware/spine-webgl";
import { Batcher } from "melonjs";

/**
 * Spine blend mode enum to melonJS blend mode string mapping
 */
const SPINE_BLEND_MODES = ["normal", "additive", "multiply", "screen"];

/**
 * Vertex size in floats for two-color tinting:
 * position(2) + lightColor(4) + uv(2) + darkColor(4) = 12
 */
const VERTEX_SIZE = 12;

/**
 * A custom melonJS Batcher for rendering Spine skeletons with two-color tinting.
 * Uses Spine's official two-color shader and the base Batcher's indexed drawing support.
 * @category Rendering
 */
export default class SpineBatcher extends Batcher {
	/**
	 * @param {WebGLRenderer} renderer - the current WebGL renderer session
	 * @param {WebGLRenderingContext|WebGL2RenderingContext} canvas - the GL context for Spine shader creation
	 */
	constructor(renderer, canvas) {
		// create the official Spine two-color shader and extract its source
		const spineShader = Shader.newTwoColoredTextured(canvas);
		const shaderSource = {
			vertex: spineShader.getVertexShaderSource(),
			fragment: spineShader.getFragmentSource(),
		};
		spineShader.dispose();

		// Spine vertex layout: a_position(2) + a_color(4) + a_texCoords(2) + a_color2(4)
		super(renderer, {
			attributes: [
				{
					name: Shader.POSITION,
					size: 2,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 0 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: Shader.COLOR,
					size: 4,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 2 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: Shader.TEXCOORDS,
					size: 2,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 6 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: Shader.COLOR2,
					size: 4,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 8 * Float32Array.BYTES_PER_ELEMENT,
				},
			],
			shader: shaderSource,
			maxVertices: 10920,
			indexed: true,
			projectionUniform: Shader.MVP_MATRIX,
		});

		/**
		 * the current texture bound to the batcher
		 * @type {object|null}
		 * @ignore
		 */
		this.lastTexture = null;
	}

	/**
	 * Set the blend mode for subsequent draw calls.
	 * Maps Spine BlendMode enum to melonJS blend mode strings.
	 * @param {number} blendMode - Spine BlendMode enum value (0=Normal, 1=Additive, 2=Multiply, 3=Screen)
	 * @param {boolean} premultipliedAlpha - whether textures use premultiplied alpha
	 */
	setBlendMode(blendMode, premultipliedAlpha) {
		this.renderer.setBlendMode(
			SPINE_BLEND_MODES[blendMode],
			premultipliedAlpha,
		);
	}

	/**
	 * Draw Spine vertices with the given texture and triangle indices.
	 * This matches the Spine PolygonBatcher.draw() API.
	 * @param {object} texture - a Spine GLTexture object
	 * @param {ArrayLike<number>} vertices - interleaved vertex data
	 * @param {number[]} indices - triangle index array
	 */
	draw(texture, vertices, indices) {
		const vertexData = this.vertexData;
		const vertexCount = vertices.length / VERTEX_SIZE;

		// flush if texture changes or buffers would overflow
		if (texture !== this.lastTexture) {
			this.flush();
			this.lastTexture = texture;
		} else if (
			vertexData.isFull(vertexCount) ||
			this.indexBuffer.length + indices.length > this.indexBuffer.data.length
		) {
			this.flush();
		}

		// add indices (rebased by current vertex count)
		this.addIndices(indices);

		// copy vertex data into the vertex buffer
		for (let i = 0; i < vertices.length; i += VERTEX_SIZE) {
			vertexData.pushFloats(vertices, i, VERTEX_SIZE);
		}
	}

	/**
	 * Flush batched vertex data to the GPU.
	 * Binds the spine texture before delegating to the base Batcher flush.
	 * @param {number} [mode] - the GL drawing mode
	 */
	flush(mode) {
		if (this.lastTexture && this.vertexData.vertexCount > 0) {
			this.lastTexture.bind();
		}
		super.flush(mode);
	}
}
