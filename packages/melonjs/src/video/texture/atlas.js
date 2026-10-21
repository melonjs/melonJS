// from `cache.js` rather than `loader.js`, for the same reason `sprite.js`
// does: this module is inside the cycle that `class NineSliceSprite extends
// Sprite` has to load through, and the cache module keeps a single runtime
// import where the loader pulls in every parser
import { getImage } from "./../../loader/cache.js";
import { Vector2d } from "../../math/vector2d.ts";
import NineSliceSprite from "./../../renderable/nineslicesprite.js";
import Sprite from "./../../renderable/sprite.js";
import { on, VIDEO_INIT } from "../../system/event.ts";
import { parseAseprite } from "./parser/aseprite.js";
import { parseSpriteSheet } from "./parser/spritesheet.js";
import { parseTexturePacker } from "./parser/texturepacker.js";
import Texture2d from "./texture2d.ts";

// The active renderer, captured at video init — atlas registration goes
// through the renderer's own cache rather than the global game instance
// (`on`, not `once`: a re-init — new Application after destroy — must
// re-capture the new renderer).
let _renderer;

on(VIDEO_INIT, (renderer) => {
	/**
	 * @ignore
	 * @internal
	 */
	_renderer = renderer;
});

/**
 * The stored UVs of the frame at exactly this source rectangle of a page.
 * @param {object} page - a page's record from `TextureAtlas#_pageUVs`
 * @param {number} x - source x coordinate
 * @param {number} y - source y coordinate
 * @param {number} w - source width
 * @param {number} h - source height
 * @returns {Float32Array|undefined} the frame's UVs, if one is there
 * @ignore
 */
function frameUVs(page, x, y, w, h) {
	const corner = page.frames.get(x)?.get(y);
	if (corner !== undefined) {
		for (const f of corner) {
			if (f.width === w && f.height === h) {
				return f.uvs;
			}
		}
	}
	return undefined;
}

/**
 * additional import for TypeScript
 * @import {CompressedImage} from "../../loader/parsers/compressed_textures/compressed_image.js";
 */

/**
 * create a simple 1 frame texture atlas based on the given parameters
 * @ignore
 * @internal
 */
export function createAtlas(
	width,
	height,
	name = "default",
	repeat = "no-repeat",
) {
	return {
		meta: {
			app: "melonJS",
			size: { w: width, h: height },
			repeat: repeat,
			image: "default",
		},
		frames: [
			{
				filename: name,
				frame: { x: 0, y: 0, w: width, h: height },
			},
		],
	};
}

/**
 * return a string that identifies the texture atlas type
 * @ignore
 * @internal
 */
export function identifyFormat(app) {
	if (app.includes("texturepacker") || app.includes("free-tex-packer")) {
		return "texturepacker";
	} else if (app.includes("shoebox")) {
		return "shoebox";
	} else if (app.includes("aseprite")) {
		return "aseprite";
	} else if (app.includes("melonJS")) {
		return "melonJS";
	} else {
		throw new Error("Unknown texture atlas format: " + app);
	}
}

/**
 * A Texture atlas class, currently supports : <br>
 * - [TexturePacker]{@link http://www.codeandweb.com/texturepacker/} : through JSON export (standard and multipack texture atlas) <br>
 * - [Free Texture Packer]{@link http://free-tex-packer.com/app/} : through JSON export (standard and multipack texture atlas) <br>
 * - [aseprite]{@link https://www.aseprite.org/} : through JSON export (standard and multipack texture atlas) <br>
 * - [ShoeBox]{@link http://renderhjs.net/shoebox/} : through JSON export using the
 * melonJS setting [file]{@link https://github.com/melonjs/melonJS/raw/master/media/shoebox_JSON_export.sbx} <br>
 * - Standard (fixed cell size) spritesheet : through a {framewidth:xx, frameheight:xx, anchorPoint:me.Vector2d} object
 * );
 * @category Game Objects
 */
export class TextureAtlas extends Texture2d {
	/**
	 * This texture carries named regions, so `getRegion()` is meaningful.
	 * @type {boolean}
	 * @readonly
	 */
	get isAtlas() {
		return true;
	}

