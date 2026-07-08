import type { TextureResource } from "./resource.js";

/**
 * The backing source a {@link Texture2d} resolves to through
 * {@link Texture2d#getTexture}: a drawable (canvas/image) for CPU-backed
 * assets, or a renderer texture resource for GPU-resident ones — a resource
 * uploads/binds itself through the texture cache instead of being read back
 * to the CPU.
 */
export type Texture2dSource =
	| HTMLCanvasElement
	| HTMLImageElement
	| OffscreenCanvas
	| ImageBitmap
	| TextureResource;

/**
 * Abstract base for a 2D texture asset — an object that owns a texture
 * source and can be used anywhere the engine expects an image:
 * {@link Sprite#image}, {@link Sprite#normalMap}, an {@link ImageLayer}, or
 * bound as a sampler uniform in a custom shader (see
 * {@link ShaderEffect#setTexture}).
 *
 * A `Texture2d` is recognized via `instanceof` and resolved to its backing
 * source through {@link Texture2d#getTexture} — so passing the asset object
 * directly (`{ image: myTexture }`) works the same as passing a raw
 * `HTMLCanvasElement`. Raw DOM image/canvas sources and the loader's decoded
 * `CompressedImage` data are accepted too, but are not part of this class
 * hierarchy.
 *
 * Most assets are CPU-backed and resolve to a drawable canvas/image.
 * Subclasses may also be **GPU-resident**, resolving to a renderer texture
 * resource that never leaves the GPU — the contract deliberately admits both
 * (a future WebGPU backend follows the same shape with a `GPUTexture`-backed
 * resource).
 *
 * Concrete implementations:
 * - {@link TextureAtlas} — packed multi-region sprite sheet
 * @category Game Objects
 */
export default abstract class Texture2d {
	/**
	 * Return the backing source for this texture — a drawable canvas/image
	 * for CPU-backed assets, or a renderer texture resource for GPU-resident
	 * ones. Assignable to {@link Sprite#image}, {@link Sprite#normalMap}, an
	 * {@link ImageLayer}, or bound as a sampler uniform in a custom shader.
	 * @returns the backing source
	 */
	abstract getTexture(): Texture2dSource;

	/**
	 * Release any GPU/CPU resources held by this texture. The texture must not
	 * be used after calling destroy.
	 * No-op by default — subclasses override when they own resources (a baked
	 * canvas, a cached GL texture, a pooled render target).
	 */
	destroy(): void {}
}
