/**
 * additional import for TypeScript
 * @import Renderer from "./../video/renderer.js";
 */

// `Camera2d` is type-only here — `cameraClass` accepts the constructor
// shape but this file never instantiates one. Importing as a value
// would pull the Camera module into the runtime graph along the
// `application → defaultApplicationSettings → settings` chain, opening
// a circular-import surface. Type-only import compiles away.
import type Camera2d from "../camera/camera2d";
import { RendererType } from "../const";
import { PhysicsAdapter } from "../physics/adapter";
import Renderer from "../video/renderer";
import { WebGLBatcher } from "../video/webgl/batchers/batcher.js";
import { ScaleMethod } from "./scaleMethods";

type BlendMode =
	| "normal"
	| "multiply"
	| "lighter"
	| "additive"
	| "screen"
	| "darken"
	| "lighten"
	| "exclusion"
	| "none"
	| "overlay"
	| "hard-light"
	| "color-dodge"
	| "color-burn"
	| "soft-light"
	| "difference";

/**
 * How the application's physics is configured.
 *
 * - `"builtin"` (default): auto-construct a {@link BuiltinAdapter} with default options.
 * - `"none"`: keep an adapter for API compatibility but skip the per-frame `step()` call (frozen world).
 * - `PhysicsAdapter` instance: use the given adapter (e.g. `new BuiltinAdapter({ gravity })`,
 *   or `new MatterAdapter()` from `@melonjs/matter-adapter`).
 * - `{ adapter: PhysicsAdapter }`: explicit form, reserved for future per-app physics options.
 */
type PhysicsType =
	| "builtin"
	| "none"
	| PhysicsAdapter
	| { adapter: PhysicsAdapter };

type PowerPreference = "default" | "low-power" | "high-performance";