	/**
	 * @param {object|object[]} atlases - atlas information. See {@link loader.getJSON}
	 * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|CompressedImage|string|OffscreenCanvas[]|HTMLImageElement[]|HTMLCanvasElement[]|string[]} [src=atlas.meta.image] - Image source
	 * @param {boolean|object} [options] - either a boolean (legacy `cache` flag — `false` disables `TextureCache` registration; default behavior is to cache) or an options object `{ cache?: boolean, normalMap?: HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap|string }`. When `normalMap` is provided, the atlas exposes a paired normal-map texture sharing the same UVs as the color texture (used by the WebGL renderer's lit pipeline). `HTMLVideoElement` is intentionally not supported as a normal map (would freeze on frame 0 due to per-image GL texture caching).
	 * @example
	 * // create a texture atlas from a JSON Object
	 * game.texture = new me.TextureAtlas(
	 *     me.loader.getJSON("texture")
	 * );
	 *
	 * // create a texture atlas from a multipack JSON Object
	 * game.texture = new me.TextureAtlas([
	 *     me.loader.getJSON("texture-0"),
	 *     me.loader.getJSON("texture-1"),
	 *     me.loader.getJSON("texture-2")
	 * ]);
	 *
	 * // create a texture atlas for a spritesheet with an anchorPoint in the center of each frame
	 * game.texture = new me.TextureAtlas(
	 *     {
	 *         framewidth : 32,
	 *         frameheight : 32,
	 *         anchorPoint : new me.Vector2d(0.5, 0.5)
	 *     },
	 *     me.loader.getImage("spritesheet")
	 * );
	 *
	 * // SpriteIlluminator workflow: pair the color atlas with its normal map
	 * game.texture = new me.TextureAtlas(
	 *     me.loader.getJSON("scene"),
	 *     me.loader.getImage("scene"),
	 *     { normalMap: me.loader.getImage("scene_n") }
	 * );
	 */
	constructor(atlases, src, options) {
		super();
		// backward compat: 3rd arg used to be a `cache` boolean.
		const opts =
			typeof options === "boolean" ? { cache: options } : options || {};
		const cache = opts.cache;
		const normalMap = opts.normalMap;
		/**
		 * to identify the atlas format (e.g. texture packer)
		 * @ignore
		 * @internal
		 */
		this.format = null;

		/**
		 * the texture source(s) itself
		 * @type {Map}
		 * @ignore
		 * @internal
		 */
		this.sources = new Map();

		/**
		 * paired normal-map source(s), keyed identically to `sources`.
		 * Populated from the constructor's `options.normalMap`. Used by
		 * the WebGL renderer's lit pipeline for per-pixel lighting.
		 * @type {Map}
		 * @ignore
		 * @internal
		 */
		this.normalSources = new Map();

		/**
		 * the atlas dictionnaries
		 * @type {Map}
		 * @ignore
		 * @internal
		 */
		this.atlases = new Map();

		/**
		 * the default "active" atlas (used for multiAtlas)
		 * @type {Map}
		 * @ignore
		 * @internal
		 */
		this.activeAtlas = undefined;

		/**
		 * Per atlas page: the size its frames' UVs were normalized by, and
		 * its frames by source rectangle (x, then y, then the frames at that
		 * corner), kept out of the page dictionary that animation code
		 * walks. See {@link TextureAtlas#addUVs}.
		 * @ignore
		 * @internal
		 */
		this._pageUVs = new WeakMap();

		/**
		 * What {@link TextureAtlas#_quadUVs} writes a computed rectangle into,
		 * so a draw allocates nothing. Overwritten by the next call.
		 * @ignore
		 * @internal
		 */
		this._uvScratch = new Float32Array(4);

		/**
		 * The image and page last drawn from, their size, and whether that
		 * page computes every UV from it, so a draw from the same page
		 * decides nothing. See {@link TextureAtlas#_quadUVs}.
		 * @ignore
		 * @internal
		 */
		this._uvSizeCheck = {
			source: null,
			page: null,
			width: 0,
			height: 0,
			fixed: false,
			computed: true,
		};

		// parse given atlas(es) paremeters
		if (typeof atlases !== "undefined") {
			// normalize to array to keep the following code generic
			atlases = Array.isArray(atlases) ? atlases : [atlases];
			for (const i in atlases) {
				const atlas = atlases[i];

				if (typeof atlas.meta !== "undefined") {
					this.format = identifyFormat(atlas.meta.app);
					this.repeat = atlas.meta.repeat || "no-repeat";
					switch (this.format) {
						case "texturepacker":
						case "aseprite":
							// set the texture
							if (typeof src === "undefined") {
								// get the texture name from the atlas meta data
								const image = getImage(atlas.meta.image);
								if (!image) {
									throw new Error("Atlas texture '" + image + "' not found");
								}
								this.sources.set(atlas.meta.image, image);
							} else {
								this.sources.set(
									atlas.meta.image || "default",
									typeof src === "string" ? getImage(src) : src,
								);
							}
							// initialize the atlas
							if (this.format === "texturepacker") {
								this.atlases.set(
									atlas.meta.image || "default",
									parseTexturePacker(atlas, this),
								);
							} else {
								this.atlases.set(
									atlas.meta.image || "default",
									parseAseprite(atlas, this),
								);
							}
							break;
						case "shoebox":
							if (
								!atlas.meta.exporter ||
								!atlas.meta.exporter.includes("melonJS")
							) {
								throw new Error(
									"ShoeBox requires the JSON exporter : " +
										"https://github.com/melonjs/melonJS/tree/master/media/shoebox_JSON_export.sbx",
								);
							}
							this.sources.set(
								"default",
								typeof src === "string" ? getImage(src) : src,
							);
							// initialize the atlas
							this.atlases.set(
								atlas.meta.image || "default",
								parseTexturePacker(atlas, this),
							);
							break;
						case "melonJS":
							this.sources.set(
								"default",
								typeof src === "string" ? getImage(src) : src,
							);
							// initialize the atlas
							this.atlases.set(
								atlas.meta.image || "default",
								parseTexturePacker(atlas, this),
							);
							break;
						default:
							throw new Error(
								"Unknown texture atlas format: " + atlas.meta.app,
							);
					}
				} else {
					// a regular spritesheet
					if (
						typeof atlas.framewidth !== "undefined" &&
						typeof atlas.frameheight !== "undefined"
					) {
						this.format = "Spritesheet (fixed cell size)";
						this.repeat = "no-repeat";

						if (typeof src !== "undefined") {
							// overwrite if specified
							atlas.image = typeof src === "string" ? getImage(src) : src;
						}
						// initialize the atlas
						this.atlases.set("default", parseSpriteSheet(atlas, this));
						this.sources.set("default", atlas.image);
					}
				}
			} // end forEach
			this.activeAtlas = this.atlases.keys().next().value;
		}

		// if format not recognized (`atlases` is a Map — `.size`, not `.length`)
		if (this.atlases.size === 0) {
			throw new Error("texture atlas format not supported");
		}

		// Add self to TextureCache if cache !== false
		if (cache !== false) {
			this.sources.forEach((source) => {
				_renderer.cache.set(source, this);
			});
		}

		// Populate the parallel normal-map sources map. For Phase 1 we
		// support a single paired normal-map (the typical SpriteIlluminator
		// workflow); each color source gets the same normal-map image.
		// Multipack atlases with per-source normal maps can be handled later
		// by accepting an array/Map matching `sources`.
		if (typeof normalMap !== "undefined" && normalMap !== null) {
			let resolved;
			if (typeof normalMap === "string") {
				resolved = getImage(normalMap);
				if (!resolved) {
					throw new Error(
						"TextureAtlas: normal map image '" + normalMap + "' not found",
					);
				}
			} else if (
				typeof normalMap === "object" &&
				typeof normalMap.width === "number" &&
				typeof normalMap.height === "number"
			) {
				// image-like (HTMLImageElement, HTMLCanvasElement,
				// OffscreenCanvas, ImageBitmap). Explicitly reject
				// HTMLVideoElement — it duck-types past the size check
				// but the lit pipeline caches the GL texture per image
				// reference and never re-uploads, so a video would freeze
				// on frame 0 (see `Sprite.normalMap`).
				if (typeof normalMap.videoWidth === "number") {
					throw new TypeError(
						"TextureAtlas: options.normalMap does not support HTMLVideoElement (the lit pipeline caches the texture per image reference and would freeze on frame 0)",
					);
				}
				resolved = normalMap;
			} else {
				throw new TypeError(
					"TextureAtlas: options.normalMap must be an image-like, a loader key string, or null/undefined; got " +
						typeof normalMap,
				);
			}
			this.sources.forEach((_source, key) => {
				this.normalSources.set(key, resolved);
			});
		}
	}

