/**
 * Abstract base class for offscreen render targets.
 * Provides a renderer-agnostic interface for binding, clearing, resizing,
 * and reading back pixel data from an offscreen surface.
 * Concrete implementations:
 * - {@link WebGLRenderTarget} — WebGL framebuffer object (FBO) for post-processing
 * - {@link CanvasRenderTarget} — 2D canvas surface for texture generation
 *
 * A future WebGPU implementation would extend this class with
 * GPUTexture / GPURenderPassDescriptor management.
 * @category Rendering
 */
export default abstract class RenderTarget {
	/**
	 * The width of this render target in pixels.
	 */
	declare width: number;

	/**
	 * The height of this render target in pixels.
	 */
	declare height: number;

	/**
	 * Bind this render target as the active draw destination.
	 * All subsequent draw calls will render into this target until {@link unbind} is called.
	 * No-op by default — subclasses override for GPU render targets (e.g. WebGL FBOs).
	 */
	bind(): void {}

	/**
	 * Unbind this render target, restoring the default (screen) output.
	 * No-op by default — subclasses override for GPU render targets.
	 */
	unbind(): void {}

	/**
	 * Resize the render target's backing storage to the given dimensions.
	 * @param width - new width in pixels
	 * @param height - new height in pixels
	 */
	abstract resize(width: number, height: number): void;

	/**
	 * Clear the render target contents.
	 */
	abstract clear(): void;

	/**
	 * Release all resources held by this render target.
	 * The target must not be used after calling destroy.
	 */
	abstract destroy(): void;

	/**
	 * Read back pixel data from this render target.
	 * @param x - x coordinate of the top-left corner (default 0)
	 * @param y - y coordinate of the top-left corner (default 0)
	 * @param width - width of the area to read (default full width)
	 * @param height - height of the area to read (default full height)
	 * @returns an ImageData object containing the pixel data
	 */
	abstract getImageData(
		x?: number,
		y?: number,
		width?: number,
		height?: number,
	): ImageData;

	/**
	 * Creates a Blob object representing the image contained in this render target.
	 * @param type - a string indicating the image format (default "image/png")
	 * @param quality - a number between 0 and 1 for lossy formats (e.g. image/jpeg)
	 * @returns a Promise resolving to a Blob
	 */
	toBlob(type = "image/png", quality?: number): Promise<Blob> {
		const imageData = this.getImageData();
		if (typeof OffscreenCanvas !== "undefined") {
			const canvas = new OffscreenCanvas(this.width, this.height);
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				return Promise.reject(new Error("Failed to get 2d context"));
			}
			ctx.putImageData(imageData, 0, 0);
			const options: { type: string; quality?: number } = { type };
			if (typeof quality !== "undefined") {
				options.quality = quality;
			}
			return canvas.convertToBlob(options);
		}
		const canvas = document.createElement("canvas");
		canvas.width = this.width;
		canvas.height = this.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			return Promise.reject(new Error("Failed to get 2d context"));
		}
		ctx.putImageData(imageData, 0, 0);
		return new Promise((resolve, reject) => {
			canvas.toBlob(
				(blob) => {
					if (blob) {
						resolve(blob);
					} else {
						reject(new Error(`toBlob failed for type "${type}"`));
					}
				},
				type,
				quality,
			);
		});
	}

	/**
	 * Creates an ImageBitmap object from the current contents of this render target.
	 * @returns a Promise resolving to an ImageBitmap
	 */
	toImageBitmap(): Promise<ImageBitmap> {
		const imageData = this.getImageData();
		return globalThis.createImageBitmap(imageData);
	}

	/**
	 * Returns a data URL containing a representation of the current contents.
	 * @param type - a string indicating the image format (default "image/png")
	 * @param quality - a number between 0 and 1 for lossy formats (e.g. image/jpeg)
	 * @returns a Promise resolving to a data URL string
	 */
	toDataURL(type = "image/png", quality?: number): Promise<string> {
		return this.toBlob(type, quality).then((blob) => {
			const reader = new FileReader();
			return new Promise<string>((resolve, reject) => {
				reader.onload = () => {
					resolve(reader.result as string);
				};
				reader.onerror = () => {
					reject(new Error(reader.error?.message ?? "FileReader failed"));
				};
				reader.onabort = () => {
					reject(new Error("FileReader aborted"));
				};
				reader.readAsDataURL(blob);
			});
		});
	}
}
