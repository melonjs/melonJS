/**
 * Compile-time-only brand key; no runtime value can hold it.
 * @ignore
 */
declare const gpuResidentBrand: unique symbol;

/**
 * An opaque, GPU-resident texture backing — the source a GPU-resident
 * {@link Texture2d} resolves to (for example the framebuffer copy
 * {@link WebGLRenderer#toFrameTexture} produces). Such a backing uploads/binds
 * itself through the texture cache instead of being read back to the CPU. Its
 * concrete shape is an engine internal that may change between releases:
 * obtain values from the engine and pass them back to the engine — do not
 * construct or inspect them.
 *
 * Nominally branded with a `unique symbol`, so only engine-provided values
 * satisfy the type — a plain object is NOT assignable, keeping
 * {@link Texture2dSource} (and {@link Texture2d#getTexture}) honestly typed.
 */
export interface GPUResidentTexture {
	/**
	 * Phantom nominal brand — never present at runtime.
	 * @ignore
	 */
	readonly [gpuResidentBrand]: true;
}

/**
 * The backing source a {@link Texture2d} resolves to through
 * {@link Texture2d#getTexture}: a drawable (canvas/image) for CPU-backed
 * assets, or an opaque {@link GPUResidentTexture} for GPU-resident ones.
 */
export type Texture2dSource =
	| HTMLCanvasElement
	| HTMLImageElement
	| OffscreenCanvas
	| ImageBitmap
	| GPUResidentTexture;

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
 * Most assets are **CPU-backed** and resolve to a drawable canvas/image — those
 * are the ones assignable to {@link Sprite#image} / {@link Sprite#normalMap} /
 * an {@link ImageLayer} (which upload the drawable through the texture cache).
 * Subclasses may also be **GPU-resident**, resolving to an opaque renderer
 * backing that never leaves the GPU (e.g. the capture returned by
 * `renderer.toFrameTexture()`). A GPU-resident texture is **not** a drawable
 * source: use it as a custom-shader sampler via {@link ShaderEffect#setTexture}
 * (which binds its live GL handle), NOT as `Sprite#image`. The contract admits
 * both (a future WebGPU backend follows the same shape with a `GPUTexture`).
 *
 * Concrete implementations:
 * - {@link TextureAtlas} — packed multi-region sprite sheet (CPU-backed)
 * @category Game Objects
 */
export default abstract class Texture2d {
	/**
	 * Return the backing source for this texture — a drawable canvas/image for
	 * CPU-backed assets (assignable to {@link Sprite#image} /
	 * {@link Sprite#normalMap} / an {@link ImageLayer}), or an opaque
	 * GPU-resident backing for GPU-resident ones (bind those as a custom-shader
	 * sampler via {@link ShaderEffect#setTexture}; they are not drawable sources).
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