	/**
	 * return the default or specified atlas dictionnary
	 * @param {string} [name] - atlas name in case of multipack textures
	 * @returns {object}
	 */
	getAtlas(name) {
		if (typeof name === "string") {
			return this.atlases.get(name);
		} else {
			return this.atlases.get(this.activeAtlas);
		}
	}

	/**
	 * return the format of the atlas dictionnary
	 * @returns {string} will return "texturepacker", "shoebox", "aseprite", "melonJS", or "Spritesheet (fixed cell size)"
	 */
	getFormat() {
		return this.format;
	}

	/**
	 * return the source texture for the given region (or default one if none specified)
	 * @param {object} [region] - region name in case of multipack textures
	 * @returns {HTMLImageElement|HTMLCanvasElement}
	 */
	getTexture(region) {
		if (typeof region === "object" && typeof region.texture === "string") {
			return this.sources.get(region.texture);
		} else {
			return this.sources.get(this.activeAtlas);
		}
	}

	/**
	 * Return the paired normal-map texture for the given region, or `null`
	 * if no normal map was provided to this atlas. The normal map shares
	 * the same UV layout as the color texture returned by {@link TextureAtlas#getTexture}.
	 * @param {object} [region] - region name in case of multipack textures
	 * @returns {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap|null}
	 */
	getNormalTexture(region) {
		if (this.normalSources.size === 0) {
			return null;
		}
		if (typeof region === "object" && typeof region.texture === "string") {
			return this.normalSources.get(region.texture) ?? null;
		}
		return this.normalSources.get(this.activeAtlas) ?? null;
	}

