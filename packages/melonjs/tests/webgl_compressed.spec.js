import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

const COMPRESSED_RGB_ETC1_WEBGL = 0x8d64;
const COMPRESSED_RGB8_ETC2 = 0x9274;

/**
 * ETC1 on the WebGL backend. Every compressed format was uploaded into
 * immutable storage with `compressedTexSubImage2D`, and ETC1 is the one
 * format that call refuses (INVALID_OPERATION, "The texture image is ETC1
 * and the corresponding subregion update extensions are not enabled"), so
 * an ETC1 texture stayed empty and drew black.
 *
 * ETC2 decodes ETC1 data unchanged (it was designed to), so with ETC2
 * available the same bytes upload as ETC2, which takes the immutable path
 * every other format uses. With ETC1 alone, the texture is filled level by
 * level with `compressedTexImage2D`, the only upload ETC1 allows.
 */
describe("WebGL compressed textures: ETC1", () => {
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(64, 64);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	// One 4×4 ETC1 block decoding to solid (255, 2, 2): differential mode,
	// base red 31 with no delta, codeword table 0, and every pixel index 0,
	// which adds +2 to each channel.
	const RED_BLOCK = [0xf8, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00];

	// a 4×4 base with its 2×2 and 1×1 levels, one block each
	const etc1Image = (levels = 1) => {
		const mipmaps = [];
		for (let i = 0, px = 4; i < levels; i++, px >>= 1) {
			mipmaps.push({ data: new Uint8Array(RED_BLOCK), width: px, height: px });
		}
		return {
			compressed: true,
			format: COMPRESSED_RGB_ETC1_WEBGL,
			width: 4,
			height: 4,
			mipmaps,
		};
	};

	const requireEtc1 = (ctx) => {
		requireWebGL(ctx, renderer);
		if (!renderer.getSupportedCompressedTextureFormats().etc1) {
			ctx.skip("this browser exposes no ETC1 support");
		}
	};

	const upload = (image) => {
		const gl = renderer.gl;
		return renderer.batchers
			.get("quad")
			.createTexture2D(
				0,
				image,
				gl.NEAREST,
				"no-repeat",
				image.width,
				image.height,
				false,
				false,
			);
	};

	// Sample the texture's centre into a 1×1 RGBA8 target and read it back.
	// Compressed textures cannot be framebuffer attachments, so a draw is
	// the only way to see what the upload actually stored.
	const readTexel = (texture) => {
		const gl = renderer.gl;
		const compile = (type, source) => {
			const shader = gl.createShader(type);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			return shader;
		};
		const vs = compile(
			gl.VERTEX_SHADER,
			`#version 300 es
			void main() {
				vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
				gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
			}`,
		);
		const fs = compile(
			gl.FRAGMENT_SHADER,
			`#version 300 es
			precision mediump float;
			uniform sampler2D tex;
			out vec4 color;
			void main() { color = texture(tex, vec2(0.5)); }`,
		);
		const program = gl.createProgram();
		gl.attachShader(program, vs);
		gl.attachShader(program, fs);
		gl.linkProgram(program);

		const target = gl.createTexture();
		gl.activeTexture(gl.TEXTURE0);
		const previousTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);
		gl.bindTexture(gl.TEXTURE_2D, target);
		gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 1, 1);
		const fbo = gl.createFramebuffer();
		const previousFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			target,
			0,
		);

		// a bound sampler object would override the texture's own filtering
		const previousSampler = gl.getParameter(gl.SAMPLER_BINDING);
		gl.bindSampler(0, null);
		const previousProgram = gl.getParameter(gl.CURRENT_PROGRAM);
		const previousVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		const capabilities = [
			gl.BLEND,
			gl.SCISSOR_TEST,
			gl.DEPTH_TEST,
			gl.STENCIL_TEST,
		].filter((cap) => {
			return gl.isEnabled(cap);
		});
		for (const cap of capabilities) {
			gl.disable(cap);
		}
		const vao = gl.createVertexArray();
		gl.bindVertexArray(vao);
		gl.viewport(0, 0, 1, 1);
		gl.useProgram(program);
		gl.uniform1i(gl.getUniformLocation(program, "tex"), 0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		const texel = new Uint8Array(4);
		gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, texel);

		// hand the shared renderer back the state it had
		for (const cap of capabilities) {
			gl.enable(cap);
		}
		gl.viewport(...previousViewport);
		gl.useProgram(previousProgram);
		gl.bindVertexArray(previousVao);
		gl.bindFramebuffer(gl.FRAMEBUFFER, previousFbo);
		gl.bindTexture(gl.TEXTURE_2D, previousTexture);
		gl.bindSampler(0, previousSampler);
		gl.deleteVertexArray(vao);
		gl.deleteFramebuffer(fbo);
		gl.deleteTexture(target);
		gl.deleteProgram(program);
		gl.deleteShader(vs);
		gl.deleteShader(fs);
		return [...texel];
	};

	const expectRed = (texel) => {
		expect(texel[0]).toBeGreaterThanOrEqual(250);
		expect(texel[1]).toBeLessThanOrEqual(6);
		expect(texel[2]).toBeLessThanOrEqual(6);
		expect(texel[3]).toBe(255);
	};

	it("uploads without a GL error and draws the texels it was given", (ctx) => {
		requireEtc1(ctx);
		const gl = renderer.gl;
		gl.getError(); // start from a clean error flag
		const texture = upload(etc1Image());
		expect(gl.getError()).toBe(gl.NO_ERROR);
		expectRed(readTexel(texture));
		gl.deleteTexture(texture);
	});

	it("with ETC2 available, uploads the same bytes as ETC2 into immutable storage", (ctx) => {
		requireEtc1(ctx);
		if (!renderer.getSupportedCompressedTextureFormats().etc2) {
			ctx.skip("this browser exposes no ETC2 support");
		}
		const gl = renderer.gl;
		gl.getError();
		const storage = vi.spyOn(gl, "texStorage2D");
		const sub = vi.spyOn(gl, "compressedTexSubImage2D");
		try {
			const texture = upload(etc1Image(3));
			expect(gl.getError()).toBe(gl.NO_ERROR);
			expect(storage).toHaveBeenCalledWith(
				gl.TEXTURE_2D,
				3,
				COMPRESSED_RGB8_ETC2,
				4,
				4,
			);
			expect(sub).toHaveBeenCalledTimes(3);
			for (const call of sub.mock.calls) {
				expect(call[6]).toBe(COMPRESSED_RGB8_ETC2);
			}
			expect(
				gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_IMMUTABLE_FORMAT),
			).toBe(true);
			expectRed(readTexel(texture));
			gl.deleteTexture(texture);
		} finally {
			storage.mockRestore();
			sub.mockRestore();
		}
	});

	it("with ETC1 alone, fills each level with compressedTexImage2D", (ctx) => {
		requireEtc1(ctx);
		const gl = renderer.gl;
		const real = renderer.getSupportedCompressedTextureFormats();
		const formats = vi
			.spyOn(renderer, "getSupportedCompressedTextureFormats")
			.mockReturnValue({ ...real, etc2: null });
		const image2D = vi.spyOn(gl, "compressedTexImage2D");
		const storage = vi.spyOn(gl, "texStorage2D");
		try {
			gl.getError();
			const texture = upload(etc1Image(3));
			expect(gl.getError()).toBe(gl.NO_ERROR);
			expect(storage).not.toHaveBeenCalled();
			expect(image2D).toHaveBeenCalledTimes(3);
			for (const [level, call] of image2D.mock.calls.entries()) {
				expect(call[1]).toBe(level);
				expect(call[2]).toBe(COMPRESSED_RGB_ETC1_WEBGL);
			}
			expect(
				gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_IMMUTABLE_FORMAT),
			).toBe(false);
			expectRed(readTexel(texture));
			gl.deleteTexture(texture);
		} finally {
			formats.mockRestore();
			image2D.mockRestore();
			storage.mockRestore();
		}
	});

	// Meshes sample with trilinear filtering, which needs a complete mip
	// chain. An asset may ship fewer levels than the full chain: immutable
	// storage is complete with exactly the levels it was given, and the
	// mutable ETC1 texture only once capped to them.
	it.for(["with ETC2 available", "with ETC1 alone"])(
		"a partial mip chain still samples under trilinear filtering, %s",
		(mode, ctx) => {
			requireEtc1(ctx);
			const gl = renderer.gl;
			const real = renderer.getSupportedCompressedTextureFormats();
			if (mode === "with ETC2 available" && !real.etc2) {
				ctx.skip("this browser exposes no ETC2 support");
			}
			const formats = vi
				.spyOn(renderer, "getSupportedCompressedTextureFormats")
				.mockReturnValue(
					mode === "with ETC1 alone" ? { ...real, etc2: null } : real,
				);
			try {
				// an 8×8 base (four blocks) and its 4×4 level: two of the four levels
				const base = new Uint8Array(32);
				for (let i = 0; i < 4; i++) {
					base.set(RED_BLOCK, i * 8);
				}
				const image = {
					compressed: true,
					format: COMPRESSED_RGB_ETC1_WEBGL,
					width: 8,
					height: 8,
					mipmaps: [
						{ data: base, width: 8, height: 8 },
						{ data: new Uint8Array(RED_BLOCK), width: 4, height: 4 },
					],
				};
				gl.getError();
				const texture = upload(image);
				gl.texParameteri(
					gl.TEXTURE_2D,
					gl.TEXTURE_MIN_FILTER,
					gl.LINEAR_MIPMAP_LINEAR,
				);
				expect(gl.getError()).toBe(gl.NO_ERROR);
				// an incomplete texture samples as opaque black
				expectRed(readTexel(texture));
				gl.deleteTexture(texture);
			} finally {
				formats.mockRestore();
			}
		},
	);
});
