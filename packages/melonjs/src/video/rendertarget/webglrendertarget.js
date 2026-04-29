import RenderTarget from "./rendertarget.ts";

// `DEPTH_STENCIL` (0x84F9) and `DEPTH_STENCIL_ATTACHMENT` (0x821A) are core
// WebGL 1.0 constants per the spec — no extension required. They're exposed
// natively on WebGL2 contexts and on most WebGL1 implementations, but a few
// browsers/drivers leave one or both as `undefined` on the gl context.
// Passing `undefined` to `renderbufferStorage` / `framebufferRenderbuffer`
// silently produces an incomplete framebuffer (no error), so we fall back
// to the spec-defined numeric values when the context lookup is missing.
const DEPTH_STENCIL = 0x84f9;
const DEPTH_STENCIL_ATTACHMENT = 0x821a;

/**
 * A WebGL Framebuffer Object (FBO) render target for offscreen rendering.
 * Used by the post-processing pipeline to render a camera's output to a texture,
 * which can then be drawn to the screen through a post-process shader.
 * @augments RenderTarget
 * @ignore
 */
export default class WebGLRenderTarget extends RenderTarget {
	/**
	 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - the WebGL context
	 * @param {number} width - initial width in pixels
	 * @param {number} height - initial height in pixels
	 */
	constructor(gl, width, height) {
		super();
		this.gl = gl;
		this.width = width;
		this.height = height;

		// create framebuffer
		this.framebuffer = gl.createFramebuffer();

		// create color texture — use TEXTURE0 explicitly to avoid corrupting
		// other texture units that the multi-texture batcher may have active.
		// Save/restore the active unit so the batcher's cache stays in sync.
		const prevUnit = gl.getParameter(gl.ACTIVE_TEXTURE);
		this.texture = gl.createTexture();
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			width,
			height,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			null,
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		// create depth+stencil renderbuffer (needed for masks)
		this.depthStencilBuffer = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthStencilBuffer);
		gl.renderbufferStorage(
			gl.RENDERBUFFER,
			gl.DEPTH_STENCIL ?? DEPTH_STENCIL,
			width,
			height,
		);

		// attach to framebuffer
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			this.texture,
			0,
		);
		gl.framebufferRenderbuffer(
			gl.FRAMEBUFFER,
			gl.DEPTH_STENCIL_ATTACHMENT ?? DEPTH_STENCIL_ATTACHMENT,
			gl.RENDERBUFFER,
			this.depthStencilBuffer,
		);

		// validate completeness — if the depth+stencil attachment failed for
		// any reason (driver bug, unsupported format), `_hasStencil` is false
		// and downstream stencil-dependent paths can short-circuit.
		const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		this._hasStencil = status === gl.FRAMEBUFFER_COMPLETE;
		if (!this._hasStencil) {
			console.warn(
				`WebGLRenderTarget: framebuffer incomplete (status 0x${status.toString(16)}) — stencil masking disabled for this target`,
			);
		}

		// unbind and restore the previously active texture unit
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.activeTexture(prevUnit);
	}

	/**
	 * Bind this FBO as the active render target.
	 * All subsequent draw calls will render into this FBO's texture.
	 */
	bind() {
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
	}

	/**
	 * Unbind this FBO and restore rendering to the screen.
	 */
	unbind() {
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
	}

	/**
	 * Resize the FBO texture and renderbuffer.
	 * @param {number} width - new width in pixels
	 * @param {number} height - new height in pixels
	 */
	resize(width, height) {
		if (this.width === width && this.height === height) {
			return;
		}

		const gl = this.gl;
		this.width = width;
		this.height = height;

		// resize color texture — use TEXTURE0 explicitly to avoid corrupting
		// other texture units that the multi-texture batcher may have active.
		// Save/restore the active unit so the batcher's cache stays in sync.
		const prevUnit = gl.getParameter(gl.ACTIVE_TEXTURE);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			width,
			height,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			null,
		);

		// resize depth+stencil renderbuffer
		gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthStencilBuffer);
		gl.renderbufferStorage(
			gl.RENDERBUFFER,
			gl.DEPTH_STENCIL ?? DEPTH_STENCIL,
			width,
			height,
		);

		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.activeTexture(prevUnit);
	}

	/**
	 * Clear the FBO contents to transparent black.
	 */
	clear() {
		const gl = this.gl;
		this.bind();
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
		this.unbind();
	}

	/**
	 * Returns an ImageData object representing the pixel contents of this render target.
	 * @param {number} [x=0] - x coordinate of the top-left corner
	 * @param {number} [y=0] - y coordinate of the top-left corner
	 * @param {number} [width=this.width] - width of the area to read
	 * @param {number} [height=this.height] - height of the area to read
	 * @returns {ImageData} the pixel data
	 */
	getImageData(x = 0, y = 0, width = this.width, height = this.height) {
		const gl = this.gl;
		// clamp to render target bounds
		x = Math.max(0, Math.min(Math.floor(x), this.width - 1));
		y = Math.max(0, Math.min(Math.floor(y), this.height - 1));
		width = Math.max(1, Math.min(width, this.width - x));
		height = Math.max(1, Math.min(height, this.height - y));
		const pixels = new Uint8ClampedArray(width * height * 4);
		this.bind();
		gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		this.unbind();
		// gl.readPixels returns bottom-up rows, flip to top-down
		const rowSize = width * 4;
		const temp = new Uint8ClampedArray(rowSize);
		for (let i = 0; i < Math.floor(height / 2); i++) {
			const topOffset = i * rowSize;
			const bottomOffset = (height - 1 - i) * rowSize;
			temp.set(pixels.subarray(topOffset, topOffset + rowSize));
			pixels.copyWithin(topOffset, bottomOffset, bottomOffset + rowSize);
			pixels.set(temp, bottomOffset);
		}
		return new ImageData(pixels, width, height);
	}

	/**
	 * Release all GPU resources.
	 */
	destroy() {
		const gl = this.gl;
		if (this.framebuffer) {
			gl.deleteFramebuffer(this.framebuffer);
			this.framebuffer = null;
		}
		if (this.texture) {
			gl.deleteTexture(this.texture);
			this.texture = null;
		}
		if (this.depthStencilBuffer) {
			gl.deleteRenderbuffer(this.depthStencilBuffer);
			this.depthStencilBuffer = null;
		}
	}
}