	/**
	 * add a region to the atlas
	 * @param {string} name - region mame
	 * @param {number} x - x origin of the region
	 * @param {number} y - y origin of the region
	 * @param {number} w - width of the region
	 * @param {number} h - height of the region
	 * @returns {object} the created region
	 */
	addRegion(name, x, y, w, h) {
		const source = this.getTexture();
		const atlas = this.getAtlas();
		// an unsized HTMLVideoElement reports width/height = 0 — its real
		// pixel dimensions are videoWidth/videoHeight (same fallback as
		// `uploadTexture` and `TextureCache.get`)
		const dw = source.width || source.videoWidth;
		const dh = source.height || source.videoHeight;

		atlas[name] = {
			name: name,
			offset: new Vector2d(x, y),
			width: w,
			height: h,
			angle: 0,
		};

		this.addUVs(atlas, name, dw, dh);

		return atlas[name];
	}

	/**
	 * return a normalized region (or frame) information for the specified sprite name
	 * @param {string} name - name of the sprite
	 * @param {string} [atlas] - name of a specific atlas where to search for the region
	 * @returns {object}
	 */
	getRegion(name, atlas) {
		let region;
		if (typeof atlas === "string") {
			region = this.getAtlas(atlas)[name];
		} else {
			// look for the given region in each existing atlas
			for (const atlas of this.atlases.values()) {
				if (typeof atlas[name] !== "undefined") {
					// there should be only one
					region = atlas[name];
					break;
				}
			}
		}
		return region;
	}

	/**
	 * Return the UVs of a named region, or of a source rectangle of the
	 * active page.
	 *
	 * A rectangle that is one of the active page's frames returns that
	 * frame's own UVs. Any other rectangle returns a new array, computed from
	 * the size of the active page's image: nothing is cached and nothing is
	 * added to the atlas.
	 * @param {string|number} name - region (or frame) name, or sx when using numeric parameters
	 * @param {number} [sy] - source y coordinate (when using numeric parameters)
	 * @param {number} [sw] - source width (when using numeric parameters)
	 * @param {number} [sh] - source height (when using numeric parameters)
	 * @returns {Float32Array} region Uvs
	 * @throws {Error} if no region has that name
	 */
	getUVs(name, sy, sw, sh) {
		if (typeof name === "number") {
			const page = this._pageUVs.get(this.getAtlas());
			const frame =
				page === undefined ? undefined : frameUVs(page, name, sy, sw, sh);
			return (
				frame ??
				Float32Array.from(this._quadUVs(this.getTexture(), name, sy, sw, sh))
			);
		}

		const region = this.getRegion(name);
		if (typeof region?.uvs !== "undefined") {
			return region.uvs;
		}
		throw new Error("Texture - region for " + name + " not found");
	}

