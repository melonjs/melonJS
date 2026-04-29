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
 * Try to attach a depth+stencil (preferred) or depth-only renderbuffer to
 * the currently-bound framebuffer, validating completeness at each step.
 *
 * Returns `{ hasStencil, isComplete }`:
 * - `hasStencil = true` only if packed depth+stencil attachment succeeded
 * - `isComplete = false` means even depth-only failed → callers should not
 *   render into the FBO (post-effects, blits, etc. will fail)
 * @ignore
 */
function attachDepthStencil(gl, framebuffer, renderbuffer, width, height) {
	const depthStencil = gl.DEPTH_STENCIL ?? DEPTH_STENCIL;
	const depthStencilAttachment =
		gl.DEPTH_STENCIL_ATTACHMENT ?? DEPTH_STENCIL_ATTACHMENT;

	// preferred path: packed depth + stencil so masking works
	gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
	gl.renderbufferStorage(gl.RENDERBUFFER, depthStencil, width, height);
	gl.framebufferRenderbuffer(
		gl.FRAMEBUFFER,
		depthStencilAttachment,
		gl.RENDERBUFFER,
		renderbuffer,
	);
	if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
		return { hasStencil: true, isComplete: true };
	}

	// fallback: depth-only — masking unavailable, but the FBO is still usable
	// for plain post-effect / blit pipelines
	gl.framebufferRenderbuffer(
		gl.FRAMEBUFFER,
		depthStencilAttachment,
		gl.RENDERBUFFER,
		null,
	);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
	gl.framebufferRenderbuffer(
		gl.FRAMEBUFFER,
		gl.DEPTH_ATTACHMENT,
		gl.RENDERBUFFER,
		renderbuffer,
	);
	const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
	return {
		hasStencil: false,
		isComplete: status === gl.FRAMEBUFFER_COMPLETE,
	};
}

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

		// bind FBO + attach color, then try depth+stencil with depth-only fallback
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			this.texture,
			0,
		);
		this._applyDepthStencil(width, height);

		// unbind and restore the previously active texture unit
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.activeTexture(prevUnit);
	}

	/**
	 * (Re)attach the depth/stencil renderbuffer at the given size and
	 * update `_hasStencil` based on the resulting framebuffer status.
	 * Falls back to depth-only when packed depth+stencil fails; warns
	 * once if even depth-only is incomplete.
	 * @ignore
	 */
	_applyDepthStencil(width, height) {
		const result = attachDepthStencil(
			this.gl,
			this.framebuffer,
			this.depthStencilBuffer,
			width,
			height,
		);
		this._hasStencil = result.hasStencil;
		if (!result.isComplete) {
			console.warn(
				"WebGLRenderTarget: framebuffer incomplete after depth-only fallback — rendering into this target may fail",
			);
		} else if (!result.hasStencil) {
			console.warn(
				"WebGLRenderTarget: depth+stencil attachment failed; using depth-only — stencil masking disabled for this target",
			);
		}
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

		// reattach depth/stencil at the new size (and re-validate completeness
		// so `_hasStencil` reflects the post-resize attachment status)
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
		this._applyDepthStencil(width, height);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

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
