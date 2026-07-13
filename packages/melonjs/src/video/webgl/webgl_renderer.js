import { Color, colorPool } from "./../../math/color.ts";
import { isPowerOfTwo } from "./../../math/math.ts";
import { Matrix3d } from "../../math/matrix3d.ts";
import { Bounds } from "../../physics/bounds.ts";
import {
	CANVAS_ONRESIZE,
	emit,
	GAME_RESET,
	ONCONTEXT_LOST,
	ONCONTEXT_RESTORED,
	on,
	RENDER_TARGET_CHANGED,
} from "../../system/event.ts";
import { Gradient } from "../gradient.js";
import Renderer from "./../renderer.js";
import RenderTargetPool from "../rendertarget/render_target_pool.js";
import WebGLRenderTarget from "../rendertarget/webglrendertarget.js";
import { createAtlas, TextureAtlas } from "./../texture/atlas.js";
import TextureCache from "./../texture/cache.js";
import { FrameTexture } from "./../texture/frametexture.js";
import { dashPath, dashSegments } from "../utils/dash.js";
import {
	generateJoinCircles,
	generateTriangleFan,
} from "../utils/tessellation.js";
import LitMeshBatcher from "./batchers/lit_mesh_batcher";
import LitQuadBatcher from "./batchers/lit_quad_batcher";
import MeshBatcher from "./batchers/mesh_batcher";
import PrimitiveBatcher from "./batchers/primitive_batcher";
import QuadBatcher from "./batchers/quad_batcher";
import RadialGradientEffect from "./effects/radialGradient.js";
import { createLightUniformScratch, packLights } from "./lighting/pack.ts";
import OrthogonalTMXLayerGPURenderer from "./renderers/tmxlayer/orthogonal.js";
import { getMaxShaderPrecision } from "./utils/precision.js";

/**
 * additional import for TypeScript
 * @import {Rect} from "./../../geometries/rectangle.ts";
 * @import {RoundRect} from "./../../geometries/roundrect.ts";
 * @import {Polygon} from "../../geometries/polygon.ts";
 * @import {Line} from "./../../geometries/line.ts";
 * @import {Ellipse} from "./../../geometries/ellipse.ts";
 * @import {Matrix2d} from "../../math/matrix2d.ts";
 * @import {Matrix3d} from "../../math/matrix3d.ts";
 * @import {Batcher} from "./batchers/batcher.js";
 * @import {default as Texture2d} from "../texture/texture2d.ts";
 */

// reusable constants for 2D→3D matrix operations
const _tempMatrix = new Matrix3d();

// pre-allocated matrices for blitEffect (avoids per-frame allocation)
const _savedTransform = new Matrix3d();
const _savedProjection = new Matrix3d();

// list of supported compressed texture formats
let supportedCompressedTextureFormats;

/**
 * a WebGL renderer object
 * @category Rendering
 */
export default class WebGLRenderer extends Renderer {
	/**
	 * @param {ApplicationSettings} [options] - optional parameters for the renderer
	 */
	constructor(options) {
		// parent contructor
		super(Object.assign(options, { context: "webgl" }));

		/**
		 * The vendor string of the underlying graphics driver.
		 * @type {string}
		 * @default undefined
		 * @readonly
		 */
		this.GPUVendor = undefined;

		/**
		 * The renderer string of the underlying graphics driver.
		 * @type {string}
		 * @default undefined
		 * @readonly
		 */
		this.GPURenderer = undefined;

		/**
		 * The WebGL context
		 * @name gl
		 * @type {WebGLRenderingContext}
		 */
		this.gl = this.renderTarget.context;

		/**
		 * cached FBO for post-effect processing (lazily created on first use)
		 * @type {WebGLRenderTarget|null}
		 * @ignore
		 */
		// initialize the render target pool with a WebGL factory
		this._renderTargetPool = new RenderTargetPool((w, h) => {
			return new WebGLRenderTarget(this.gl, w, h);
		});

		/**
		 * Saved projection matrix for begin/endPostEffect.
		 * @type {Matrix3d}
		 * @ignore
		 */
		// projections saved by beginPostEffect, one per (possibly nested)
		// active pass — preallocated slots + a depth counter (zero-alloc
		// steady state), matching RenderTargetPool's base stack
		this._effectProjectionStack = [];
		this._effectPassDepth = 0;

		/**
		 * sets or returns the thickness of lines for shape drawing
		 * @type {number}
		 * @default 1
		 */
		this.lineWidth = 1;

		/**
		 * sets or returns the shape used to join two line segments where they meet.
		 * Out of the three possible values for this property: "round", "bevel", and "miter", only "round" is supported for now in WebGL
		 * @type {string}
		 * @default "round"
		 */
		this.lineJoin = "round";

		/**
		 * the vertex buffer used by this WebGL Renderer
		 * @type {WebGLBuffer}
		 */
		this.vertexBuffer = this.gl.createBuffer();

		/**
		 * Maximum number of texture unit supported under the current context
		 * @type {number}
		 * @readonly
		 */
		this.maxTextures = this.gl.getParameter(this.gl.MAX_TEXTURE_IMAGE_UNITS);

		/**
		 * the default shader precision based on application settings
		 * @type {string}
		 * @ignore
		 */
		this.shaderPrecision = getMaxShaderPrecision(
			this.gl,
			this.settings.highPrecisionShader !== false,
		);

		/**
		 * reusable scratch array for fillRect (2 triangles = 6 vertices)
		 * @ignore
		 */
		this._rectTriangles = Array.from({ length: 6 }, () => {
			return { x: 0, y: 0 };
		});

		// scratch AABB reused by `clipRect` for screen-space corner
		// transforms, kept on the instance so the call doesn't allocate.
		this._clipAABB = new Bounds();

		// scratch array for fillPolygon to avoid mutating polygon points
		this._polyVerts = [];

		// current gradient state (null when using solid color)
		this._currentGradient = null;

		// the stencil value of currently-VISIBLE pixels under the innermost
		// active mask, as installed by setMask (0 for an inverted mask,
		// maskLevel otherwise) — the single source #gradientMask gates and
		// restores against
		this._maskVisibleRef = 0;

		/**
		 * The current transformation matrix used for transformations on the overall scene
		 * (alias to renderState.currentTransform for backward compatibility)
		 * @type {Matrix3d}
		 */
		this.currentTransform = this.renderState.currentTransform;

		/**
		 * The current batcher used by the renderer
		 * @type {Batcher}
		 */
		this.currentBatcher = undefined;

		/**
		 * a reference to the current shader program used by the renderer
		 * @type {WebGLProgram}
		 */
		this.currentProgram = undefined;

		/**
		 * the GL texture unit currently active (`gl.activeTexture`) — global
		 * GL state, so tracked once per renderer and shared by every batcher
		 * through the `MaterialBatcher.currentTextureUnit` accessor. `-1`
		 * forces the next bind to re-issue `gl.activeTexture`.
		 * @type {number}
		 * @ignore
		 */
		this._activeTextureUnit = -1;

		/**
		 * The list of active batchers
		 * @type {Map<Batcher>}
		 */
		this.batchers = new Map();

		// bind the vertex buffer
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);

		// Create the default batchers. The lit-aware quad batcher is only
		// created when no custom batcher override is supplied — its lit
		// fragment path needs the paired (color, normal) sampler layout.
		const CustomBatcher = this.settings.batcher || this.settings.compositor;
		this.addBatcher(new (CustomBatcher || QuadBatcher)(this), "quad", true);
		if (!CustomBatcher) {
			this.addBatcher(new LitQuadBatcher(this), "litQuad");
		}
		this.addBatcher(new (CustomBatcher || PrimitiveBatcher)(this), "primitive");
		this.addBatcher(new MeshBatcher(this), "mesh");
		this.addBatcher(new LitMeshBatcher(this), "litMesh");

		// default WebGL state(s)
		// depth testing disabled for 2D (painter's algorithm handles z-ordering).
		// `MeshBatcher.bind()` enables it temporarily for 3D mesh rendering.
		this.gl.disable(this.gl.DEPTH_TEST);
		this.gl.depthMask(false);

		this.gl.disable(this.gl.SCISSOR_TEST);
		this._scissorActive = false;
		this.gl.enable(this.gl.BLEND);

		// set default mode
		this.setBlendMode(this.settings.blendMode);

		// get GPU vendor and renderer
		const debugInfo = this.gl.getExtension("WEBGL_debug_renderer_info");
		if (debugInfo !== null) {
			this.GPUVendor = this.gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
			this.GPURenderer = this.gl.getParameter(
				debugInfo.UNMASKED_RENDERER_WEBGL,
			);
		}

		// customShader is declared on the base Renderer class

		// Create a texture cache
		this.cache = new TextureCache(this, this.maxTextures);

		// set the renderer type
		this.type = "WebGL" + this.WebGLVersion;