	/**
	 * The UVs a renderer draws a source rectangle of the active page with.
	 *
	 * Computed, not looked up: four divisions by the page's size. The
	 * result is written into one scratch array, so a draw allocates nothing
	 * and the next call overwrites it; read it straight away.
	 *
	 * A frame's UVs are normalized by the size its atlas file gives, which
	 * is the page's own size unless the image was exported or loaded at
	 * another scale than its file describes. On such a page a frame is drawn
	 * with its own UVs, as it always was, and anything else with the page's
	 * real size. Which kind of page this is gets decided once, and again
	 * when another page or image is drawn from, or when the image's pixels
	 * are replaced (see {@link TextureAtlas#_decideUVs}).
	 * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|ImageBitmap|OffscreenCanvas|CompressedImage} source - the active page's image, as drawn
	 * @param {number} sx - source x coordinate
	 * @param {number} sy - source y coordinate
	 * @param {number} sw - source width
	 * @param {number} sh - source height
	 * @returns {Float32Array} the UVs, valid until the next call
	 * @ignore
	 * @internal
	 */
	_quadUVs(source, sx, sy, sw, sh) {
		const check = this._uvSizeCheck;
		// kept small so engines inline it into the draw: deciding a page and
		// reading a frame's own UVs are the rare work, out of line
		if (
			check.source !== source ||
			check.page !== this.activeAtlas ||
			!check.fixed
		) {
			this._decideUVs(source);
		}
		if (!check.computed) {
			const frame = frameUVs(
				this._pageUVs.get(this.getAtlas()),
				sx,
				sy,
				sw,
				sh,
			);
			if (frame !== undefined) {
				return frame;
			}
		}
		const width = check.width;
		const height = check.height;
		const uvs = this._uvScratch;
		uvs[0] = sx / width;
		uvs[1] = sy / height;
		uvs[2] = (sx + sw) / width;
		uvs[3] = (sy + sh) / height;
		return uvs;
	}

	/**
	 * The out-of-line half of {@link TextureAtlas#_quadUVs}: read the size
	 * of the image drawn from, and decide whether the active page computes
	 * every UV from it.
	 *
	 * The size is read when the image's pixels go to the GPU: the first
	 * time it is drawn, and again after {@link TextureAtlas#_sizeChanged},
	 * which a canvas render target's `invalidate()` calls when it hands the
	 * GPU new pixels, maybe at a new size. Between those, a resized canvas
	 * still shows its old pixels on the GPU, and the old size is the one
	 * that samples them; reading a DOM image's size also costs more than the
	 * whole computation. A video is read on every draw, as it uploads every
	 * frame, and so is an image with no size yet, one still loading.
	 * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|ImageBitmap|OffscreenCanvas|CompressedImage} source - the active page's image, as drawn
	 * @ignore
	 * @internal
	 */
	_decideUVs(source) {
		const check = this._uvSizeCheck;
		const width = source.width || source.videoWidth;
		const height = source.height || source.videoHeight;
		if (
			check.source === source &&
			check.page === this.activeAtlas &&
			check.width === width &&
			check.height === height
		) {
			return;
		}
		const page = this._pageUVs.get(this.getAtlas());
		check.source = source;
		check.page = this.activeAtlas;
		check.width = width;
		check.height = height;
		check.fixed =
			width > 0 && height > 0 && typeof source.videoWidth !== "number";
		check.computed =
			page === undefined ||
			(!page.mixed && page.width === width && page.height === height);
	}

	/**
	 * Read the image's size and decide its page again on the next draw:
	 * the image's pixels are being replaced, maybe at another size, or a
	 * new frame changed what its page needs.
	 * @ignore
	 * @internal
	 */
	_sizeChanged() {
		this._uvSizeCheck.source = null;
	}