export type ApplicationSettings = {
	/**
	 * Renderer to use. Four built-in modes (constants from `me.video`):
	 *
	 * - {@link AUTO} — negotiate the best available backend:
	 *   **WebGPU → WebGL 2 → Canvas**. `await app.init()` always
	 *   resolves under AUTO; the WebGPU attempt is a full adapter/device
	 *   negotiation awaited inside `init()`, falling through to the
	 *   synchronous candidates when it rejects. Under the Canvas tail the
	 *   GPU-only subsystems (Camera3d, retained meshes, ShaderEffect,
	 *   Light2d/Light3d shading, GPU tilemap) degrade or disable — gate on
	 *   the renderer capability flags (`supportsDepthBuffer`,
	 *   `shaderLanguage`, …) if your scene depends on them.
	 * - {@link WEBGPU} — require the WebGPU backend. `app.init()`
	 *   **rejects** when no adapter/device can be acquired — it never
	 *   substitutes another backend.
	 * - {@link WEBGL} — **requires WebGL 2** (the WebGL renderer is
	 *   WebGL 2 only since 20.0). `app.init()` **rejects** if a WebGL 2
	 *   context is unavailable (WebGL-1-only device, driver-blocklisted
	 *   GPU, perf-caveat failure, etc.) — fail fast rather than render a
	 *   stuck blank canvas.
	 * - {@link CANVAS} — the HTML5 Canvas backend. No programmable
	 *   pipeline: no shaders/lighting, no Camera3d/depth path (meshes
	 *   only render on the CPU-projected 2D-camera path).
	 *
	 * Or pass a custom `Renderer` subclass instance for full control.
	 * @default AUTO
	 */
	renderer: RendererType | Renderer;

	/**
	 * enable scaling of the canvas ('auto' for automatic scaling)
	 * @default 1
	 */
	scale: number | "auto";

	/**
	 * screen scaling modes
	 * @default "manual"
	 */
	scaleMethod: ScaleMethod;

	/**
	 * the HTML Element to be used as the reference target when using automatic scaling (by default melonJS will use the parent container of the div element containing the canvas)
	 */
	scaleTarget: HTMLElement;

	/**
	 * A hint to the user agent about which GPU to use on multi-GPU systems
	 * (discrete vs integrated). Browsers generally favour the low-power GPU
	 * unless asked otherwise, to preserve battery life.
	 *
	 * - `"default"` — no hint; let the user agent decide.
	 * - `"low-power"` — prefer the integrated GPU.
	 * - `"high-performance"` — prefer the discrete GPU. Note that browsers
	 *   only honour this for pages that handle context loss, since switching
	 *   GPU can drop the context; melonJS registers those handlers itself,
	 *   so the request is respected.
	 *
	 * The same hint (and the same values, minus `"default"`) is used by
	 * WebGPU's adapter request, so this setting is backend-neutral.
	 * @default "default"
	 */
	powerPreference: PowerPreference;

	/**
	 * whether to allow transparent pixels in the front buffer (screen).
	 * @default false
	 */
	transparent: boolean;

	/**
	 * whether to enable or not video scaling interpolation.
	 * On the GPU backends this drives polygon-edge antialiasing (up to
	 * 4× MSAA) — on the canvas itself, and equally through post-effect
	 * chains, whose scene capture targets are multisampled to match, so
	 * adding a camera effect never switches edge smoothing off. Texture
	 * sampling smoothness is controlled separately by `textureFilter`.
	 * Multisampled capture targets cost GPU memory (roughly 30 bytes per
	 * pixel at 4×, ~55 MB at 1080p on WebGL) — with `antiAlias: false`
	 * no multisampled storage is ever allocated.
	 * @default false
	 */
	antiAlias: boolean;

	/**
	 * Default texture magnification/minification filter, **decoupled from
	 * `antiAlias`** (GPU backends — WebGL and WebGPU; the 2D Canvas
	 * renderer has no per-texture filtering and ignores this).
	 *
	 * `antiAlias` conflates two separate concerns: polygon-edge antialiasing
	 * (MSAA) *and* texture sampling smoothness. This setting separates the
	 * texture half out, so you can choose them independently — e.g. smooth
	 * textures with no MSAA, or crisp pixel-art textures *with* MSAA edges.
	 *
	 * - `"auto"` (default) — follow `antiAlias` (`linear` when `true`, `nearest`
	 *   when `false`): unchanged behavior.
	 * - `"nearest"` — crisp/pixelated upscaling, regardless of `antiAlias`.
	 * - `"linear"` — smooth, regardless of `antiAlias`.
	 *
	 * This is the **default** for every texture; a {@link Mesh} can still override
	 * it per-mesh via its own `textureFilter` setting (which wins).
	 * @default "auto"
	 * @example
	 * // smooth textures but NO polygon-edge MSAA
	 * const app = new Application(1024, 768, {
	 *     renderer: video.WEBGL,
	 *     antiAlias: false,        // MSAA off
	 *     textureFilter: "linear", // textures still filtered smooth
	 * });
	 *
	 * // crisp pixel-art textures WITH MSAA-smoothed edges
	 * new Application(1024, 768, {
	 *     renderer: video.WEBGL,
	 *     antiAlias: true,          // MSAA on
	 *     textureFilter: "nearest", // textures stay crisp
	 * });
	 */
	textureFilter: "auto" | "nearest" | "linear";

	/**
	 * How many texture units the WebGL multi-texture batchers may use
	 * ([#1585](https://github.com/melonjs/melonJS/issues/1585)).
	 *
	 * A batch can draw sprites from this many distinct textures before it has
	 * to flush and start over, so a scene with more textures in flight than
	 * this loses batching sharply. The pool used to be hardcoded to 16 — the
	 * WebGL 2 spec *floor* for `MAX_TEXTURE_IMAGE_UNITS`, and roughly half
	 * what current desktop and mobile hardware reports.
	 *
	 * - `"auto"` (default) — the device's reported limit, capped at 32.
	 * - a number — that many units, clamped to what the device actually has
	 *   (asking for more than exists would fail to link the shader).
	 *
	 * Raising it costs fragment-shader compile time and register pressure,
	 * because the batcher's shader unrolls one sampler and one branch per
	 * unit. Lowering it is the escape hatch if a driver misbehaves on wide
	 * sampler ladders.
	 *
	 * **Read at initialization only** — the batchers compile their shaders
	 * against this value, so unlike `textureFilter` there is no runtime setter.
	 * WebGL only; the WebGPU backend sizes its own slot budget from its
	 * per-stage binding limits, and the Canvas renderer has no batching.
	 * @default "auto"
	 * @example
	 * // cap the pool on a device with a known-bad wide sampler ladder
	 * const app = new Application(1024, 768, {
	 *     renderer: video.WEBGL,
	 *     maxTextures: 16,
	 * });
	 */
	maxTextures: "auto" | number;

	/**
	 * whether 3D objects cast a soft "blob" shadow on the ground by default
	 * ([#1515](https://github.com/melonjs/melonJS/issues/1515)).
	 *
	 * A ground shadow is what stops a character or prop reading as *floating*
	 * in a 2.5D scene — it answers "where is this standing", not "where is the
	 * light". It is deliberately not a simulated shadow; see
	 * {@link Mesh#castGroundShadow}.
	 *
	 * This is the **default** for every {@link Mesh}, {@link Sprite3d} and
	 * {@link InstancedMesh}; each can override it with its own
	 * `castGroundShadow` (which wins), and {@link level.load} takes the same
	 * option for one glTF scene (which wins over this).
	 *
	 * Because it is a blanket opt-in, it skips meshes with **no vertical
	 * extent** — a flat plane lying on the floor *is* the floor, and shadowing
	 * it with itself would smear a blob across the whole ground. A per-object
	 * `castGroundShadow: true` bypasses that safeguard, being an explicit
	 * instruction.
	 *
	 * **On by default.** Requires a GPU backend *and* a {@link Camera3d}, so a
	 * 2D game is untouched whatever this says — the Canvas renderer has no
	 * depth buffer and the 2D-camera path draws none. Set it `false` to opt a
	 * 3D game out wholesale (a scene with baked lighting, or one bringing its
	 * own shadows, would otherwise get two).
	 * @default true
	 * @example
	 * // opt a 3D game out — e.g. its lighting is already baked into the models
	 * const app = new Application(1024, 768, {
	 *     cameraClass: Camera3d,
	 *     castGroundShadow: false,
	 * });
	 * await app.init();
	 */
	castGroundShadow: boolean;

	/**
	 * whether to display melonJS version and basic device information in the console
	 * @default true
	 */
	consoleHeader: boolean;

	/**
	 * the default blend mode to use. Both GPU renderers support the full set;
	 * the Canvas fallback supports every mode except `"none"` — see
	 * {@link CanvasRenderer#setBlendMode} for the list.
	 * @default "normal"
	 */
	blendMode: BlendMode;

	/**
	 * The physics system to use. Accepts:
	 * - `"builtin"` (default) — the built-in SAT physics adapter
	 * - `"none"` — disables physics; `World.step` skips the simulation,
	 *   the world container behaves like a pure scene graph
	 * - a `PhysicsAdapter` instance — e.g. `new MatterAdapter()` from
	 *   `@melonjs/matter-adapter`, or any third-party adapter
	 * - `{ adapter: PhysicsAdapter }` — explicit form, reserved for
	 *   future per-app physics options
	 *
	 * The adapter's `physicLabel` becomes `world.physic` so user code
	 * can branch on the active engine without importing the concrete
	 * adapter class (`app.world.physic === "matter"`, etc.).
	 * @default "builtin"
	 */
	physic: PhysicsType;

	/**
	 * Enable the GPU procedural shader path for orthogonal tile layers
	 * (backends advertising `renderer.supportsShaderTileLayers` — WebGL 2
	 * and WebGPU). When `true` (default), eligible layers render via a
	 * single quad per tileset + a fragment shader doing per-fragment GID
	 * lookup, bypassing the per-tile draw loop entirely. Layers that
	 * don't qualify (Canvas renderer, non-orthogonal,
	 * collection-of-image tilesets, tilerendersize "grid", non-zero
	 * tileoffset, oversampled beyond the shader's overflow window) fall
	 * back to the legacy path automatically.
	 * Set to `false` to disable globally.
	 * @default true
	 */
	gpuTilemap: boolean;
	/**
	 * If true, treat WebGL as unavailable when the browser warns that a
	 * context would perform dramatically worse than a native application
	 * (a software rasterizer, a blocklisted driver). Note this is stricter
	 * than the WebGL default, which is `false`.
	 *
	 * The WebGPU backend honors it too, by rejecting a fallback
	 * (software) adapter. The effect: under {@link AUTO} such a machine
	 * gets the Canvas renderer, and under {@link WEBGL} / {@link WEBGPU}
	 * `app.init()` rejects. Set to `false` to accept a software or
	 * blocklisted context instead.
	 * @default true
	 */
	failIfMajorPerformanceCaveat: boolean;

	/**
	 * enable high precision shaders (WebGL only).
	 * When false, shaders prefer "mediump" precision for better performance on
	 * some mobile GPUs, falling back to "lowp" if "mediump" is not supported.
	 * When true (default), the highest precision supported by the device is used.
	 * This setting is ignored by the Canvas renderer.
	 * @default true
	 * @example
	 * import { Application, device } from "melonjs";
	 * const app = new Application(800, 600, {
	 *     parent: "screen",
	 *     // prefer lower shader precision on mobile for better performance
	 *     highPrecisionShader: !device.isMobile,
	 * });
	 */
	highPrecisionShader: boolean;

	/**
	 * whether to enable sub-pixel rendering (avoid sprite flickering when using transforms)
	 * @default false
	 */
	subPixel: boolean;

	/**
	 * whether to enable verbose mode (additional console output for debugging)
	 * @default false
	 */
	verbose: boolean;

	/**
	 * the CSS background color of the parent element that holds the canvas.
	 * Applied during initialization to prevent a white flash before the first render.
	 * Set to `"transparent"` to disable, or any valid CSS color value.
	 * @default "#000000"
	 */
	backgroundColor: string;

	/**
	 * a custom batcher class (extend the active backend's base:
	 * `WebGLBatcher` / `WebGPUBatcher`)
	 * @deprecated since 18.1.0 — use `batcher` instead
	 */
	compositor?: (new (renderer: any) => WebGLBatcher) | undefined;

	/**
	 * a custom batcher class, riding the quad/primitive slots on either
	 * GPU backend — extend `WebGLBatcher` under WebGL, `WebGPUBatcher`
	 * under WebGPU (`addBatcher` rejects a wrong-backend class loudly)
	 */
	batcher?: (new (renderer: any) => WebGLBatcher) | undefined;

	/**
	 * Default camera class instantiated for any {@link Stage} that does not
	 * explicitly provide its own cameras. Set to {@link Camera3d} to opt
	 * every stage in the app into perspective rendering by default. Stages
	 * can still override per-instance via `super({ cameras: [...] })` or
	 * per-class via `super({ cameraClass: Camera2d })`. Built-in stages
	 * (e.g. the loader screen) explicitly use {@link Camera2d} regardless
	 * of this setting.
	 *
	 * **GPU-backend requirement.** Camera classes whose
	 * `static defaultSortOn === "depth"` (Camera3d and any subclass) need
	 * a renderer with a depth buffer (`renderer.supportsDepthBuffer` —
	 * WebGL 2 or WebGPU). Pairing such a `cameraClass` with
	 * `renderer: video.AUTO` on a system where AUTO falls back to Canvas
	 * emits a `console.warn` and produces a non-functional render. Pin
	 * `renderer: video.WEBGL` (or `WEBGPU`) to make `app.init()` reject
	 * instead.
	 * @default Camera2d
	 */
	cameraClass?: new (
		minX: number,
		minY: number,
		maxX: number,
		maxY: number,
	) => Camera2d;
} & (
	| {
			/**
			 * the DOM parent element (or its string ID) to hold the canvas in the HTML file
			 */
			parent: string | HTMLElement;
			canvas?: never;
	  }
	| {
			parent?: never;
			/**
			 * an existing canvas element to use as the renderer target
			 * (by default melonJS will create its own canvas based on given parameters)
			 */
			canvas: HTMLCanvasElement;
	  }
);

/**
 * Resolved application settings after init() has processed the input.
 * Includes computed properties not present in the user-facing settings.
 * Hidden from the docs but deliberately kept in the emitted `.d.ts`: another
 * emitted declaration imports this type, so removing it would leave a dangling
 * import in the published types.
 * @ignore
 */
export type ResolvedApplicationSettings = ApplicationSettings & {
	width: number;
	height: number;
	autoScale: boolean;
	zoomX: number;
	zoomY: number;
	scale: number;
};
