import RenderTarget from "./rendertarget.ts";

/**
 * Try to attach a depth+stencil (preferred) or depth-only renderbuffer to
 * the currently-bound framebuffer, validating completeness at each step.
 *
 * Returns `{ hasStencil, isComplete }`:
 * - `hasStencil = true` only if packed depth+stencil attachment succeeded
 * - `isComplete = false` means even depth-only failed → callers should not
 *   render into the FBO (post-effects, blits, etc. will fail)
 * @ignore
 * @internal
 */
function attachDepthStencil(
	gl,
	framebuffer,
	renderbuffer,
	width,
	height,
	samples = 0,
) {
	// core WebGL 2 constants — always present on the context (the WebGL 1
	// driver-gap numeric fallbacks were removed with WebGL 1 support).
	// Multisampled storage needs the SIZED format; single-sampled keeps the
	// legacy unsized token (identical layout, broadest driver compatibility)
	const depthStencil = samples > 0 ? gl.DEPTH24_STENCIL8 : gl.DEPTH_STENCIL;
	const depthStencilAttachment = gl.DEPTH_STENCIL_ATTACHMENT;
	const storage = (format) => {
		if (samples > 0) {
			gl.renderbufferStorageMultisample(
				gl.RENDERBUFFER,
				samples,
				format,
				width,
				height,
			);
		} else {
			gl.renderbufferStorage(gl.RENDERBUFFER, format, width, height);
		}
	};

	// preferred path: packed depth + stencil so masking works
	gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
	storage(depthStencil);
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
	storage(gl.DEPTH_COMPONENT16);
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
 * @internal
 */
export default class WebGLRenderTarget extends RenderTarget {
	/**
	 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - the WebGL context
	 * @param {number} width - initial width in pixels
	 * @param {number} height - initial height in pixels
	 */
	/**
	 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - the WebGL context
	 * @param {number} width - initial width in pixels
	 * @param {number} height - initial height in pixels
	 * @param {object} [options] - target options
	 * @param {number} [options.samples=0] - MSAA sample count for the scene
	 * rasterization. When > 0 the target keeps a multisampled render FBO
	 * (color + depth-stencil renderbuffers) that draws rasterize into, and
	 * resolves it into the sampleable texture via `blitFramebuffer` on
	 * {@link WebGLRenderTarget#resolve} (called automatically by `unbind`).
	 */
	constructor(gl, width, height, options = {}) {
		super();
		this.gl = gl;
		this.width = width;
		this.height = height;

		/**
		 * MSAA sample count of the render half (0 = single-sampled)
		 * @type {number}
		 */
		this.samples = options.samples ?? 0;

		// the render half needs a resolve before the texture is sampled
		/**
		 * @ignore
		 * @internal
		 */
		this._needsResolve = false;

		// create the (resolve) framebuffer — the one whose color TEXTURE
		// the effect chain samples
		this.framebuffer = gl.createFramebuffer();

		// create color texture — use TEXTURE0 explicitly to avoid corrupting
		// other texture units that the multi-texture batcher may have active.
		// Save/restore the active unit so the batcher's cache stays in sync.
		const prevUnit = gl.getParameter(gl.ACTIVE_TEXTURE);
		this._allocateColorTexture(width, height);

		// create depth+stencil renderbuffer (needed for masks). It attaches
		// to whichever framebuffer draws actually rasterize into — the
		// multisampled render FBO when MSAA is on, the plain one otherwise.
		this.depthStencilBuffer = gl.createRenderbuffer();

		if (this.samples > 0) {
			// the multisampled render half: color renderbuffer + the
			// depth-stencil above, resolved into `framebuffer`'s texture
			this.renderFramebuffer = gl.createFramebuffer();
			this.colorRenderbuffer = gl.createRenderbuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.renderFramebuffer);
			gl.bindRenderbuffer(gl.RENDERBUFFER, this.colorRenderbuffer);
			gl.renderbufferStorageMultisample(
				gl.RENDERBUFFER,
				this.samples,
				gl.RGBA8,
				width,
				height,
			);
			gl.framebufferRenderbuffer(
				gl.FRAMEBUFFER,
				gl.COLOR_ATTACHMENT0,
				gl.RENDERBUFFER,
				this.colorRenderbuffer,
			);
			this._applyDepthStencil(width, height);
		} else {
			this.renderFramebuffer = null;
			this.colorRenderbuffer = null;
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
			this._applyDepthStencil(width, height);
		}

		// unbind and restore the previously active texture unit
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.activeTexture(prevUnit);
	}

	/**
	 * (Re)create the sampleable color texture with immutable storage
	 * (`texStorage2D` — the driver skips completeness validation and the
	 * layout is explicit) and attach it to the resolve framebuffer.
	 * Immutable storage can never be respecified, so a resize replaces the
	 * texture object. Caller manages ACTIVE_TEXTURE save/restore.
	 * @ignore
	 * @internal
	 */
	_allocateColorTexture(width, height) {
		const gl = this.gl;
		if (this.texture) {
			gl.deleteTexture(this.texture);
		}
		this.texture = gl.createTexture();
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			this.texture,
			0,
		);
	}

	/**
	 * (Re)attach the depth/stencil renderbuffer at the given size and
	 * update `_hasStencil` based on the resulting framebuffer status.
	 * Falls back to depth-only when packed depth+stencil fails; warns
	 * once if even depth-only is incomplete.
	 * @ignore
	 * @internal
	 */
	_applyDepthStencil(width, height) {
		const result = attachDepthStencil(
			this.gl,
			this.framebuffer,
			this.depthStencilBuffer,
			width,
			height,
			this.samples,
		);
		/**
		 * @ignore
		 * @internal
		 */
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
		// draws rasterize into the multisampled half when MSAA is on
		if (this.renderFramebuffer) {
			this._needsResolve = true;
			this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.renderFramebuffer);
		} else {
			this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
		}
	}

	/**
	 * Resolve the multisampled render half into the sampleable texture
	 * (no-op when single-sampled or already resolved). Leaves no
	 * framebuffer bound — callers rebind what they need.
	 */
	resolve() {
		if (!this.renderFramebuffer || this._needsResolve !== true) {
			return;
		}
		const gl = this.gl;
		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.renderFramebuffer);
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.framebuffer);
		gl.blitFramebuffer(
			0,
			0,
			this.width,
			this.height,
			0,
			0,
			this.width,
			this.height,
			gl.COLOR_BUFFER_BIT,
			gl.NEAREST,
		);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		this._needsResolve = false;
	}

	/**
	 * Unbind this FBO and restore rendering to the screen — resolving the
	 * multisampled half first, so `texture` always holds the final pixels
	 * by the time anything samples it.
	 */
	unbind() {
		if (this.renderFramebuffer) {
			this.resolve();
		}
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

		// immutable color storage can't be respecified — recreate the
		// texture at the new size (and re-attach it). Save/restore the
		// active unit so the batcher's cache stays in sync.
		const prevUnit = gl.getParameter(gl.ACTIVE_TEXTURE);
		this._allocateColorTexture(width, height);

		if (this.renderFramebuffer) {
			// renderbuffers respecify in place — re-allocate the
			// multisampled color half at the new size
			gl.bindRenderbuffer(gl.RENDERBUFFER, this.colorRenderbuffer);
			gl.renderbufferStorageMultisample(
				gl.RENDERBUFFER,
				this.samples,
				gl.RGBA8,
				width,
				height,
			);
			this._needsResolve = false;
		}

		// reattach depth/stencil at the new size (and re-validate completeness
		// so `_hasStencil` reflects the post-resize attachment status) — on
		// the framebuffer draws actually rasterize into
		gl.bindFramebuffer(
			gl.FRAMEBUFFER,
			this.renderFramebuffer ?? this.framebuffer,
		);
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
		// reads must come from the single-sampled resolve half — readPixels
		// on a multisampled framebuffer is a GL error
		this.resolve();
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
		gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
		if (this.renderFramebuffer) {
			gl.deleteFramebuffer(this.renderFramebuffer);
			this.renderFramebuffer = null;
		}
		if (this.colorRenderbuffer) {
			gl.deleteRenderbuffer(this.colorRenderbuffer);
			this.colorRenderbuffer = null;
		}
	}
}