	/**
	 * add uvs mapping for the given region
	 * @param {object} atlas - the atlas dictionnary where the region is define
	 * @param {object} name - region (or frame) name
	 * @param {number} w - the width of the region
	 * @param {number} h - the height of the region
	 * @returns {Float32Array} the created region UVs
	 */
	addUVs(atlas, name, w, h) {
		// Source coordinates
		const s = atlas[name].offset;
		const sw = atlas[name].width;
		const sh = atlas[name].height;

		atlas[name].uvs = new Float32Array([
			s.x / w, // u0 (left)
			s.y / h, // v0 (top)
			(s.x + sw) / w, // u1 (right)
			(s.y + sh) / h, // v1 (bottom)
		]);
		// Indexed by source rectangle beside the page, not in it: animation
		// code walks the page dictionary, and a second key per frame would
		// show up there. Also note the size these UVs were normalized by:
		// a draw computes its UVs from the page's own size, and only a page
		// where that would differ needs a frame's stored UVs.
		let page = this._pageUVs.get(atlas);
		if (page === undefined) {
			page = { width: w, height: h, mixed: false, frames: new Map() };
			this._pageUVs.set(atlas, page);
		} else if (page.width !== w || page.height !== h) {
			page.mixed = true;
		}
		let column = page.frames.get(s.x);
		if (column === undefined) {
			column = new Map();
			page.frames.set(s.x, column);
		}
		let corner = column.get(s.y);
		if (corner === undefined) {
			corner = [];
			column.set(s.y, corner);
		}
		const entry = { width: sw, height: sh, uvs: atlas[name].uvs };
		const i = corner.findIndex((f) => {
			return f.width === sw && f.height === sh;
		});
		if (i === -1) {
			corner.push(entry);
		} else {
			corner[i] = entry;
		}
		// a new frame can change whether its page computes every UV
		this._sizeChanged();

		return atlas[name].uvs;
	}

	/**
	 * Create a sprite object using the first region found using the specified name
	 * @param {string} name - name of the sprite
	 * @param {object} [settings] - Additional settings passed to the {@link Sprite} contructor
	 * @param {boolean} [nineSlice=false] - if true returns a 9-slice sprite
	 * @returns {Sprite|NineSliceSprite}
	 * @example
	 * // create a new texture object under the `game` namespace
	 * game.texture = new me.TextureAtlas(
	 *    me.loader.getJSON("texture"),
	 *    me.loader.getImage("texture")
	 * );
	 * ...
	 * ...
	 * // create a new "coin" sprite
	 * let sprite = game.texture.createSpriteFromName("coin.png");
	 * // set the renderable position to bottom center
	 * sprite.anchorPoint.set(0.5, 1.0);
	 * ...
	 * ...
	 * // create a 9-slice sprite
	 * let dialogPanel = game.texture.createSpriteFromName(
	 *    "rpg_dialo.png",
	 *    // width & height are mandatory for 9-slice sprites
	 *    { width: this.width, height: this.height },
	 *    true
	 * );
	 */
	createSpriteFromName(name, settings, nineSlice = false) {
		// instantiate a new sprite object
		const Class = nineSlice === true ? NineSliceSprite : Sprite;
		return new Class(
			0,
			0,
			Object.assign(
				{
					image: this,
					region: name,
				},
				settings || {},
			),
		);
	}

