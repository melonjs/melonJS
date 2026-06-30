/**
 * Abstract base for a user-constructed 2D texture asset — an object that owns
 * a drawable image source and can be used anywhere the engine expects an
 * image: {@link Sprite#image}, {@link Sprite#normalMap}, an {@link ImageLayer},
 * or bound as a sampler uniform in a custom {@link GLShader}.
 *
 * A `Texture2d` is recognized by the renderables via `instanceof` and resolved
 * to its backing canvas/image through {@link Texture2d#getTexture} — so passing
 * the asset object directly (`{ image: myTexture }`) works the same as passing a
 * raw `HTMLCanvasElement`. Raw DOM image/canvas sources and the loader's
 * decoded `CompressedImage` data are accepted too, but are not part of this
 * class hierarchy.
 *
 * Concrete implementations:
 * - {@link TextureAtlas} — packed multi-region sprite sheet
 *
 * A future WebGPU implementation would back {@link Texture2d#getTexture} with a
 * `GPUTexture`-wrapping surface rather than an `HTMLCanvasElement`.
 * @category Game Objects
 */
export default abstract class Texture2d {
	/**
	 * Return the drawable source for this texture — assignable to
	 * {@link Sprite#image}, {@link Sprite#normalMap}, an {@link ImageLayer}, or
	 * bound as a sampler uniform in a custom shader.
	 * @returns the backing canvas/image
	 */
	abstract getTexture(): HTMLCanvasElement | HTMLImageElement;

	/**
	 * Release any GPU/CPU resources held by this texture. The texture must not
	 * be used after calling destroy.
	 * No-op by default — subclasses override when they own resources (a baked
	 * canvas, a cached GL texture, a pooled render target).
	 */
	destroy(): void {}
}
