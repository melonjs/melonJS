import { Batcher } from "melonjs";

// Two-color tinted vertex shader for Spine
// Spine vertex layout: position(2) + lightColor(4) + uv(2) + darkColor(4) = 12 floats
const spineVertexShader = `
attribute vec2 aVertex;
attribute vec4 aLightColor;
attribute vec2 aRegion;
attribute vec4 aDarkColor;

uniform mat4 uProjectionMatrix;

varying vec2 vRegion;
varying vec4 vLightColor;
varying vec4 vDarkColor;

void main(void) {
    gl_Position = uProjectionMatrix * vec4(aVertex, 0.0, 1.0);
    vRegion = aRegion;
    vLightColor = aLightColor;
    vDarkColor = aDarkColor;
}
`;

// Two-color tinted fragment shader for Spine
const spineFragmentShader = `
precision mediump float;

uniform sampler2D uSampler;

varying vec2 vRegion;
varying vec4 vLightColor;
varying vec4 vDarkColor;

void main(void) {
    vec4 texColor = texture2D(uSampler, vRegion);
    gl_FragColor.a = texColor.a * vLightColor.a;
    gl_FragColor.rgb = ((texColor.a - 1.0) * vDarkColor.a + 1.0 - texColor.rgb) * vDarkColor.rgb + texColor.rgb * vLightColor.rgb;
}
`;

/**
 * Vertex size in floats for two-color tinting:
 * position(2) + lightColor(4) + uv(2) + darkColor(4) = 12
 */
const VERTEX_SIZE = 12;

/**
 * Maximum vertices (matching Spine's PolygonBatcher default of 10920)
 */
const MAX_VERTICES = 10920;

/**
 * A custom melonJS Batcher for rendering Spine skeletons with two-color tinting.
 * Manages its own index buffer to match Spine's indexed triangle submission.
 * @category Rendering
 */
export default class SpineBatcher extends Batcher {
	/**
	 * @param {WebGLRenderer} renderer - the current WebGL renderer session
	 */
	constructor(renderer) {
		// Spine vertex layout: x, y, r, g, b, a, u, v, r2, g2, b2, a2
		super(renderer, {
			attributes: [
				{
					name: "aVertex",
					size: 2,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 0 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aLightColor",
					size: 4,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 2 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aRegion",
					size: 2,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 6 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aDarkColor",
					size: 4,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 8 * Float32Array.BYTES_PER_ELEMENT,
				},
			],
			shader: {
				vertex: spineVertexShader,
				fragment: spineFragmentShader,
			},
		});

		const gl = this.gl;

		// override the vertex data buffer with one sized for Spine
		this.vertexBuffer = new Float32Array(MAX_VERTICES * VERTEX_SIZE);
		this.verticesLength = 0;

		// create index buffer
		this.indexBuffer = new Uint16Array(MAX_VERTICES * 3);
		this.indicesLength = 0;

		// create GL buffers
		this.glVertexBuffer = gl.createBuffer();
		this.glIndexBuffer = gl.createBuffer();

		/**
		 * the current texture bound to the batcher
		 * @type {WebGLTexture}
		 * @ignore
		 */
		this.lastTexture = null;
	}

	/**
	 * Called when this batcher becomes the active one.
	 * Binds our own GL buffers and shader.
	 */
	bind() {
		const gl = this.gl;

		// bind our own vertex and index buffers
		gl.bindBuffer(gl.ARRAY_BUFFER, this.glVertexBuffer);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.glIndexBuffer);

		// bind the shader and set up vertex attributes
		super.bind();

		// enable blending with default normal mode
		this.renderer.setBlendMode("normal");
	}

	/**
	 * Set the blend mode for subsequent draw calls.
	 * Maps Spine BlendMode enum to melonJS blend mode strings.
	 * @param {number} blendMode - Spine BlendMode enum value (0=Normal, 1=Additive, 2=Multiply, 3=Screen)
	 * @param {boolean} premultipliedAlpha - whether textures use premultiplied alpha
	 */
	setBlendMode(blendMode, premultipliedAlpha) {
		const SPINE_BLEND_MODES = ["normal", "additive", "multiply", "screen"];
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
		// flush if texture changes or buffers would overflow
		if (texture !== this.lastTexture) {
			this.flush();
			this.lastTexture = texture;
		} else if (
			this.verticesLength + vertices.length > this.vertexBuffer.length ||
			this.indicesLength + indices.length > this.indexBuffer.length
		) {
			this.flush();
		}

		// current vertex count (in vertices, not floats) for index rebasing
		const indexStart = this.verticesLength / VERTEX_SIZE;

		// copy vertex data
		this.vertexBuffer.set(vertices, this.verticesLength);
		this.verticesLength += vertices.length;

		// copy and rebase indices
		for (let i = 0; i < indices.length; i++) {
			this.indexBuffer[this.indicesLength + i] = indices[i] + indexStart;
		}
		this.indicesLength += indices.length;
	}

	/**
	 * Flush batched vertex data to the GPU.
	 * Overrides base Batcher.flush() to use our own buffers with drawElements.
	 */
	flush() {
		if (this.verticesLength === 0) {
			return;
		}

		const gl = this.gl;

		// bind texture
		if (this.lastTexture) {
			this.lastTexture.bind();
		}

		// ensure our buffers are bound
		gl.bindBuffer(gl.ARRAY_BUFFER, this.glVertexBuffer);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.glIndexBuffer);

		// re-apply vertex attributes (in case another batcher changed them)
		this.currentShader.setVertexAttributes(gl, this.attributes, this.stride);

		// upload vertex data
		gl.bufferData(
			gl.ARRAY_BUFFER,
			this.vertexBuffer.subarray(0, this.verticesLength),
			gl.STREAM_DRAW,
		);

		// upload index data
		gl.bufferData(
			gl.ELEMENT_ARRAY_BUFFER,
			this.indexBuffer.subarray(0, this.indicesLength),
			gl.STREAM_DRAW,
		);

		// draw
		gl.drawElements(gl.TRIANGLES, this.indicesLength, gl.UNSIGNED_SHORT, 0);

		// reset
		this.verticesLength = 0;
		this.indicesLength = 0;
	}
}
