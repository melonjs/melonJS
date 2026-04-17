/**
 * A WebGL Framebuffer Object (FBO) render target for offscreen rendering.
 * Used by the post-processing pipeline to render a camera's output to a texture,
 * which can then be drawn to the screen through a post-process shader.
 * @ignore
 */
export default class WebGLRenderTarget {
	/**
	 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - the WebGL context
	 * @param {number} width - initial width in pixels
	 * @param {number} height - initial height in pixels
	 */
	constructor(gl, width, height) {
		this.gl = gl;
		this.width = width;
		this.height = height;

		// create framebuffer
		this.framebuffer = gl.createFramebuffer();

		// create color texture
		this.texture = gl.createTexture();
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

		// WebGL2 natively supports DEPTH_STENCIL; WebGL1 needs the extension
		const usePackedDepthStencil =
			(typeof WebGL2RenderingContext !== "undefined" &&
				gl instanceof WebGL2RenderingContext) ||
			gl.getExtension("WEBGL_depth_stencil") !== null;

		if (usePackedDepthStencil) {
			gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, width, height);
		} else {
			gl.renderbufferStorage(
				gl.RENDERBUFFER,
				gl.DEPTH_COMPONENT16,
				width,
				height,
			);
		}
		this._usePackedDepthStencil = usePackedDepthStencil;

		// attach to framebuffer
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			this.texture,
			0,
		);
		if (usePackedDepthStencil) {
			gl.framebufferRenderbuffer(
				gl.FRAMEBUFFER,
				gl.DEPTH_STENCIL_ATTACHMENT,
				gl.RENDERBUFFER,
				this.depthStencilBuffer,
			);
		} else {
			gl.framebufferRenderbuffer(
				gl.FRAMEBUFFER,
				gl.DEPTH_ATTACHMENT,
				gl.RENDERBUFFER,
				this.depthStencilBuffer,
			);
		}

		// unbind
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindTexture(gl.TEXTURE_2D, null);
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

		// resize color texture
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
			this._usePackedDepthStencil ? gl.DEPTH_STENCIL : gl.DEPTH_COMPONENT16,
			width,
			height,
		);

		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
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
	 * Creates a Blob object representing the image contained in this render target.
	 * @param {string} [type="image/png"] - A string indicating the image format
	 * @param {number} [quality] - A number between 0 and 1 for lossy formats (image/jpeg, image/webp)
	 * @returns {Promise<Blob>} A Promise resolving to a Blob
	 */
	toBlob(type = "image/png", quality) {
		const imageData = this.getImageData();
		if (typeof OffscreenCanvas !== "undefined") {
			const canvas = new OffscreenCanvas(this.width, this.height);
			const ctx = canvas.getContext("2d");
			ctx.putImageData(imageData, 0, 0);
			return canvas.convertToBlob({ type, quality });
		}
		// fallback for environments without OffscreenCanvas
		const canvas = document.createElement("canvas");
		canvas.width = this.width;
		canvas.height = this.height;
		const ctx = canvas.getContext("2d");
		ctx.putImageData(imageData, 0, 0);
		return new Promise((resolve) => {
			canvas.toBlob(
				(blob) => {
					resolve(blob);
				},
				type,
				quality,
			);
		});
	}

	/**
	 * Creates an ImageBitmap object from the current contents of this render target.
	 * @returns {Promise<ImageBitmap>} A Promise resolving to an ImageBitmap
	 */
	toImageBitmap() {
		const imageData = this.getImageData();
		return globalThis.createImageBitmap(imageData);
	}

	/**
	 * Returns a data URL containing a representation of the current contents of this render target.
	 * @param {string} [type="image/png"] - A string indicating the image format
	 * @param {number} [quality] - A number between 0 and 1 for lossy formats (image/jpeg, image/webp)
	 * @returns {Promise<string>} A Promise resolving to a data URL string
	 */
	toDataURL(type = "image/png", quality) {
		return this.toBlob(type, quality).then((blob) => {
			const reader = new FileReader();
			return new Promise((resolve) => {
				reader.onloadend = () => {
					resolve(reader.result);
				};
				reader.readAsDataURL(blob);
			});
		});
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