	/**
	 * Create an animation object using the first region found using all specified names
	 * @param {string[]|number[]} [names] - list of names for each sprite (if not specified all defined names/entries in the atlas will be added)
	 * (when manually creating a Texture out of a spritesheet, only numeric values are authorized)
	 * @param {object} [settings] - Additional settings passed to the {@link Sprite} contructor
	 * @returns {Sprite}
	 * @example
	 * // create a new texture object under the `game` namespace
	 * game.texture = new me.TextureAtlas(
	 *     me.loader.getJSON("texture"),
	 *     me.loader.getImage("texture")
	 * );
	 *
	 * // create a new Animated Sprite
	 * let sprite = game.texture.createAnimationFromName([
	 *     "walk0001.png", "walk0002.png", "walk0003.png",
	 *     "walk0004.png", "walk0005.png", "walk0006.png",
	 *     "walk0007.png", "walk0008.png", "walk0009.png",
	 *     "walk0010.png", "walk0011.png"
	 * ]);
	 *
	 * // define an additional basic walking animation
	 * sprite.addAnimation ("simple_walk", [0,2,1]);
	 * // you can also use frame name to define your animation
	 * sprite.addAnimation ("speed_walk", ["walk0007.png", "walk0008.png", "walk0009.png", "walk0010.png"]);
	 * // set the default animation
	 * sprite.setCurrentAnimation("simple_walk");
	 * // set the renderable position to bottom center
	 * sprite.anchorPoint.set(0.5, 1.0);
	 */
	/**
	 * Return the Sprite settings object (framewidth, frameheight, atlas, atlasIndices, etc.)
	 * for the given set of atlas frame names. This is useful when extending {@link Sprite}
	 * and you need to pass atlas animation data to the parent constructor.
	 * @param {string[]|number[]} [names] - list of names for each sprite
	 * (when manually creating a Texture out of a spritesheet, only numeric values are authorized).
	 * If not specified, all defined names/entries in the atlas will be added.
	 * @returns {object} A settings object suitable for passing to the {@link Sprite} constructor
	 * @example
	 * // extend Sprite directly with texture atlas animation frames
	 * class MyPlayer extends me.Sprite {
	 *     constructor(x, y, settings) {
	 *         super(x, y, {
	 *             ...game.texture.getAnimationSettings([
	 *                 "walk0001.png", "walk0002.png", "walk0003.png"
	 *             ]),
	 *             anchorPoint: { x: 0.5, y: 1.0 }
	 *         });
	 *         // add a physic body
	 *         this.body = new me.Body(this, new me.Rect(0, 0, this.width, this.height));
	 *     }
	 * }
	 */
	getAnimationSettings(names) {
		const tpAtlas = [];
		const indices = {};
		let width = 0;
		let height = 0;
		const textureAtlas = this.getAtlas();

		if (typeof names === "undefined") {
			names = textureAtlas;
		}

		// first pass: collect regions and compute max dimensions
		const regions = [];
		for (const i in names) {
			const isArray = Array.isArray(names);
			const name = isArray ? names[i] : i;
			// in dictionary mode, only iterate real regions: a region's `name`
			// matches its dictionary key. This skips non-region entries like
			// the aseprite parser's `anims` dictionary
			// (whose value has no `name`, and which `getRegion` would otherwise
			// happily return as a NaN-sized pseudo-region).
			if (!isArray && (names[i] == null || names[i].name !== i)) {
				continue;
			}
			const region = this.getRegion(name);
			if (region == null) {
				if (isArray) {
					throw new Error("Texture - region for " + name + " not found");
				}
				continue;
			}
			regions.push({ name, region });
			const frameW = region.sourceSize ? region.sourceSize.w : region.width;
			const frameH = region.sourceSize ? region.sourceSize.h : region.height;
			width = Math.max(frameW, width);
			height = Math.max(frameH, height);
		}

		// second pass: clone regions, strip anchorPoint,
		// and add trim offset to bottom-align smaller frames
		for (const { name, region } of regions) {
			const regionCopy = Object.assign({}, region);
			delete regionCopy.anchorPoint;

			const frameH = region.sourceSize ? region.sourceSize.h : region.height;
			if (frameH < height) {
				// bottom-align by offsetting the y draw position
				regionCopy.trim = Object.assign({}, region.trim || { x: 0, y: 0 });
				regionCopy.trim.y += height - frameH;
			}

			tpAtlas.push(regionCopy);
			indices[name] = tpAtlas.length - 1;
		}

		return {
			image: this,
			framewidth: width,
			frameheight: height,
			margin: 0,
			spacing: 0,
			atlas: tpAtlas,
			anims: textureAtlas.anims,
			atlasIndices: indices,
		};
	}

	createAnimationFromName(names, settings) {
		const tpAtlas = [];
		const indices = {};
		let width = 0;
		let height = 0;
		const textureAtlas = this.getAtlas();

		if (typeof names === "undefined") {
			names = textureAtlas;
		}

		for (const i in names) {
			const isArray = Array.isArray(names);
			const name = isArray ? names[i] : i;
			// dictionary mode: skip non-region entries (see
			// getAnimationSettings for the full rationale)
			if (!isArray && (names[i] == null || names[i].name !== i)) {
				continue;
			}
			const region = this.getRegion(name);
			if (region == null) {
				throw new Error("Texture - region for " + name + " not found");
			}
			tpAtlas.push(region);
			indices[name] = tpAtlas.length - 1;
			const frameW = region.sourceSize ? region.sourceSize.w : region.width;
			const frameH = region.sourceSize ? region.sourceSize.h : region.height;
			width = Math.max(frameW, width);
			height = Math.max(frameH, height);
		}

		// instantiate a new animation sheet object
		return new Sprite(
			0,
			0,
			Object.assign(
				{
					image: this,
					framewidth: width,
					frameheight: height,
					margin: 0,
					spacing: 0,
					atlas: tpAtlas,
					anims: textureAtlas.anims,
					atlasIndices: indices,
				},
				settings || {},
			),
		);
	}
}