		// to simulate context lost and restore in WebGL:
		// let ctx = me.video.renderer.context.getExtension('WEBGL_lose_context');
		// ctx.loseContext()
		this.getCanvas().addEventListener(
			"webglcontextlost",
			(e) => {
				e.preventDefault();
				this.isContextValid = false;
				// driver auto-frees lost resources; just drop the ref
				this.vertexBuffer = null;
				emit(ONCONTEXT_LOST, this);
			},
			false,
		);
		this.getCanvas().addEventListener(
			"webglcontextrestored",
			() => {
				// restore renderer-owned GL state before downstream subscribers run
				this.vertexBuffer = this.gl.createBuffer();
				this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);

				// driver wipes all GL state on restore; re-apply ours
				this.gl.disable(this.gl.DEPTH_TEST);
				this.gl.depthMask(false);
				this.gl.disable(this.gl.SCISSOR_TEST);
				this._scissorActive = false;
				this.gl.enable(this.gl.BLEND);
				// invalidate the blend cache: blendFunc/blendEquation are back
				// at driver defaults, so a matching cached mode would otherwise
				// short-circuit setBlendMode and never re-apply them
				this.currentBlendMode = undefined;
				this.setBlendMode(this.settings.blendMode);

				// reset() re-inits batchers, FBO pool, light shader, TMX renderer
				this.reset();

				// stale per-source unit assignments — force re-upload on next draw
				this.cache.units.clear();
				this.cache.usedUnits.clear();

				// the restored context is back at TEXTURE0 — invalidate the
				// shared active-unit tracking so the next bind re-issues it
				this._activeTextureUnit = -1;

				this.isContextValid = true;
				emit(ONCONTEXT_RESTORED, this);
			},
			false,
		);

		// reset the renderer on game reset
		on(GAME_RESET, () => {
			this.reset();
		});

		// register to the CANVAS resize channel
		on(CANVAS_ONRESIZE, (width, height) => {
			this.flush();
			this.setViewport(0, 0, width, height);
			// FBOs are lazily resized in beginPostEffect via get() → resize()
		});
	}

	/**
	 * The WebGL version used by this renderer (1 or 2)
	 * @type {number}
	 * @default 1
	 */
	get WebGLVersion() {
		return this.renderTarget.WebGLVersion;
	}

	/**
	 * return the list of supported compressed texture formats
	 * @return {Object}
	 */
	getSupportedCompressedTextureFormats() {
		if (typeof supportedCompressedTextureFormats === "undefined") {
			const gl = this.gl;
			if (typeof gl === "undefined" || gl === null) {
				// WebGL context not available
				return super.getSupportedCompressedTextureFormats();
			}
			supportedCompressedTextureFormats = {
				astc:
					gl.getExtension("WEBGL_compressed_texture_astc") ||
					gl.getExtension("WEBKIT_WEBGL_compressed_texture_astc"),
				bptc:
					gl.getExtension("EXT_texture_compression_bptc") ||
					gl.getExtension("WEBKIT_EXT_texture_compression_bptc"),
				s3tc:
					gl.getExtension("WEBGL_compressed_texture_s3tc") ||
					gl.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc"),
				s3tc_srgb:
					gl.getExtension("WEBGL_compressed_texture_s3tc_srgb") ||
					gl.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc_srgb"),
				pvrtc:
					gl.getExtension("WEBGL_compressed_texture_pvrtc") ||
					gl.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc"),
				etc1:
					gl.getExtension("WEBGL_compressed_texture_etc1") ||
					gl.getExtension("WEBKIT_WEBGL_compressed_texture_etc1"),
				etc2:
					gl.getExtension("WEBGL_compressed_texture_etc") ||
					gl.getExtension("WEBKIT_WEBGL_compressed_texture_etc") ||
					gl.getExtension("WEBGL_compressed_texture_es3_0"),
			};
			// ETC2 is a superset of ETC1 — if we have ETC2 but not ETC1,
			// synthesize ETC1 support so that PKM/KTX ETC1 textures work
			if (
				!supportedCompressedTextureFormats.etc1 &&
				supportedCompressedTextureFormats.etc2
			) {
				supportedCompressedTextureFormats.etc1 = {
					COMPRESSED_RGB_ETC1_WEBGL: 0x8d64,
				};
			}
		}
		return supportedCompressedTextureFormats;
	}

	/**
	 * return true if the given compressed texture format is supported
	 * @param {Number} format
	 * @returns
	 */
	hasSupportedCompressedFormats(format) {
		const supportedFormats = this.getSupportedCompressedTextureFormats();
		for (const supportedFormat in supportedFormats) {
			for (const extension in supportedFormats[supportedFormat]) {
				if (format === supportedFormats[supportedFormat][extension]) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Reset context state
	 */
	/**
	 * Tear down this renderer and free GPU/event resources. Walks every
	 * registered batcher's `destroy()` so cross-renderer subscriptions
	 * (`GPU_TEXTURE_CACHE_RESET` on `MaterialBatcher`, etc.) don't
	 * leak across `Application.destroy()` cycles. Safe to call multiple
	 * times — subsequent calls are no-ops.
	 */
	destroy() {
		if (this.batchers) {
			this.batchers.forEach((batcher) => {
				batcher.destroy?.();
			});
			this.batchers.clear();
		}
	}

	reset() {
		super.reset();

		// drop any pass state orphaned by a mid-pass exception — a stale
		// depth would misalign every later pass and inflate the pool's
		// nesting forever (the pool's own stack is cleared via its
		// destroy() below; the preallocated slots are kept for reuse)
		this._effectPassDepth = 0;

		// clear gl context
		this.clear();

		// drop every per-layer GPU tilemap texture — tile layers churn on
		// game reset and we'd otherwise leak a WebGLTexture per layer
		// across each level transition
		this._orthogonalTMXGPURenderer?.reset();

		// initial viewport size
		this.setViewport();

		// rebind the vertex buffer if required (e.g in case of context loss)
		if (
			this.gl.getParameter(this.gl.ARRAY_BUFFER_BINDING) !== this.vertexBuffer
		) {
			this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
		}

		this.currentBatcher = undefined;
		this.currentProgram = undefined;
		this.customShader = undefined;

		this.batchers.forEach((batcher) => {
			if (this.isContextValid === false) {
				// on context lost/restore
				batcher.init(this);
			} else {
				batcher.reset();
			}
		});

		this.setBatcher("quad");

		this.gl.disable(this.gl.SCISSOR_TEST);
		this._scissorActive = false;

		// release post-process FBOs (will be recreated on demand)
		this._renderTargetPool.destroy();

		// drop the lazily-cached drawLight resources — after a context
		// loss/restore the cached shader program and white-pixel atlas
		// reference the OLD GL context and would error if reused.
		// Lazy re-init happens on the next drawLight call.
		if (this._lightShader !== undefined) {
			this._lightShader.destroy?.();
			this._lightShader = undefined;
		}
		if (this._lightAtlas !== undefined) {
			// `TextureCache` is keyed by the source image, not by the
			// `TextureAtlas` instance. Dropping the wrong key would leak
			// the entry (so a context lost / restore would later resolve
			// the canvas to a `TextureAtlas` whose internal GL texture
			// reference is invalid). Iterate the atlas's sources to drop
			// every cached entry it registered in `cache.set(source, this)`.
			this._lightAtlas.sources.forEach((source) => {
				this.cache.delete?.(source);
			});
			this._lightAtlas = undefined;
		}

		// the shared frame-capture texture (toFrameTexture) holds a GL texture
		// tied to this context — drop it so the next capture reallocates. Safe
		// on a still-valid context too (a resize/reset just re-creates it).
		if (typeof this._frameTexture !== "undefined") {
			this._frameTexture.destroy();
			this._frameTexture = undefined;
		}

		// Context-loss-only cleanup for the TMX GPU renderer: the cached
		// `GLShader` and per-layer GL textures reference the OLD context
		// and are invalid. On a regular `GAME_RESET` (context still
		// valid) we already dropped per-layer textures via `.reset()`
		// above and keep the renderer instance so its compiled shader
		// program survives across level transitions instead of leaking a
		// `WebGLProgram` per reset and re-paying the compile cost.
		if (this.isContextValid === false) {
			this._orthogonalTMXGPURenderer = undefined;
		}
	}

	/**
	 * Draw a TMX tile layer through whichever path the layer's `renderMode`
	 * resolves to. WebGL2-eligible layers (`renderMode === "shader"`) take
	 * the procedural shader path — one quad per tileset, GID lookup in a
	 * per-layer data texture. All other layers fall through to the base
	 * `Renderer.drawTileLayer` (preRender blit or per-tile loop).
	 * @param {object} layer - the TMXLayer to draw
	 * @param {object} rect - the visible region in world coords
	 */
	drawTileLayer(layer, rect) {
		if (layer.renderMode === "shader") {
			const gpu = this._getTMXGPURendererFor(layer.orientation);
			if (gpu !== undefined) {
				gpu.draw(layer, rect);
				return;
			}
		}
		super.drawTileLayer(layer, rect);
	}

	/**
	 * Lazy-init the orientation-specific GPU tilemap renderer.
	 * @param {string} orientation
	 * @returns {object|undefined}
	 * @ignore
	 */
	_getTMXGPURendererFor(orientation) {
		if (orientation === "orthogonal") {
			if (this._orthogonalTMXGPURenderer === undefined) {
				try {
					this._orthogonalTMXGPURenderer = new OrthogonalTMXLayerGPURenderer(
						this,
					);
				} catch (err) {
					// shader compile / link failure on this driver — disable
					// the GPU path permanently for the rest of the session
					// (the next `drawTileLayer` call falls through to the
					// legacy renderer). Stored as `null` so subsequent
					// attempts short-circuit without re-trying the failing
					// compile every frame.
					console.warn(
						"melonJS: GPU tilemap shader failed to compile, falling back to legacy renderer",
						err,
					);
					this._orthogonalTMXGPURenderer = null;
				}
			}
			return this._orthogonalTMXGPURenderer || undefined;
		}
		// isometric / staggered / hexagonal: phase 2
		return undefined;
	}

	/**
	 * add a new batcher to this renderer
	 * @param {Batcher} batcher - a batcher instance
	 * @param {string} name - a name uniquely identifying this batcher
	 * @param {boolean} [activate=false] - true if the given batcher should be set as the active one
	 */
	addBatcher(batcher, name = "default", activate = false) {
		if (typeof this.batchers.get(name) !== "undefined") {
			throw new Error("Invalid Batcher name");
		}

		this.batchers.set(name, batcher);

		if (activate === true) {
			this.setBatcher(name);
		}
	}

	/**
	 * set the active batcher for this renderer
	 * @param {string} name - a batcher name
	 * @param {GLShader} [shader] - an optional shader program to be used, instead of the default one, when activating the batcher
	 * @returns {Batcher} an instance to the current active batcher
	 */
	setBatcher(name = "default", shader) {
		const batcher = this.batchers.get(name);

		if (typeof batcher === "undefined") {
			throw new Error("Invalid Batcher");
		}

		// resolve the target shader — the explicitly-passed one if any,
		// otherwise the batcher's default. We always reconcile the
		// currentShader to this target so a custom shader left bound by a
		// prior call (e.g. `drawLight` parking the radial-gradient
		// program) gets evicted before the next sprite batch flushes.
		// `shader != null` excludes both `null` and `undefined`
		// (`typeof null === "object"` would otherwise let null through).
		const targetShader = shader != null ? shader : batcher.defaultShader;

		if (
			this.currentBatcher === batcher &&
			batcher.currentShader === targetShader
		) {
			// fast path: same batcher, same shader — nothing to do.
			return this.currentBatcher;
		}

		if (this.currentBatcher !== batcher) {
			if (this.currentBatcher !== undefined) {
				// flush the current batcher, then let it tear down any
				// state it set up at `bind()` time (Mesh batcher restores
				// non-mesh blend/depth defaults here, for example)
				this.currentBatcher.flush();
				this.currentBatcher.unbind();
			}
			// rebind the renderer's shared vertex buffer (custom batchers may have bound their own)
			this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
			this.currentBatcher = batcher;
			// `bind()` is where each batcher sets up its own GL state
			// (vertex attributes, plus mode-specific state like depth /
			// blend for `MeshBatcher`). Renderer doesn't need to know.
			this.currentBatcher.bind();
			// sync the projection matrix to the new batcher
			this.currentBatcher.setProjection(this.projectionMatrix);
		}

		// useShader() is internally a no-op when the shader is already
		// bound; it flushes and rebinds otherwise. Pending vertices that
		// were queued under the prior shader get drained against that
		// shader before the switch, which is exactly what we want.
		this.currentBatcher.useShader(targetShader);

		return this.currentBatcher;
	}

	/**
	 * Reset the gl transform to identity
	 */
	resetTransform() {
		this.currentTransform.identity();
	}

	/**
	 * Create a pattern with the specified repetition
	 * @param {HTMLImageElement|SVGImageElement|HTMLVideoElement|HTMLCanvasElement|ImageBitmap|OffscreenCanvas|VideoFrame} image - Source image to be used as the pattern's image
	 * @param {string} [repeat="no-repeat"] - Define how the pattern should be repeated. One of `"repeat"` / `"repeat-x"` / `"repeat-y"` / `"no-repeat"`.
	 * @returns {TextureAtlas} the patterned texture created
	 * @see ImageLayer#repeat
	 * @example
	 * let tileable   = renderer.createPattern(image, "repeat");
	 * let horizontal = renderer.createPattern(image, "repeat-x");
	 * let vertical   = renderer.createPattern(image, "repeat-y");
	 * let basic      = renderer.createPattern(image, "no-repeat");
	 */
	createPattern(image, repeat = "no-repeat") {
		this.setBatcher("quad");

		if (
			this.WebGLVersion === 1 &&
			(!isPowerOfTwo(image.width) || !isPowerOfTwo(image.height))
		) {
			const src = typeof image.src !== "undefined" ? image.src : image;
			throw new Error(
				"[WebGL Renderer] " +
					src +
					" is not a POT texture " +
					"(" +
					image.width +
					"x" +
					image.height +
					")",
			);
		}

		// No band-aid texture cleanup here anymore — the cache's
		// `(source, repeat)` unit keying (see `TextureCache.getUnit` /
		// `peekUnit` / `freeTextureUnit`, which inline the `(source,
		// repeat)` lookup) already separates this call from any
		// previous createPattern over the same image with a different
		// repeat mode. A repeat match against an existing call reuses
		// the same unit, and `uploadTexture`'s `boundTextures[unit]`
		// check short-circuits a redundant GL upload. Fixes #1448 (the
		// prior delete-and-replace trampled the still-live pattern
		// returned by the earlier call).
		const texture = new TextureAtlas(
			createAtlas(image.width, image.height, "pattern", repeat),
			image,
		);

		this.currentBatcher.uploadTexture(texture);

		return texture;
	}

	/**
	 * Flush the batcher to the frame buffer
	 */
	flush() {
		this.currentBatcher.flush();
	}

	/**
	 * Upload per-frame Light2d uniforms used by the lit sprite pipeline.
	 *
	 * Packs the active lights into pre-allocated scratch buffers, then
	 * forwards to `LitQuadBatcher`. Light positions are translated from
	 * world-space (where `light.getBounds().centerX/Y` lives) into the
	 * renderer's pre-projection coords by subtracting `(translateX, translateY)`,
	 * matching what `Stage.drawLighting` does for the cutout pass — so
	 * the lit fragment's `lightPos - vWorldPos` math lines up with the
	 * camera's view.
	 *
	 * Lights past `MAX_LIGHTS` (8) are silently dropped. Also caches the
	 * active light count on the renderer so `drawImage` can dispatch
	 * normal-mapped sprites to the lit batcher only when there's
	 * something to light them with.
	 * @param {Iterable<object>} [lights] - active `Light2d` instances; falsy/empty no-ops the lit pipeline
	 * @param {object} [ambient] - ambient lighting color (0..255 RGB); defaults to black
	 * @param {number} [translateX=0] - world-to-screen X translate (matches `Camera2d.draw()`)
	 * @param {number} [translateY=0] - world-to-screen Y translate
	 */
	setLightUniforms(lights, ambient, translateX = 0, translateY = 0) {
		// scratch is allocated lazily on first call so non-lit scenes
		// don't pay for it
		if (this._lightUniformsScratch === undefined) {
			this._lightUniformsScratch = createLightUniformScratch();
		}
		const u = packLights(
			lights,
			ambient,
			translateX,
			translateY,
			this._lightUniformsScratch,
		);

		this.activeLightCount = u.count;
		const lit = this.batchers.get("litQuad");
		if (lit && typeof lit.setLightUniforms === "function") {
			lit.setLightUniforms(u);
			// `GLShader.setUniform` calls `gl.useProgram` internally to
			// guarantee the right program is active for the upload. Since
			// litQuad is rarely the *active* batcher (most frames have no
			// lights and route through the unlit `quad`), restore the
			// active batcher's program so the next draw doesn't render
			// through litQuad's shader by accident — which feeds 4-attribute
			// vertex data to a 5-attribute shader and produces visible garbage.
			if (this.currentBatcher && this.currentBatcher !== lit) {
				const shader =
					this.currentBatcher.currentShader ||
					this.currentBatcher.defaultShader;
				if (shader) {
					this.gl.useProgram(shader.program);
					this.currentProgram = shader.program;
				}
			}
		}
	}

	/**
	 * @inheritdoc
	 *
	 * Renders the light as a quad through a shared
	 * {@link RadialGradientEffect} fragment shader (procedural — no
	 * per-light texture). The shader and a shared 1×1 white-pixel atlas
	 * are lazy-allocated on first call and reused for every Light2d on
	 * this renderer. Each light's color and intensity are encoded into
	 * the per-vertex tint so consecutive `drawLight` calls accumulate
	 * into the quad batcher's buffer and flush together — N lights
	 * become 1 program switch + 1 flush instead of 2N + N.
	 * @param {object} light - the Light2d instance to render
	 */
	drawLight(light) {
		if (this._lightShader === undefined) {
			this._lightShader = new RadialGradientEffect(this);
		}
		// `setBatcher("quad", _lightShader)` switches the quad batcher's
		// shader to the radial gradient if it isn't already bound (and
		// flushes any sprite vertices queued under the previous shader).
		// On subsequent back-to-back `drawLight` calls this is a no-op,
		// so the lights pile into the same vertex buffer.
		const batcher = this.setBatcher("quad", this._lightShader);
		batcher.addQuad(
			this._getLightAtlas(),
			light.pos.x,
			light.pos.y,
			light.width,
			light.height,
			0,
			0,
			1,
			1,
			// pack the light's color (RGB) and intensity (A) into the
			// vertex tint — the shader's `apply()` reads `color.rgb` and
			// `color.a` as the per-light values.
			light.color.toUint32(light.intensity),
		);
		// Note: we deliberately do NOT switch back to the default shader
		// here. The next `setBatcher` call (sprites, primitives, etc.)
		// will reconcile to the right shader on its own (see
		// `setBatcher`), and that's what unlocks the cross-light batch.
	}

	/**
	 * Lazy-init a shared 1×1 white `TextureAtlas` used as the source
	 * texture for `drawLight`'s procedural shader. The shader ignores
	 * the sampled color, but `addQuad`'s vertex format includes a
	 * texture-unit attribute so we still need a real texture; sharing
	 * one across every light keeps them on the same multi-texture slot
	 * (no flush on light switch).
	 * @returns {TextureAtlas}
	 * @ignore
	 */
	_getLightAtlas() {
		if (this._lightAtlas === undefined) {
			// build a 1×1 white canvas — TextureAtlas wants an image-like
			// source that can feed `gl.texImage2D` directly.
			const canvas = globalThis.document
				? globalThis.document.createElement("canvas")
				: new OffscreenCanvas(1, 1);
			canvas.width = 1;
			canvas.height = 1;
			const ctx = canvas.getContext("2d");
			ctx.fillStyle = "#fff";
			ctx.fillRect(0, 0, 1, 1);
			this._lightAtlas = new TextureAtlas(
				createAtlas(1, 1, "lightWhite", "no-repeat"),
				canvas,
			);
		}
		return this._lightAtlas;
	}

	/**
	 * Capture the current frame — everything drawn to the active framebuffer so
	 * far — into a {@link Texture2d}, entirely on the GPU (a `copyTexImage2D` on
	 * the first capture, then `copyTexSubImage2D` to refresh in place; no
	 * `readPixels` round-trip or pipeline stall). The fourth member of the
	 * {@link Renderer#toDataURL} / {@link Renderer#toBlob} /
	 * {@link Renderer#toImageBitmap} family — "the current frame as X" — and the
	 * only one whose result never leaves the GPU.
	 *
	 * The capture reflects the framebuffer **at the call site** (a `flush()`
	 * runs first), so call it right before drawing the surface that needs the
	 * backdrop — the classic back-buffer-copy placement model. It reads whichever
	 * framebuffer is currently bound: the backbuffer normally, or a camera's
	 * post-effect FBO during that pass — so it works under both `Camera2d` and
	 * `Camera3d`. Under a perspective camera, "drawn so far" is draw order, not
	 * depth order: capture after the opaque scene, just before the refracting
	 * surface (the usual opaque-scene-texture guidance).
	 *
	 * Feed the result straight into a custom post-effect:
	 * ```js
	 * effect.setTexture("uScene", renderer.toFrameTexture());
	 * ```
	 * {@link ShaderEffect#setTexture} binds the **live** handle, so re-capturing
	 * each frame into the shared slot refreshes what the shader samples without
	 * any re-bind.
	 *
	 * Color only, captured into an RGB texture (opaque — samples with alpha = 1);
	 * the framebuffer's depth is not captured. By default the result is a shared,
	 * renderer-owned texture valid until the next parameterless call — pass
	 * `options.target` for an independent, caller-owned capture (e.g. two
	 * captures alive in the same frame).
	 * @param {object} [options]
	 * @param {Texture2d|null} [options.target] - controls the destination: omit
	 *   for the shared renderer slot (default); pass a capture previously
	 *   returned by this method to refresh it in place; pass `null` to mint a
	 *   fresh, caller-owned capture (for two independent captures in one frame —
	 *   `destroy()` it yourself when done)
	 * @param {Bounds|{x: number, y: number, width: number, height: number}} [options.region] - capture
	 *   only this sub-region (framebuffer pixels, bottom-left origin); a smaller
	 *   region is a proportionally cheaper copy. Defaults to the whole framebuffer.
	 *   A {@link Bounds} (or any `{x, y, width, height}`); from a {@link Rect}
	 *   pass `rect.getBounds()`.
	 * @returns {Texture2d} a GPU-resident texture holding the captured frame
	 * @example
	 * // a water surface that refracts the scene rendered behind it
	 * draw(renderer) {
	 *     const scene = renderer.toFrameTexture();          // grab the backdrop
	 *     this.shader.setTexture("uScene", scene);          // live-bound
	 *     super.draw(renderer);                             // draw the rippling water
	 * }
	 */
	toFrameTexture(options = {}) {
		const gl = this.gl;
		const canvas = this.getCanvas();

		// resolve the capture rect in framebuffer pixels (default: everything).
		// a Bounds — or any object exposing numeric x/y/width/height (a Rect via
		// `rect.getBounds()`).
		let x = 0;
		let y = 0;
		let w = canvas.width;
		let h = canvas.height;
		const region = options.region;
		if (typeof region !== "undefined") {
			const rx = region.x;
			const ry = region.y;
			// clamp the ORIGIN into the framebuffer first, then size to what
			// remains — an out-of-range x/y must not push x+w past the edge, or
			// copyTex(Sub)Image2D throws INVALID_VALUE. Missing width/height
			// defaults to "the rest of the framebuffer from x/y".
			x = Math.min(Math.max(0, Math.floor(rx || 0)), canvas.width - 1);
			y = Math.min(Math.max(0, Math.floor(ry || 0)), canvas.height - 1);
			const rw = Number.isFinite(region.width)
				? Math.ceil(region.width)
				: canvas.width - x;
			const rh = Number.isFinite(region.height)
				? Math.ceil(region.height)
				: canvas.height - y;
			w = Math.max(1, Math.min(canvas.width - x, rw));
			h = Math.max(1, Math.min(canvas.height - y, rh));
		}

		// flush pending geometry so the capture holds everything drawn so far
		this.flush();

		// a non-null `target` must be a capture THIS renderer previously returned
		// (a FrameTexture) — any other Texture2d has no `glTexture`, and a capture
		// from a different renderer would delete textures on the wrong GL context
		if (typeof options.target !== "undefined" && options.target !== null) {
			if (!(options.target instanceof FrameTexture)) {
				throw new Error(
					"WebGLRenderer.toFrameTexture: `target` must be a capture returned by this method",
				);
			}
			if (options.target._renderer !== this) {
				throw new Error(
					"WebGLRenderer.toFrameTexture: `target` belongs to a different renderer",
				);
			}
		}

		// destination:
		//  - no `target`            → the shared, renderer-owned slot (default;
		//                             overwritten by the next parameterless call)
		//  - `target: null`         → mint a fresh, caller-owned capture (for two
		//                             independent captures alive in one frame)
		//  - `target: <capture>`    → refresh that caller-owned capture in place
		const shared = typeof options.target === "undefined";
		let frame = shared
			? this.getSharedFrameTexture()
			: options.target === null
				? undefined
				: options.target;

		// (re)allocate when missing, resized, or the GL handle went stale (a
		// context-loss/restore cycle deletes it — gl.isTexture catches that)
		if (
			typeof frame === "undefined" ||
			frame.width !== w ||
			frame.height !== h ||
			frame.glTexture === null ||
			gl.isTexture(frame.glTexture) === false
		) {
			if (typeof frame !== "undefined") {
				frame.destroy();
				frame.width = w;
				frame.height = h;
			} else {
				frame = new FrameTexture(this, w, h);
			}
			if (shared) {
				this._frameTexture = frame;
			}
		}

		// Copy the bound framebuffer into the capture texture — the standard
		// framebuffer→texture path (Three.js copyFramebufferToTexture uses it).
		// An RGB internalformat is a valid subset of BOTH an alpha-less default
		// framebuffer (melonJS creates the context with `alpha: transparent`,
		// usually false) AND an RGBA camera FBO, so the copy never trips
		// INVALID_OPERATION on a format mismatch, and the capture samples as an
		// opaque backdrop (alpha = 1). Unlike a blitFramebuffer destination —
		// which some drivers won't sample in the same frame — an RGB texture
		// copied this way samples reliably everywhere.
		const batcher = this.setBatcher("quad");
		const unit = batcher.maxBatchTextures - 1;
		if (frame.glTexture === null) {
			// first capture into this slot: copyTexImage2D allocates the RGB
			// storage AND copies in one call
			frame.glTexture = gl.createTexture();
			batcher.bindTexture2D(frame.glTexture, unit, false);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGB, x, y, w, h, 0);
		} else {
			// steady state: refresh the existing storage in place — no per-frame
			// reallocation. Same size is guaranteed (a size change nulls
			// glTexture above via the shared-slot realloc), so copyTexSubImage2D
			// is valid and copies RGB from either an RGB or RGBA source.
			batcher.bindTexture2D(frame.glTexture, unit, false);
			gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, x, y, w, h);
		}

		// the scratch bind clobbered GL `unit` OUTSIDE the shared texture-cache
		// accounting (bound directly, not via allocateTextureUnit), so other
		// batchers' unit caches don't know it changed — invalidate it on all of
		// them (see invalidateTextureUnit).
		this.invalidateTextureUnit(unit);

		return frame;
	}

	/**
	 * The renderer-owned shared frame-capture slot, minted lazily so it has a
	 * stable identity from the moment an effect is constructed — before the
	 * first actual capture fills it (`glTexture` stays `null` until then, and
	 * the live-sampler bind path skips unfilled captures). `ShaderEffect`
	 * wires `: screen_texture` annotated samplers to this object.
	 * @returns {FrameTexture} the shared capture slot
	 * @ignore
	 */
	getSharedFrameTexture() {
		if (typeof this._frameTexture === "undefined") {
			const canvas = this.getCanvas();
			this._frameTexture = new FrameTexture(this, canvas.width, canvas.height);
		}
		return this._frameTexture;
	}

	/**
	 * Forget the cached binding for GL texture `unit` on every batcher (except
	 * `except`). Call this whenever a texture is bound to a unit **directly** —
	 * bypassing the shared texture cache and its `GPU_TEXTURE_CACHE_RESET`
	 * coordination — as {@link WebGLRenderer#toFrameTexture}'s capture copy and
	 * {@link ShaderEffect#_prepareTextures}'s reserved extra samplers both do.
	 * Those binds land on the TOP of the unit range, which overlaps the lit quad
	 * batcher's normal-map units; without invalidation a later lit draw would
	 * assume its normal map is still resident there and skip re-binding it,
	 * sampling the directly-bound texture as a normal map (wrong lighting).
	 * @param {number} unit - the GL texture unit that was clobbered
	 * @param {Batcher} [except] - a batcher to skip (the one that just bound the
	 *   texture — its own cache is already accurate)
	 * @ignore
	 */
	invalidateTextureUnit(unit, except) {
		for (const b of this.batchers.values()) {
			if (b !== except) {
				b.invalidateUnit?.(unit);
			}
		}
	}

	/**
	 * Begin capturing rendering to an offscreen FBO for post-effect processing.
	 * @param {Renderable} renderable - the renderable requesting post-effect processing
	 * @returns {boolean} true if FBO capture started, false if skipped
	 * @ignore
	 */
	beginPostEffect(renderable) {
		// filter to only enabled effects
		const effects = renderable.postEffects.filter((fx) => {
			return fx.enabled !== false;
		});
		if (effects.length === 0) {
			this.customShader = undefined;
			return false;
		}
		// single effect on non-managed renderable: fast path via customShader (no FBO)
		if (effects.length === 1 && !renderable._postEffectManaged) {
			this.customShader = effects[0];
			return false;
		}

		// multi-pass FBO path: clear customShader so children render with default shader
		this.customShader = undefined;

		const isCamera = renderable._postEffectManaged;
		const canvas = this.getCanvas();
		const w = canvas.width;
		const h = canvas.height;

		// flush pending draws BEFORE creating/resizing FBOs,
		// since FBO construction temporarily changes GL framebuffer bindings
		this.flush();
		this.save();
		// save the current projection (not part of the render state stack) —
		// one preallocated slot per nesting depth, so nested passes each
		// restore their own without per-frame allocation
		let savedProjection = this._effectProjectionStack[this._effectPassDepth];
		if (typeof savedProjection === "undefined") {
			savedProjection = this._effectProjectionStack[this._effectPassDepth] =
				new Matrix3d();
		}
		savedProjection.copy(this.projectionMatrix);
		this._effectPassDepth++;

		const rt = this._renderTargetPool.begin(isCamera, effects.length, w, h);
		// FBO creation/resize binds (then nulls) TEXTURE0 — invalidate EVERY
		// batcher's cache for that unit, not just the current one: a batcher
		// that isn't current right now would otherwise keep trusting its stale
		// `boundTextures[0]` and skip the re-bind, sampling an unbound texture
		// (opaque black) for as long as the post effect is active
		this.invalidateTextureUnit(0);
		rt.bind();
		this.setViewport(0, 0, w, h);
		this.disableScissor();
		this.setGlobalAlpha(1.0);
		this.setBlendMode("normal");

		if (isCamera) {
			this.clear();
		} else {
			this.clearRenderTarget();
		}
		return true;
	}

	/** @ignore */
	endPostEffect(renderable) {
		// filter to only enabled effects
		const effects = renderable.postEffects.filter((fx) => {
			return fx.enabled !== false;
		});
		if (effects.length === 0) {
			return;
		}
		// single effect on non-managed renderable used customShader — no FBO to unbind
		if (effects.length === 1 && !renderable._postEffectManaged) {
			return;
		}

		const isCamera = renderable._postEffectManaged;
		const rt1 = this._renderTargetPool.getCaptureTarget();
		const rt2 = this._renderTargetPool.getPingPongTarget();
		const keepBlend = !isCamera;
		const canvas = this.getCanvas();
		const w = canvas.width;
		const h = canvas.height;

		this.flush();

		// `screen_texture` shader builtin (back-buffer copy semantics):
		// refresh the shared frame capture the effects' live samplers are
		// wired to. For a CAMERA effect the "screen" is the scene itself —
		// capture the still-bound camera FBO before unbinding it. For a
		// renderable's effect chain the "screen" is everything drawn behind
		// it — captured from the parent target after it is rebound below.
		const needsScreenTexture = effects.some((fx) => {
			return fx._screenTextureUniforms?.length > 0;
		});
		if (needsScreenTexture && isCamera) {
			this.toFrameTexture();
		}

		rt1.unbind();

		// get parent render target for rebinding after blits
		const parentRT = this._renderTargetPool.end();

		// clip to camera viewport for non-default cameras
		if (isCamera && renderable.isDefault === false) {
			this.clipRect(
				renderable.screenX,
				renderable.screenY,
				renderable.width,
				renderable.height,
			);
		}

		// rebind parent render target (or screen) and restore viewport.
		// The attachments we're returning to are different physical
		// buffers than the FBO we just unbound — let batchers with
		// target-scoped state invalidate it (e.g. `MeshBatcher`'s lazy
		// depth clear flag).
		if (parentRT) {
			parentRT.bind();
		}
		this.setViewport(0, 0, w, h);
		emit(RENDER_TARGET_CHANGED, this);

		// see needsScreenTexture above — the scene behind this renderable
		if (needsScreenTexture && !isCamera) {
			this.toFrameTexture();
		}

		if (effects.length === 1) {
			this.blitEffect(rt1.texture, 0, 0, w, h, effects[0], keepBlend);
		} else {
			// multi-pass: ping-pong between two render targets
			let src = rt1;
			let dst = rt2;

			for (let i = 0; i < effects.length - 1; i++) {
				dst.bind();
				this.setViewport(0, 0, w, h);
				this.clearRenderTarget();
				this.blitEffect(src.texture, 0, 0, w, h, effects[i]);
				dst.unbind();
				const tmp = src;
				src = dst;
				dst = tmp;
			}

			// rebind parent for final blit
			if (parentRT) {
				parentRT.bind();
			}
			this.setViewport(0, 0, w, h);

			this.blitEffect(
				src.texture,
				0,
				0,
				w,
				h,
				effects[effects.length - 1],
				keepBlend,
			);
		}

		if (isCamera && renderable.isDefault === false) {
			this.disableScissor();
		}

		// restore renderer state and projection saved in beginPostEffect
		this.restore();
		this._effectPassDepth--;
		this.projectionMatrix.copy(
			this._effectProjectionStack[this._effectPassDepth],
		);
		this.currentBatcher.setProjection(this.projectionMatrix);
	}

	/**
	 * Blit a texture to the screen through a shader effect.
	 * Draws a screen-aligned quad using the given texture as source
	 * and the given shader for post-processing (e.g. scanlines, desaturation).
	 * @param {WebGLTexture} source - the source texture to blit
	 * @param {number} x - destination x position
	 * @param {number} y - destination y position
	 * @param {number} width - destination width
	 * @param {number} height - destination height
	 * @param {ShaderEffect} shader - the shader effect to apply
	 * @param {boolean} [keepBlend=false] - if true, keep current blend mode (for sprite compositing)
	 */
	blitEffect(source, x, y, width, height, shader, keepBlend = false) {
		// flush any pending draws
		this.flush();

		const batcher = this.setBatcher("quad");

		// set up a screen-space ortho projection for the blit quad
		// (not the camera's world projection which includes scrolling)
		_savedTransform.copy(this.currentTransform);
		_savedProjection.copy(this.projectionMatrix);
		this.currentTransform.identity();
		this.projectionMatrix.ortho(0, width, height, 0, -1, 1);
		batcher.setProjection(this.projectionMatrix);

		// disable blending for camera blits (render target is fully composited).
		// keep blending for per-sprite blits (transparent areas must not overwrite scene).
		if (!keepBlend) {
			this.setBlendEnabled(false);
		}
		batcher.blitTexture(source, x, y, width, height, shader);
		if (!keepBlend) {
			this.setBlendEnabled(true);
		}

		// restore state
		this.currentTransform.copy(_savedTransform);
		this.projectionMatrix.copy(_savedProjection);
		batcher.setProjection(this.projectionMatrix);
	}

	/**
	 * set/change the current projection matrix (WebGL only)
	 * @param {Matrix3d} matrix - the new projection matrix
	 */
	setProjection(matrix) {
		// flush pending draws before switching projection
		this.flush();
		super.setProjection(matrix);
		this.currentBatcher.setProjection(matrix);
	}

	/**
	 * Sets the WebGL viewport, which specifies the affine transformation of x and y from normalized device coordinates to window coordinates
	 * @param {number} [x = 0] - x the horizontal coordinate for the lower left corner of the viewport origin
	 * @param {number} [y = 0] - y the vertical coordinate for the lower left corner of the viewport origin
	 * @param {number} [w = width of the canvas] - the width of viewport
	 * @param {number} [h = height of the canvas] - the height of viewport
	 */
	setViewport(
		x = 0,
		y = 0,
		w = this.getCanvas().width,
		h = this.getCanvas().height,
	) {
		this.gl.viewport(x, y, w, h);
	}

	/**
	 * Clear the current render target to transparent black.
	 *
	 * Only clears the color buffer — `setMask()` clears `STENCIL_BUFFER_BIT`
	 * itself when starting a mask, and including it here would emit a WebGL
	 * `Clear called for non-existing buffers` warning when the active FBO
	 * has no stencil attachment (rare, but happens on drivers that fail
	 * the depth+stencil renderbuffer attachment for the FBO).
	 */
	clearRenderTarget() {
		const gl = this.gl;
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		emit(RENDER_TARGET_CHANGED, this);
	}

	/**
	 * Enable the scissor test with the given rectangle.
	 * @param {number} x - x coordinate of the scissor rectangle
	 * @param {number} y - y coordinate of the scissor rectangle
	 * @param {number} width - width of the scissor rectangle
	 * @param {number} height - height of the scissor rectangle
	 */
	enableScissor(x, y, width, height) {
		const gl = this.gl;
		const canvas = this.getCanvas();
		// Derive the screen-space AABB via `Bounds.addFrame`, which
		// short-circuits the 4-corner walk when `currentTransform` is
		// identity. `currentScissor` stores screen-space coords directly
		// so save/restore can re-apply without re-running transform math
		// and so a scaled or rotated parent transform is honored — not
		// just translation. Issue #1349.
		const aabb = this._clipAABB;
		aabb.clear();
		aabb.addFrame(x, y, x + width, y + height, this.currentTransform);
		const sx = Math.floor(aabb.min.x);
		const sy = Math.floor(aabb.min.y);
		const sw = Math.ceil(aabb.max.x - sx);
		const sh = Math.ceil(aabb.max.y - sy);
		this.flush();
		gl.enable(gl.SCISSOR_TEST);
		this._scissorActive = true;
		gl.scissor(sx, canvas.height - sh - sy, sw, sh);
		this.currentScissor[0] = sx;
		this.currentScissor[1] = sy;
		this.currentScissor[2] = sw;
		this.currentScissor[3] = sh;
	}

	/**
	 * Disable the scissor test, allowing rendering to the full viewport.
	 */
	disableScissor() {
		if (this._scissorActive === true) {
			// drain quads batched under the scissor BEFORE turning the test
			// off — GL scissor applies at draw time, not at batch time
			// (mirrors enableScissor / clipRect / restore, which all flush
			// for exactly this reason)
			this.flush();
		}
		this.gl.disable(this.gl.SCISSOR_TEST);
		this._scissorActive = false;
	}

	/**
	 * Enable or disable alpha blending.
	 * @param {boolean} enable - true to enable blending, false to disable
	 */
	setBlendEnabled(enable) {
		if (enable) {
			this.gl.enable(this.gl.BLEND);
		} else {
			this.gl.disable(this.gl.BLEND);
		}
	}

	/**
	 * Clear the frame buffer
	 */
	clear() {
		const gl = this.gl;
		const clearColor = this.backgroundColor.toArray();
		gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
		this.lineWidth = 1;
		// Color + stencil are cleared here. Depth (if any batcher cares
		// — currently only `MeshBatcher`) is cleared lazily on the first
		// draw of its mode via the `onTargetChanged()` → `bind()` path.
		gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
		emit(RENDER_TARGET_CHANGED, this);
	}

	/**
	 * Clears the gl context with the given color.
	 * @param {Color|string} [color="#000000"] - CSS color.
	 * @param {boolean} [opaque=false] - Allow transparency [default] or clear the surface completely [true]
	 */
	clearColor(color = "#000000", opaque = false) {
		let glArray;
		const gl = this.gl;

		if (color instanceof Color) {
			glArray = color.toArray();
		} else {
			const _color = colorPool.get();
			// reuse temporary the renderer default color object
			glArray = _color.parseCSS(color).toArray();
			colorPool.release(_color);
		}

		// clear gl context with the specified color
		gl.clearColor(
			glArray[0],
			glArray[1],
			glArray[2],
			opaque === true ? 1.0 : glArray[3],
		);
		gl.clear(gl.COLOR_BUFFER_BIT);
	}

	/**
	 * Erase the pixels in the given rectangular area by setting them to transparent black (rgba(0,0,0,0)).
	 * @param {number} x - x axis of the coordinate for the rectangle starting point.
	 * @param {number} y - y axis of the coordinate for the rectangle starting point.
	 * @param {number} width - The rectangle's width.
	 * @param {number} height - The rectangle's height.
	 */
	clearRect(x, y, width, height) {
		this.save();
		this.clipRect(x, y, width, height);
		// actual transparent black, per the JSDoc above and the Canvas
		// renderer's native clearRect — the bare clearColor() default
		// ("#000000") parses with alpha 1 and would paint OPAQUE black
		this.clearColor("rgba(0,0,0,0)");
		this.restore();
	}

	/**
	 * Draw an image to the gl context
	 * @param {HTMLImageElement|SVGImageElement|HTMLVideoElement|HTMLCanvasElement|ImageBitmap|OffscreenCanvas|VideoFrame|CompressedImage} image - An element to draw into the context.
	 * @param {number} sx - The X coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
	 * @param {number} sy - The Y coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
	 * @param {number} sw - The width of the sub-rectangle of the source image to draw into the destination context. If not specified, the entire rectangle from the coordinates specified by sx and sy to the bottom-right corner of the image is used.
	 * @param {number} sh - The height of the sub-rectangle of the source image to draw into the destination context.
	 * @param {number} dx - The X coordinate in the destination canvas at which to place the top-left corner of the source image.
	 * @param {number} dy - The Y coordinate in the destination canvas at which to place the top-left corner of the source image.
	 * @param {number} dw - The width to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in width when drawn.
	 * @param {number} dh - The height to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in height when drawn.
	 * @example
	 * // Position the image on the canvas:
	 * renderer.drawImage(image, dx, dy);
	 * // Position the image on the canvas, and specify width and height of the image:
	 * renderer.drawImage(image, dx, dy, dWidth, dHeight);
	 * // Clip the image and position the clipped part on the canvas:
	 * renderer.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
	 */
	drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
		if (typeof sw === "undefined") {
			sw = dw = image.width;
			sh = dh = image.height;
			dx = sx;
			dy = sy;
			sx = 0;
			sy = 0;
		} else if (typeof dx === "undefined") {
			dx = sx;
			dy = sy;
			dw = sw;
			dh = sh;
			sw = image.width;
			sh = image.height;
			sx = 0;
			sy = 0;
		}

		if (this.settings.subPixel === false) {
			// clamp to pixel grid
			dx |= 0;
			dy |= 0;
		}

		// dispatch to the lit batcher only when the scene actually has
		// active lights AND this sprite has a normal map. Otherwise the
		// unlit `quad` batcher is faster (full texture-unit capacity, no
		// paired normal upload, no per-fragment lighting math).
		// Back-buffer copy semantics for the `screen_texture` shader
		// builtin: refresh the shared frame capture with everything drawn so
		// far BEFORE this sprite's own quad, so the effect samples the scene
		// behind it. Must run before setBatcher below — toFrameTexture
		// flushes and switches to the quad batcher internally.
		if (this.customShader?._screenTextureUniforms?.length > 0) {
			this.toFrameTexture();
		}

		const useLit =
			this.batchers.has("litQuad") &&
			this.activeLightCount > 0 &&
			this.currentNormalMap !== null;
		this.setBatcher(useLit ? "litQuad" : "quad");

		const shader = this.customShader;
		if (shader != null) {
			this.currentBatcher.useShader(shader);
			// (re)bind any extra textures a ShaderEffect declared via setTexture
			shader._prepareTextures?.(this.currentBatcher);
		}

		// force reuploading if the given image is a HTMLVideoElement or a
		// force re-upload for video elements
		const reupload = typeof image.videoWidth !== "undefined";
		const texture = this.cache.get(image);
		const uvs = texture.getUVs(sx, sy, sw, sh);
		if (useLit) {
			this.currentBatcher.addQuad(
				texture,
				dx,
				dy,
				dw,
				dh,
				uvs[0],
				uvs[1],
				uvs[2],
				uvs[3],
				this.currentTint.toUint32(this.getGlobalAlpha()),
				reupload,
				this.currentNormalMap,
			);
		} else {
			this.currentBatcher.addQuad(
				texture,
				dx,
				dy,
				dw,
				dh,
				uvs[0],
				uvs[1],
				uvs[2],
				uvs[3],
				this.currentTint.toUint32(this.getGlobalAlpha()),
				reupload,
			);
		}

		if (typeof shader === "object") {
			this.currentBatcher.useShader(this.currentBatcher.defaultShader);
		}
	}

	/**
	 * Draw a pattern within the given rectangle.
	 * @param {TextureAtlas} pattern - Pattern object
	 * @param {number} x - x position where to draw the pattern
	 * @param {number} y - y position where to draw the pattern
	 * @param {number} width - width of the pattern
	 * @param {number} height - height of the pattern
	 * @see WebGLRenderer#createPattern
	 */
	drawPattern(pattern, x, y, width, height) {
		const uvs = pattern.getUVs("0,0," + width + "," + height);
		this.setBatcher("quad");
		this.currentBatcher.addQuad(
			pattern,
			x,
			y,
			width,
			height,
			uvs[0],
			uvs[1],
			uvs[2],
			uvs[3],
			this.currentTint.toUint32(this.getGlobalAlpha()),
		);
	}

	/**
	 * Draw a textured triangle mesh.
	 * Enables hardware depth testing and backface culling for the
	 * duration of the draw, then restores the previous GL state. Large
	 * meshes are automatically chunked across multiple draw calls to
	 * fit the vertex/index buffer limits.
	 *
	 * Multi-material meshes (OBJ files with multiple `usemtl` groups +
	 * a bound MTL) don't add any per-material draw calls here — the
	 * per-material colors are baked into `mesh.vertexColors` at
	 * construction time and pushed through the batcher's per-vertex
	 * `aColor` attribute. `mesh.tint` still multiplies on top at draw
	 * time, so flash / fade / team-color via `setTint` work the same
	 * as single-material. (The chunking-for-buffer-limits behavior
	 * above still applies to multi-material meshes as well.)
	 * @param {Mesh} mesh - a Mesh renderable or compatible object
	 */
	drawMesh(mesh) {
		const gl = this.gl;

		// Route to the lit or unlit mesh batcher. `mesh.lit` meshes use the
		// `LitMeshBatcher` (world-space normals + lighting); everything else
		// uses the lean unlit `MeshBatcher`. Both share the mesh-mode depth
		// state, so mixing them keeps inter-mesh occlusion correct.
		//
		// `setBatcher` delegates all mesh-mode state setup (DEPTH_TEST enable,
		// LEQUAL, depthMask, one-shot per-target depth clear, BLEND off) to the
		// batcher's `bind()`. Switching away restores non-mesh defaults via
		// `unbind()`. Consecutive same-kind `drawMesh` calls pay zero state cost
		// between them; the GPU's LEQUAL depth test resolves inter-mesh
		// occlusion per pixel against the accumulated depth buffer.
		this.setBatcher(mesh.lit === true ? "litMesh" : "mesh");

		// apply custom shader if set on the renderable (via preDraw)
		if (this.customShader != null) {
			this.currentBatcher.useShader(this.customShader);
		}

		// toggle backface culling per-mesh — varies across meshes in
		// the same run, so this stays here rather than in the batcher's
		// bind/unbind lifecycle.
		if (mesh.cullBackFaces) {
			gl.enable(gl.CULL_FACE);
			gl.cullFace(gl.BACK);
			gl.frontFace(gl.CCW);
		}

		this.currentBatcher.addMesh(
			mesh,
			this.currentTint.toUint32(this.getGlobalAlpha()),
		);

		this.flush();

		if (mesh.cullBackFaces) {
			gl.disable(gl.CULL_FACE);
		}

		// revert to default shader if custom was applied
		if (this.customShader != null) {
			this.currentBatcher.useShader(this.currentBatcher.defaultShader);
		}
	}

	/**
	 * starts a new path by emptying the list of sub-paths. Call this method when you want to create a new path
	 * @example
	 * // First path
	 * renderer.beginPath();
	 * renderer.setColor("blue");
	 * renderer.moveTo(20, 20);
	 * renderer.lineTo(200, 20);
	 * renderer.stroke();
	 * // Second path
	 * renderer.beginPath();
	 * renderer.setColor("green");
	 * renderer.moveTo(20, 20);
	 * renderer.lineTo(120, 120);
	 * renderer.stroke();
	 */
	beginPath() {
		this.path2D.beginPath();
	}

	/**
	 * begins a new sub-path at the point specified by the given (x, y) coordinates.
	 * @param {number} x - The x axis of the point.
	 * @param {number} y - The y axis of the point.
	 */
	moveTo(x, y) {
		this.path2D.moveTo(x, y);
	}

	/**
	 * adds a straight line to the current sub-path by connecting the sub-path's last point to the specified (x, y) coordinates.
	 */
	lineTo(x, y) {
		this.path2D.lineTo(x, y);
	}

	/**
	 * Adds a quadratic Bezier curve to the current sub-path.
	 * The curve is tessellated into line segments for WebGL rendering.
	 * @param {number} cpx - The x-axis coordinate of the control point.
	 * @param {number} cpy - The y-axis coordinate of the control point.
	 * @param {number} x - The x-axis coordinate of the end point.
	 * @param {number} y - The y-axis coordinate of the end point.
	 */
	quadraticCurveTo(cpx, cpy, x, y) {
		this.path2D.quadraticCurveTo(cpx, cpy, x, y);
	}

	/**
	 * Adds a cubic Bezier curve to the current sub-path.
	 * The curve is tessellated into line segments for WebGL rendering.
	 * @param {number} cp1x - The x-axis coordinate of the first control point.
	 * @param {number} cp1y - The y-axis coordinate of the first control point.
	 * @param {number} cp2x - The x-axis coordinate of the second control point.
	 * @param {number} cp2y - The y-axis coordinate of the second control point.
	 * @param {number} x - The x-axis coordinate of the end point.
	 * @param {number} y - The y-axis coordinate of the end point.
	 */
	bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
		this.path2D.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
	}

	/**
	 * Adds a circular arc to the current sub-path, using the given control points and radius.
	 * The arc is tessellated into line segments for WebGL rendering.
	 * @param {number} x1 - The x-axis coordinate of the first control point.
	 * @param {number} y1 - The y-axis coordinate of the first control point.
	 * @param {number} x2 - The x-axis coordinate of the second control point.
	 * @param {number} y2 - The y-axis coordinate of the second control point.
	 * @param {number} radius - The arc's radius. Must be non-negative.
	 */
	arcTo(x1, y1, x2, y2, radius) {
		this.path2D.arcTo(x1, y1, x2, y2, radius);
	}

	/**
	 * creates a rectangular path whose starting point is at (x, y) and whose size is specified by width and height.
	 * @param {number} x - The x axis of the coordinate for the rectangle starting point.
	 * @param {number} y - The y axis of the coordinate for the rectangle starting point.
	 * @param {number} width - The rectangle's width.
	 * @param {number} height - The rectangle's height.
	 */
	rect(x, y, width, height) {
		this.path2D.rect(x, y, width, height);
	}

	/**
	 * adds a rounded rectangle to the current path.
	 * @param {number} x - The x axis of the coordinate for the rectangle starting point.
	 * @param {number} y - The y axis of the coordinate for the rectangle starting point.
	 * @param {number} width - The rectangle's width.
	 * @param {number} height - The rectangle's height.
	 * @param {number} radius - The corner radius.
	 */
	roundRect(x, y, width, height, radii) {
		this.path2D.roundRect(x, y, width, height, radii);
	}

	/**
	 * stroke the given shape or the current defined path
	 * @param {Rect|RoundRect|Polygon|Line|Ellipse|Bounds} [shape] - a shape object to stroke
	 * @param {boolean} [fill=false] - fill the shape with the current color if true
	 */
	stroke(shape, fill) {
		if (typeof shape === "undefined") {
			this.setBatcher("primitive");
			if (fill === true) {
				// draw all triangles
				this.currentBatcher.drawVertices(
					this.gl.TRIANGLES,
					this.path2D.triangulatePath(),
				);
			} else {
				const dash = this.renderState.lineDash;
				if (dash.length > 0) {
					const pts = this.path2D.points;
					const dashed = dashPath(pts, dash);
					if (dashed.length > 0) {
						this.currentBatcher.drawVertices(this.gl.LINES, dashed);
					}
				} else {
					this.currentBatcher.drawVertices(this.gl.LINES, this.path2D.points);
				}
			}
		} else {
			// dispatches to strokeRect/strokePolygon/etc. which each call setBatcher
			super.stroke(shape, fill);
		}
	}

	/**
	 * fill the given shape or the current defined path
	 * @param {Rect|RoundRect|Polygon|Line|Ellipse|Bounds} [shape] - a shape object to fill
	 */
	fill(shape) {
		this.stroke(shape, true);
	}

	/**
	 * add a straight line from the current point to the start of the current sub-path. If the shape has already been closed or has only one point, this function does nothing
	 */
	closePath() {
		this.path2D.closePath();
	}

	/**
	 * Returns the WebGLContext instance for the renderer
	 * return a reference to the system 2d Context
	 * @returns {WebGLRenderingContext} the current WebGL context
	 */
	getContext() {
		return this.gl;
	}

	/**
	 * set the current blend mode for this renderer. <br>
	 * All renderers support: <br>
	 * - "normal" : draws new content on top of the existing content <br>
	 * <img src="../images/normal-blendmode.png" width="180"/> <br>
	 * - "add", "additive", or "lighter" : color values are added together <br>
	 * <img src="../images/add-blendmode.png" width="180"/> <br>
	 * - "multiply" : pixels are multiplied, resulting in a darker picture <br>
	 * <img src="../images/multiply-blendmode.png" width="180"/> <br>
	 * - "screen" : pixels are inverted, multiplied, and inverted again (opposite of multiply) <br>
	 * <img src="../images/screen-blendmode.png" width="180"/> <br>
	 * WebGL2 additionally supports: <br>
	 * - "darken" : retains the darkest pixels of both layers <br>
	 * <img src="../images/darken-blendmode.png" width="180"/> <br>
	 * - "lighten" : retains the lightest pixels of both layers <br>
	 * <img src="../images/lighten-blendmode.png" width="180"/> <br>
	 * Other CSS blend modes ("overlay", "color-dodge", "color-burn", "hard-light", "soft-light",
	 * "difference", "exclusion") may be supported by the Canvas renderer (browser-dependent)
	 * and will always fall back to "normal" in WebGL. <br>
	 * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
	 * @param {string} [mode="normal"] - blend mode
	 * @param {boolean} [premultipliedAlpha=true] - whether textures use premultiplied alpha (affects source blend factor)
	 * @returns {string} the blend mode actually applied (may differ if the requested mode is unsupported)
	 */
	setBlendMode(mode = "normal", premultipliedAlpha = true) {
		if (
			this.currentBlendMode !== mode ||
			this.currentPremultipliedAlpha !== premultipliedAlpha
		) {
			const gl = this.gl;
			this.flush();
			gl.enable(gl.BLEND);
			this.currentBlendMode = mode;
			this.currentPremultipliedAlpha = premultipliedAlpha;

			// source factor depends on whether textures use premultiplied alpha
			const srcAlpha = premultipliedAlpha ? gl.ONE : gl.SRC_ALPHA;

			switch (mode) {
				case "screen":
					gl.blendEquation(gl.FUNC_ADD);
					gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
					break;

				case "lighter":
				case "additive":
				case "add":
					gl.blendEquation(gl.FUNC_ADD);
					gl.blendFunc(srcAlpha, gl.ONE);
					break;

				case "multiply":
					gl.blendEquation(gl.FUNC_ADD);
					gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
					break;

				case "darken":
					if (this.WebGLVersion > 1) {
						gl.blendEquation(gl.MIN);
						gl.blendFunc(gl.ONE, gl.ONE);
					} else {
						gl.blendEquation(gl.FUNC_ADD);
						gl.blendFunc(srcAlpha, gl.ONE_MINUS_SRC_ALPHA);
						this.currentBlendMode = "normal";
					}
					break;

				case "lighten":
					if (this.WebGLVersion > 1) {
						gl.blendEquation(gl.MAX);
						gl.blendFunc(gl.ONE, gl.ONE);
					} else {
						gl.blendEquation(gl.FUNC_ADD);
						gl.blendFunc(srcAlpha, gl.ONE_MINUS_SRC_ALPHA);
						this.currentBlendMode = "normal";
					}
					break;

				default:
					gl.blendEquation(gl.FUNC_ADD);
					gl.blendFunc(srcAlpha, gl.ONE_MINUS_SRC_ALPHA);
					this.currentBlendMode = "normal";
					break;
			}
		}
		return this.currentBlendMode;
	}

	/**
	 * restores the most recently saved renderer state by popping the top entry in the drawing state stack
	 * @example
	 * // Save the current state
	 * renderer.save();
	 *
	 * // apply a transform and draw a rect
	 * renderer.tranform(matrix);
	 * renderer.fillRect(10, 10, 100, 100);
	 *
	 * // Restore to the state saved by the most recent call to save()
	 * renderer.restore();
	 */
	restore() {
		const canvas = this.getCanvas();
		// Peek at the to-be-restored scissor (without mutating state)
		// so we can detect whether the restore actually changes the
		// scissor box. If it does, drain pending vertices first under
		// the *current* GL scissor — otherwise vertices queued inside
		// a tighter clip would flush later under a more permissive
		// scissor and visually escape their clip.
		// `peekScissor` returns the saved box directly (live ref) or
		// null when scissor will be inactive after the restore. Treat
		// the returned array as read-only — it points into the stack.
		const peek = this.renderState.peekScissor();
		const cur = this.currentScissor;
		const curActive = this._scissorActive === true;
		const willBeActive = peek !== null;
		const scissorChanging =
			curActive !== willBeActive ||
			(willBeActive &&
				(cur[0] !== peek[0] ||
					cur[1] !== peek[1] ||
					cur[2] !== peek[2] ||
					cur[3] !== peek[3]));
		if (scissorChanging) {
			this.flush();
		}
		const result = this.renderState.restore(canvas.width, canvas.height);
		if (result !== null) {
			this.setBlendMode(result.blendMode);
			if (scissorChanging) {
				const gl = this.gl;
				if (result.scissorActive) {
					const next = this.currentScissor;
					gl.enable(gl.SCISSOR_TEST);
					this._scissorActive = true;
					// `currentScissor` stores screen-space coords directly
					// (see `clipRect`); apply with the GL bottom-left y-flip.
					gl.scissor(
						next[0],
						canvas.height - next[3] - next[1],
						next[2],
						next[3],
					);
				} else {
					gl.disable(gl.SCISSOR_TEST);
					this._scissorActive = false;
				}
			}
		}
		// sync gradient and shader from renderState
		this._currentGradient = this.renderState.currentGradient;
		this.customShader = this.renderState.currentShader;
	}

	/**
	 * saves the entire state of the renderer by pushing the current state onto a stack.
	 * @example
	 * // Save the current state
	 * renderer.save();
	 *
	 * // apply a transform and draw a rect
	 * renderer.tranform(matrix);
	 * renderer.fillRect(10, 10, 100, 100);
	 *
	 * // Restore to the state saved by the most recent call to save()
	 * renderer.restore();
	 */
	save() {
		this.renderState.currentShader = this.customShader;
		this.renderState.save(this._scissorActive === true);
	}

	/**
	 * adds a rotation to the transformation matrix.
	 * @param {number} angle - the rotation angle, clockwise in radians
	 * @example
	 * // Rotated rectangle
	 * renderer.rotate((45 * Math.PI) / 180);
	 * renderer.setColor("red");
	 * renderer.fillRect(10, 10, 100, 100);
	 *
	 * // Reset transformation matrix to the identity matrix
	 * renderer.setTransform(1, 0, 0, 1, 0, 0);
	 */
	rotate(angle) {
		this.currentTransform.rotate(angle);
	}

	/**
	 * adds a scaling transformation to the renderer units horizontally and/or vertically
	 * @param {number} x - Scaling factor in the horizontal direction. A negative value flips pixels across the vertical axis. A value of 1 results in no horizontal scaling.
	 * @param {number} y - Scaling factor in the vertical direction. A negative value flips pixels across the horizontal axis. A value of 1 results in no vertical scaling
	 */
	scale(x, y) {
		this.currentTransform.scale(x, y, 1);
	}

	/**
	 * Map the backend-neutral default filter mode
	 * ({@link Renderer#getDefaultTextureFilter}) to the GL enum
	 * (`gl.LINEAR` / `gl.NEAREST`) used for textures that don't carry their own
	 * `texture.filter`. The neutral resolver lives on the base renderer so a
	 * future WebGPU backend reuses it and maps to `GPUFilterMode` instead.
	 * @returns {number} `gl.LINEAR` or `gl.NEAREST`
	 * @ignore
	 */
	_glTextureFilter() {
		return this.getDefaultTextureFilter() === "linear"
			? this.gl.LINEAR
			: this.gl.NEAREST;
	}

	/**
	 * Re-apply a min/mag filter to every currently-bound texture across all
	 * batchers (see https://github.com/melonjs/melonJS/issues/1279). Shared by
	 * {@link WebGLRenderer#setAntiAlias} and {@link WebGLRenderer#setTextureFilter}.
	 * @param {number} filter - `gl.LINEAR` or `gl.NEAREST`
	 * @ignore
	 */
	_reapplyTextureFilter(filter) {
		const gl = this.gl;
		this.batchers.forEach((batcher) => {
			if (batcher.boundTextures) {
				for (let i = 0; i < batcher.boundTextures.length; i++) {
					if (typeof batcher.boundTextures[i] !== "undefined") {
						gl.activeTexture(gl.TEXTURE0 + i);
						gl.bindTexture(gl.TEXTURE_2D, batcher.boundTextures[i]);
						gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
						gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
					}
				}
				// reset so next bindTexture2D re-selects the correct unit
				batcher.currentTextureUnit = -1;
			}
		});
	}

	/**
	 * enable/disable image smoothing (scaling interpolation)
	 * @param {boolean} [enable=false]
	 */
	setAntiAlias(enable = false) {
		if (this.settings.antiAlias !== enable) {
			super.setAntiAlias(enable);
			// re-filter bound textures to the resolved default — honors an explicit
			// `textureFilter` (so toggling antiAlias won't override a "nearest" /
			// "linear" choice), and tracks antiAlias when `textureFilter` is "auto".
			this._reapplyTextureFilter(this._glTextureFilter());
		}
	}

	/**
	 * Set the default texture magnification/minification filter at runtime,
	 * decoupled from {@link WebGLRenderer#setAntiAlias} (which controls MSAA).
	 * Records the setting (via the base) then re-filters every currently-bound
	 * texture. WebGL only.
	 * @param {"auto"|"nearest"|"linear"} [mode="auto"] - `"auto"` follows `antiAlias`
	 * @see Renderer#getDefaultTextureFilter
	 */
	setTextureFilter(mode = "auto") {
		super.setTextureFilter(mode);
		this._reapplyTextureFilter(this._glTextureFilter());
	}

	/**
	 * Set the global alpha
	 * @param {number} alpha - 0.0 to 1.0 values accepted.
	 */
	setGlobalAlpha(alpha) {
		this.currentColor.alpha = alpha;
	}

	/**
	 * Return the global alpha
	 * @returns {number} global alpha value
	 */
	getGlobalAlpha() {
		return this.currentColor.alpha;
	}

	/**
	 * Set the current fill & stroke style color.
	 * By default, or upon reset, the value is set to #000000.
	 * @param {Color|string|Gradient} color - css color string or a Gradient object.
	 */
	setColor(color) {
		if (color instanceof Gradient) {
			this.renderState.currentGradient = color;
			this._currentGradient = color;
		} else {
			this.renderState.currentGradient = null;
			this._currentGradient = null;
			const alpha = this.currentColor.alpha;
			this.currentColor.copy(color);
			this.currentColor.alpha *= alpha;
		}
	}

	/**
	 * Stroke an arc at the specified coordinates with given radius, start and end points
	 * @param {number} x - arc center point x-axis
	 * @param {number} y - arc center point y-axis
	 * @param {number} radius - arc radius
	 * @param {number} start - start angle in radians
	 * @param {number} end - end angle in radians
	 * @param {boolean} [antiClockwise=false] - draw arc anti-clockwise
	 * @param {boolean} [fill=false] - also fill the shape with the current color if true
	 */
	strokeArc(x, y, radius, start, end, antiClockwise = false, fill = false) {
		if (fill === true) {
			this.fillArc(x, y, radius, start, end, antiClockwise);
			return;
		}
		this.setBatcher("primitive");
		this.path2D.beginPath();
		this.path2D.arc(x, y, radius, start, end, antiClockwise);
		this.currentBatcher.drawVertices(this.gl.LINES, this.path2D.points);
	}

	/**
	 * Fill an arc at the specified coordinates with given radius, start and end points
	 * @param {number} x - arc center point x-axis
	 * @param {number} y - arc center point y-axis
	 * @param {number} radius - arc radius
	 * @param {number} start - start angle in radians
	 * @param {number} end - end angle in radians
	 * @param {boolean} [antiClockwise=false] - draw arc anti-clockwise
	 */
	fillArc(x, y, radius, start, end, antiClockwise = false) {
		if (this._currentGradient) {
			this.#gradientMask(
				() => {
					this.fillArc(x, y, radius, start, end, antiClockwise);
				},
				x - radius,
				y - radius,
				radius * 2,
				radius * 2,
			);
			return;
		}
		this.setBatcher("primitive");
		let diff = Math.abs(end - start);
		if (antiClockwise) {
			diff = Math.PI * 2 - diff;
		}
		const segments = Math.max(
			4,
			Math.round((diff * radius) / this.path2D.arcResolution),
		);
		const startAngle = antiClockwise ? end : start;
		this.currentBatcher.drawVertices(
			this.gl.TRIANGLES,
			generateTriangleFan(
				x,
				y,
				radius,
				radius,
				startAngle,
				startAngle + diff,
				segments,
			),
		);
	}

	/**
	 * Stroke an ellipse at the specified coordinates with given radius
	 * @param {number} x - ellipse center point x-axis
	 * @param {number} y - ellipse center point y-axis
	 * @param {number} w - horizontal radius of the ellipse
	 * @param {number} h - vertical radius of the ellipse
	 * @param {boolean} [fill=false] - also fill the shape with the current color if true
	 */
	strokeEllipse(x, y, w, h, fill = false) {
		if (fill === true) {
			this.fillEllipse(x, y, w, h);
			return;
		}
		this.setBatcher("primitive");
		this.path2D.beginPath();
		this.path2D.ellipse(x, y, w, h, 0, 0, 360);
		this.currentBatcher.drawVertices(this.gl.LINES, this.path2D.points);
	}

	/**
	 * Fill an ellipse at the specified coordinates with given radius
	 * @param {number} x - ellipse center point x-axis
	 * @param {number} y - ellipse center point y-axis
	 * @param {number} w - horizontal radius of the ellipse
	 * @param {number} h - vertical radius of the ellipse
	 */
	fillEllipse(x, y, w, h) {
		if (this._currentGradient) {
			this.#gradientMask(
				() => {
					this.fillEllipse(x, y, w, h);
				},
				x - w,
				y - h,
				w * 2,
				h * 2,
			);
			return;
		}
		this.setBatcher("primitive");
		const segments = Math.max(
			8,
			Math.round((Math.PI * (w + h)) / this.path2D.arcResolution),
		);
		this.currentBatcher.drawVertices(
			this.gl.TRIANGLES,
			generateTriangleFan(x, y, w, h, 0, Math.PI * 2, segments),
		);
	}

	/**
	 * Stroke a line of the given two points
	 * @param {number} startX - the start x coordinate
	 * @param {number} startY - the start y coordinate
	 * @param {number} endX - the end x coordinate
	 * @param {number} endY - the end y coordinate
	 */
	strokeLine(startX, startY, endX, endY) {
		this.setBatcher("primitive");
		const dash = this.renderState.lineDash;
		if (dash.length > 0) {
			const segments = dashSegments(startX, startY, endX, endY, dash);
			if (segments.length > 0) {
				this.currentBatcher.drawVertices(this.gl.LINES, segments);
			}
		} else {
			this.path2D.beginPath();
			this.path2D.moveTo(startX, startY);
			this.path2D.lineTo(endX, endY);
			this.currentBatcher.drawVertices(this.gl.LINES, this.path2D.points);
		}
	}

	/**
	 * Fill a line of the given two points
	 * @param {number} startX - the start x coordinate
	 * @param {number} startY - the start y coordinate
	 * @param {number} endX - the end x coordinate
	 * @param {number} endY - the end y coordinate
	 */
	fillLine(startX, startY, endX, endY) {
		this.strokeLine(startX, startY, endX, endY);
	}

	/**
	 * Stroke a Polygon on the screen with a specified color
	 * @param {Polygon} poly - the shape to draw
	 * @param {boolean} [fill=false] - also fill the shape with the current color if true
	 */
	strokePolygon(poly, fill = false) {
		if (fill === true) {
			this.fillPolygon(poly);
			return;
		}
		const points = poly.points;
		const len = points.length;

		this.translate(poly.pos.x, poly.pos.y);

		this.setBatcher("primitive");
		this.path2D.beginPath();
		for (let i = 0; i < len - 1; i++) {
			const curPoint = points[i];
			const nextPoint = points[i + 1];
			this.path2D.moveTo(curPoint.x, curPoint.y);
			this.path2D.lineTo(nextPoint.x, nextPoint.y);
		}
		this.path2D.closePath();
		const dash = this.renderState.lineDash;
		if (dash.length > 0) {
			const pts = this.path2D.points;
			const dashed = dashPath(pts, dash);
			if (dashed.length > 0) {
				this.currentBatcher.drawVertices(this.gl.LINES, dashed);
			}
		} else {
			this.currentBatcher.drawVertices(this.gl.LINES, this.path2D.points);
		}
		// add round joins at vertices for thick lines
		if (this.lineWidth > 1) {
			const radius = this.lineWidth / 2;
			const joinPoints = [];
			for (let i = 1; i < len; i++) {
				joinPoints.push(points[i]);
			}
			const lastPoint = points[len - 1];
			const firstPoint = points[0];
			if (!lastPoint.equals(firstPoint)) {
				joinPoints.push(firstPoint);
			}
			this.currentBatcher.drawVertices(
				this.gl.TRIANGLES,
				generateJoinCircles(joinPoints, radius),
			);
		}

		this.translate(-poly.pos.x, -poly.pos.y);
	}

	/**
	 * Fill a me.Polygon on the screen
	 * @param {Polygon} poly - the shape to draw
	 */
	fillPolygon(poly) {
		if (this._currentGradient) {
			const bounds = poly.getBounds();
			// translate to polygon's local space so gradient coords match
			this.translate(poly.pos.x, poly.pos.y);
			this.#gradientMask(
				() => {
					// draw polygon vertices directly (already translated)
					this.setBatcher("primitive");
					const indices = poly.getIndices();
					const points = poly.points;
					const verts = this._polyVerts;
					const len = indices.length;
					while (verts.length < len) {
						verts.push({ x: 0, y: 0 });
					}
					for (let i = 0; i < len; i++) {
						const src = points[indices[i]];
						verts[i].x = src.x;
						verts[i].y = src.y;
					}
					this.currentBatcher.drawVertices(this.gl.TRIANGLES, verts, len);
				},
				// use local bounds (subtract pos since getBounds includes it)
				bounds.x - poly.pos.x,
				bounds.y - poly.pos.y,
				bounds.width,
				bounds.height,
			);
			this.translate(-poly.pos.x, -poly.pos.y);
			return;
		}
		this.setBatcher("primitive");
		this.translate(poly.pos.x, poly.pos.y);
		const indices = poly.getIndices();
		const points = poly.points;
		const verts = this._polyVerts;
		const len = indices.length;

		// grow the scratch array if needed
		while (verts.length < len) {
			verts.push({ x: 0, y: 0 });
		}

		// copy point coordinates so drawVertices won't mutate the polygon
		for (let i = 0; i < len; i++) {
			const src = points[indices[i]];
			verts[i].x = src.x;
			verts[i].y = src.y;
		}

		this.currentBatcher.drawVertices(this.gl.TRIANGLES, verts, len);
		this.translate(-poly.pos.x, -poly.pos.y);
	}

	/**
	 * Draw a stroke rectangle at the specified coordinates
	 * @param {number} x - x axis of the coordinate for the rectangle starting point.
	 * @param {number} y - y axis of the coordinate for the rectangle starting point.
	 * @param {number} width - The rectangle's width.
	 * @param {number} height - The rectangle's height.
	 * @param {boolean} [fill=false] - also fill the shape with the current color if true
	 */
	strokeRect(x, y, width, height, fill = false) {
		if (fill === true) {
			this.fillRect(x, y, width, height);
			return;
		}
		this.setBatcher("primitive");
		this.path2D.beginPath();
		this.path2D.rect(x, y, width, height);
		this.currentBatcher.drawVertices(this.gl.LINES, this.path2D.points);
		// add round joins at corners for thick lines
		if (this.lineWidth > 1) {
			const radius = this.lineWidth / 2;
			this.currentBatcher.drawVertices(
				this.gl.TRIANGLES,
				generateJoinCircles(
					[
						{ x, y },
						{ x: x + width, y },
						{ x: x + width, y: y + height },
						{ x, y: y + height },
					],
					radius,
				),
			);
		}
	}

	/**
	 * Draw a filled rectangle at the specified coordinates
	 * @param {number} x - x axis of the coordinate for the rectangle starting point.
	 * @param {number} y - y axis of the coordinate for the rectangle starting point.
	 * @param {number} width - The rectangle's width.
	 * @param {number} height - The rectangle's height.
	 */
	fillRect(x, y, width, height) {
		if (this._currentGradient) {
			// toCanvas() calls invalidate() which flushes pending draws
			const canvas = this._currentGradient.toCanvas(this, x, y, width, height);
			this.drawImage(canvas, 0, 0, width, height, x, y, width, height);
			return;
		}
		this.setBatcher("primitive");
		// 2 triangles directly — avoids path2D + earcut overhead
		const right = x + width;
		const bottom = y + height;
		const pts = this._rectTriangles;
		pts[0].x = x;
		pts[0].y = y;
		pts[1].x = right;
		pts[1].y = y;
		pts[2].x = x;
		pts[2].y = bottom;
		pts[3].x = right;
		pts[3].y = y;
		pts[4].x = right;
		pts[4].y = bottom;
		pts[5].x = x;
		pts[5].y = bottom;
		this.currentBatcher.drawVertices(this.gl.TRIANGLES, pts);
	}

	/**
	 * Stroke a rounded rectangle at the specified coordinates
	 * @param {number} x - x axis of the coordinate for the rounded rectangle starting point.
	 * @param {number} y - y axis of the coordinate for the rounded rectangle starting point.
	 * @param {number} width - The rounded rectangle's width.
	 * @param {number} height - The rounded rectangle's height.
	 * @param {number} radius - The rounded corner's radius.
	 * @param {boolean} [fill=false] - also fill the shape with the current color if true
	 */
	strokeRoundRect(x, y, width, height, radius, fill = false) {
		if (fill === true) {
			this.fillRoundRect(x, y, width, height, radius);
			return;
		}
		this.setBatcher("primitive");
		this.path2D.beginPath();
		this.path2D.roundRect(x, y, width, height, radius);
		this.currentBatcher.drawVertices(this.gl.LINES, this.path2D.points);
	}

	/**
	 * Draw a rounded filled rectangle at the specified coordinates
	 * @param {number} x - x axis of the coordinate for the rounded rectangle starting point.
	 * @param {number} y - y axis of the coordinate for the rounded rectangle starting point.
	 * @param {number} width - The rounded rectangle's width.
	 * @param {number} height - The rounded rectangle's height.
	 * @param {number} radius - The rounded corner's radius.
	 */
	fillRoundRect(x, y, width, height, radius) {
		if (this._currentGradient) {
			this.#gradientMask(
				() => {
					this.fillRoundRect(x, y, width, height, radius);
				},
				x,
				y,
				width,
				height,
			);
			return;
		}
		this.setBatcher("primitive");
		const r = Math.min(radius, width / 2, height / 2);
		const verts = [];

		// inner cross: 3 rects (6 triangles = 18 vertices)
		// horizontal bar (full width, inner height)
		verts.push(
			{ x, y: y + r },
			{ x: x + width, y: y + r },
			{ x, y: y + height - r },
			{ x: x + width, y: y + r },
			{ x: x + width, y: y + height - r },
			{ x, y: y + height - r },
		);
		// top bar (inner width, radius height)
		verts.push(
			{ x: x + r, y },
			{ x: x + width - r, y },
			{ x: x + r, y: y + r },
			{ x: x + width - r, y },
			{ x: x + width - r, y: y + r },
			{ x: x + r, y: y + r },
		);
		// bottom bar (inner width, radius height)
		verts.push(
			{ x: x + r, y: y + height - r },
			{ x: x + width - r, y: y + height - r },
			{ x: x + r, y: y + height },
			{ x: x + width - r, y: y + height - r },
			{ x: x + width - r, y: y + height },
			{ x: x + r, y: y + height },
		);

		// 4 corner arcs as triangle fans
		const cornerSegments = Math.max(
			4,
			Math.round((Math.PI * r) / 2 / this.path2D.arcResolution),
		);
		const PI = Math.PI;
		verts.push(
			...generateTriangleFan(x + r, y + r, r, r, PI, PI * 1.5, cornerSegments),
		); // top-left
		verts.push(
			...generateTriangleFan(
				x + width - r,
				y + r,
				r,
				r,
				PI * 1.5,
				PI * 2,
				cornerSegments,
			),
		); // top-right
		verts.push(
			...generateTriangleFan(
				x + width - r,
				y + height - r,
				r,
				r,
				0,
				PI * 0.5,
				cornerSegments,
			),
		); // bottom-right
		verts.push(
			...generateTriangleFan(
				x + r,
				y + height - r,
				r,
				r,
				PI * 0.5,
				PI,
				cornerSegments,
			),
		); // bottom-left

		this.currentBatcher.drawVertices(this.gl.TRIANGLES, verts);
	}

	/**
	 * Stroke a Point at the specified coordinates
	 * @param {number} x - x axis of the coordinate for the point.
	 * @param {number} y - y axis of the coordinate for the point.
	 */
	strokePoint(x, y) {
		this.strokeLine(x, y, x + 1, y + 1);
	}

	/**
	 * Draw a point at the specified coordinates
	 * @param {number} x - x axis of the coordinate for the point.
	 * @param {number} y - y axis of the coordinate for the point.
	 */
	fillPoint(x, y) {
		this.strokePoint(x, y);
	}

	/**
	 * Draw a gradient-filled shape by masking with the shape and filling the bounding rect.
	 * Temporarily disables the gradient to prevent recursion in the fill methods.
	 * @param {Function} drawShape - draws the shape into the stencil buffer
	 * @param {number} x - bounding rect x
	 * @param {number} y - bounding rect y
	 * @param {number} w - bounding rect width
	 * @param {number} h - bounding rect height
	 * @ignore
	 */
	#gradientMask(drawShape, x, y, w, h) {
		const gl = this.gl;
		const grad = this._currentGradient;
		const hasMask = this.maskLevel > 0;
		this._currentGradient = null;

		this.flush();

		gl.enable(gl.STENCIL_TEST);
		gl.colorMask(false, false, false, false);

		// The stencil value of currently-VISIBLE pixels, as installed by
		// setMask (its single source of truth). The shape's visible pixels
		// are tagged with a high-bit marker (mask levels only use the low 7
		// bits, so the marker can never collide with one), the gradient is
		// clipped to the marker, then the marker is cleared and setMask's
		// exact render test is re-installed.
		const visibleRef = this._maskVisibleRef;
		let markRef = 1;

		if (hasMask) {
			markRef = 0x80 | visibleRef;
			// tag: only pixels that are visible under the active mask
			// (low bits == visibleRef) get the marker written
			gl.stencilFunc(gl.EQUAL, markRef, 0x7f);
			gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
		} else {
			gl.clear(gl.STENCIL_BUFFER_BIT);
			gl.stencilFunc(gl.ALWAYS, 1, 0xff);
			gl.stencilOp(gl.REPLACE, gl.REPLACE, gl.REPLACE);
		}

		drawShape();
		this.flush();

		// use stencil to clip the gradient to the marked pixels
		gl.colorMask(true, true, true, true);
		gl.stencilFunc(gl.EQUAL, markRef, 0xff);
		gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

		this._currentGradient = grad;
		this.fillRect(x, y, w, h);
		this.flush();

		if (hasMask) {
			// clear the marker: write the visible value back on the shape's
			// pixels (REPLACE writes the func ref — a no-op on unmarked
			// visible pixels, and it strips the high bit from marked ones)
			this._currentGradient = null;
			gl.colorMask(false, false, false, false);
			gl.stencilFunc(gl.EQUAL, visibleRef, 0x7f);
			gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
			drawShape();
			this.flush();
			gl.colorMask(true, true, true, true);
			// re-install the exact render test setMask had established
			gl.stencilFunc(gl.EQUAL, visibleRef, 0xff);
			gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
			this._currentGradient = grad;
		} else {
			gl.disable(gl.STENCIL_TEST);
		}
	}

	/**
	 * Reset (overrides) the renderer transformation matrix to the
	 * identity one, and then apply the given transformation matrix.
	 * @param {Matrix2d|Matrix3d|number} a - a matrix to transform by, or the a component to multiply the current matrix by
	 * @param {number} b - the b component to multiply the current matrix by
	 * @param {number} c - the c component to multiply the current matrix by
	 * @param {number} d - the d component to multiply the current matrix by
	 * @param {number} e - the e component to multiply the current matrix by
	 * @param {number} f - the f component to multiply the current matrix by
	 */
	setTransform(a, b, c, d, e, f) {
		this.resetTransform();
		this.transform(a, b, c, d, e, f);
	}

	/**
	 * Multiply given matrix into the renderer tranformation matrix
	 * @see {@link WebGLRenderer.setTransform} which will reset the current transform matrix prior to performing the new transformation
	 * @param {Matrix2d|Matrix3d|number} a - a matrix to transform by, or the a component to multiply the current matrix by
	 * @param {number} b - the b component to multiply the current matrix by
	 * @param {number} c - the c component to multiply the current matrix by
	 * @param {number} d - the d component to multiply the current matrix by
	 * @param {number} e - the e component to multiply the current matrix by
	 * @param {number} f - the f component to multiply the current matrix by
	 */
	transform(a, b, c, d, e, f) {
		if (typeof a === "object") {
			// accepts both Matrix2d and Matrix3d (no temporary copy needed)
			this.currentTransform.multiply(a);
		} else {
			// individual 2D affine components
			this.currentTransform.multiply(
				_tempMatrix.setTransform(
					a,
					b,
					0,
					0,
					c,
					d,
					0,
					0,
					0,
					0,
					1,
					0,
					e,
					f,
					0,
					1,
				),
			);
		}
		if (this.settings.subPixel === false) {
			// snap position values to pixel grid
			const a = this.currentTransform.val;
			a[12] |= 0;
			a[13] |= 0;
		}
	}

	/**
	 * adds a translation transformation to the current matrix.
	 * @param {number} x - Distance to move in the horizontal direction. Positive values are to the right, and negative to the left.
	 * @param {number} y - Distance to move in the vertical direction. Positive values are down, and negative are up.
	 */
	translate(x, y) {
		this.currentTransform.translate(x, y);
		if (this.settings.subPixel === false) {
			// snap position values to pixel grid
			const a = this.currentTransform.val;
			a[12] |= 0;
			a[13] |= 0;
		}
	}

	/**
	 * clip the given region from the original canvas. Once a region is clipped,
	 * all future drawing will be limited to the clipped region.
	 * You can however save the current region using the save(),
	 * and restore it (with the restore() method) any time in the future.
	 * (<u>this is an experimental feature !</u>)
	 * @param {number} x - x axis of the coordinate for the upper-left corner of the rectangle to start clipping from.
	 * @param {number} y - y axis of the coordinate for the upper-left corner of the rectangle to start clipping from.
	 * @param {number} width - the width of the rectangle to start clipping from.
	 * @param {number} height - the height of the rectangle to start clipping from.
	 */
	clipRect(x, y, width, height) {
		const canvas = this.getCanvas();
		const gl = this.gl;

		// `ColorLayer`-style hosts have `Infinity` dimensions + a 0.5
		// anchor, leaving `currentTransform.tx/ty = -Infinity`. Running
		// transform math on that produces NaN corners and a broken
		// `gl.scissor`. Treat a non-finite transform as "no clip".
		const m = this.currentTransform;
		if (!Number.isFinite(m.tx) || !Number.isFinite(m.ty)) {
			if (this._scissorActive) {
				// drain pending vertices under the active scissor first;
				// otherwise they would flush later under no scissor.
				this.flush();
				gl.disable(gl.SCISSOR_TEST);
				this._scissorActive = false;
			}
			return;
		}

		// derive the screen-space AABB by feeding the rect's 4 corners
		// through `currentTransform` via `Bounds.addFrame` (which short-
		// circuits the corner walk when the transform is identity).
		// `gl.scissor` is not transform-aware, so any rotation collapses
		// to the rotated-rect AABB on screen — Canvas's `context.clip()`
		// would produce a true polygonal clip, but downstream rendering
		// only observes the AABB anyway. Issue #1349.
		const aabb = this._clipAABB;
		aabb.clear();
		aabb.addFrame(x, y, x + width, y + height, m);
		const sx = Math.floor(aabb.min.x);
		const sy = Math.floor(aabb.min.y);
		const sw = Math.ceil(aabb.max.x - sx);
		const sh = Math.ceil(aabb.max.y - sy);

		// If the resulting screen AABB covers the whole canvas, treat as
		// no-clip and disable the scissor. Caller intent: "clip to the
		// full viewport" → no scissor needed. Works regardless of the
		// transform that produced the AABB.
		if (
			sx <= 0 &&
			sy <= 0 &&
			sx + sw >= canvas.width &&
			sy + sh >= canvas.height
		) {
			if (this._scissorActive) {
				this.flush();
				gl.disable(gl.SCISSOR_TEST);
				this._scissorActive = false;
			}
			return;
		}

		// `currentScissor` now stores screen-space coords directly so
		// `restore()` can re-apply without re-running the transform math.
		const cs = this.currentScissor;
		if (
			this._scissorActive &&
			cs[0] === sx &&
			cs[1] === sy &&
			cs[2] === sw &&
			cs[3] === sh
		) {
			return; // already at the right scissor
		}
		// flush the batcher BEFORE enabling/changing scissor — pending
		// vertices were queued under the previous clip state and need to
		// drain there.
		this.flush();
		gl.enable(gl.SCISSOR_TEST);
		this._scissorActive = true;
		// GL scissor uses bottom-left origin
		gl.scissor(sx, canvas.height - sh - sy, sw, sh);
		cs[0] = sx;
		cs[1] = sy;
		cs[2] = sw;
		cs[3] = sh;
	}

	/**
	 * A mask limits rendering elements to the shape and position of the given mask object.
	 * If the drawing or rendering area is larger than the mask, only the intersecting part of the renderable will be visible.
	 * (Note Mask are not preserved through renderer context save and restore and need so be manually cleared)
	 * @see CanvasRenderer#clearMask
	 * @param {Rect|RoundRect|Polygon|Line|Ellipse} [mask] - a shape defining the mask to be applied
	 * @param {boolean} [invert=false] - either the given shape should define what is visible (default) or the opposite
	 */
	setMask(mask, invert = false) {
		const gl = this.gl;

		// flush the batcher
		this.flush();

		if (this.maskLevel === 0) {
			// Enable and setup GL state to write to stencil buffer
			gl.enable(gl.STENCIL_TEST);
			gl.clear(gl.STENCIL_BUFFER_BIT);
		}

		this.maskLevel++;
		if (this.maskLevel > 0x7f) {
			// mask levels live in the stencil's low 7 bits — the high bit is
			// reserved as #gradientMask's temporary marker, and an 8-bit
			// stencil couldn't represent deeper nesting anyway
			this.maskLevel = 0x7f;
			if (this._maskDepthWarned !== true) {
				this._maskDepthWarned = true;
				console.warn(
					"melonJS: setMask nesting deeper than 127 — mask level clamped",
				);
			}
		}

		// Write phase: increment stencil for the drawn shape's pixels so each
		// setMask call adds +1 to stencil inside the shape. This lets chained
		// inverted masks (e.g. multi-light cutouts) accumulate correctly:
		// stencil > 0 means "covered by some mask shape"; stencil == 0 means
		// "outside every mask shape".
		gl.colorMask(false, false, false, false);
		gl.stencilMask(0xff);
		gl.stencilFunc(gl.ALWAYS, 0, 0xff);
		gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);

		// fill the given mask shape
		this.fill(mask);

		// flush the batcher
		this.flush();

		gl.colorMask(true, true, true, true);

		// Render phase:
		// - invert=true: render where no mask shape covers (stencil == 0).
		//   With chained invert calls this naturally produces canvas \ ⋃ shapes.
		// - invert=false: render where the just-added mask covers
		//   (stencil == maskLevel, i.e. the intersection of all masks so far).
		if (invert === true) {
			gl.stencilFunc(gl.EQUAL, 0, 0xff);
		} else {
			gl.stencilFunc(gl.EQUAL, this.maskLevel, 0xff);
		}
		gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
		this._maskVisibleRef = invert === true ? 0 : this.maskLevel;
	}

	/**
	 * disable (remove) the rendering mask set through setMask.
	 * @see WebGLRenderer#setMask
	 */
	clearMask() {
		if (this.maskLevel > 0) {
			// flush the batcher
			this.flush();
			this.maskLevel = 0;
			this._maskVisibleRef = 0;
			this.gl.disable(this.gl.STENCIL_TEST);
		}
	}
}
