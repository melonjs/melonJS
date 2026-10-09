import { initKeyboardEvent } from "../input/keyboard.ts";
import { registerBuiltinTiledClass } from "../level/tiled/TMXObjectFactory.js";
import Light2d from "../lighting/light2d.ts";
import { setNocache } from "../loader/loader.js";
import Collectable from "../renderable/collectable.js";
import ColorLayer from "../renderable/colorlayer.js";
import Entity from "../renderable/entity/entity.js";
import ImageLayer from "../renderable/imagelayer.js";
import NineSliceSprite from "../renderable/nineslicesprite.js";
import Renderable from "../renderable/renderable.js";
import Sprite from "../renderable/sprite.js";
import BitmapText from "../renderable/text/bitmaptext.js";
import Text from "../renderable/text/text.js";
import Trigger from "../renderable/trigger.js";
import { getUriFragment } from "../utils/utils.ts";
import { version } from "../version.ts";
import { initVisibilityEvents } from "./device.js";
import { BOOT, DOM_READY, emit } from "./event.ts";

/**
 * a flag indicating that melonJS is fully initialized
 */
export let initialized = false;

/**
 * Initialize the melonJS library.
 * This is called automatically by the {@link Application} constructor.
 * Multiple calls are safe — boot() is idempotent.
 * When using {@link Application} directly, calling boot() manually is not needed.
 * @see {@link Application}
 */
export function boot() {
	// don't do anything if already initialized (should not happen anyway)
	if (initialized) {
		return;
	}

	// output melonJS version in the console
	console.log(`melonJS 2 (v${version}) | http://melonjs.org`);

	// The built-in classes are registered as Tiled object factories, and
	// ONLY there. They used to be registered in the legacy object pool as
	// well, which bought nothing and cost something:
	//
	// - nine of them had recycling off, so `pool.pull("Sprite")` was a plain
	//   construction behind a string key and `pool.push` refused them;
	// - `Particle` and `Tween` have typed pools (`particlePool`, `tweenPool`)
	//   and neither can reach the container's recycle path anyway, one being
	//   skipped with `keepalive` and the other not a `Renderable` at all;
	// - every one of them registered a Tiled factory a second time, by side
	//   effect, and that duplicate is what silently replaced a game's own
	//   class when it registered one under a built-in name.
	registerBuiltinTiledClass("Renderable", Renderable);
	registerBuiltinTiledClass("Text", Text);
	registerBuiltinTiledClass("BitmapText", BitmapText);
	// eslint-disable-next-line @typescript-eslint/no-deprecated
	registerBuiltinTiledClass("Entity", Entity);
	registerBuiltinTiledClass("Collectable", Collectable);
	registerBuiltinTiledClass("Trigger", Trigger);
	registerBuiltinTiledClass("Light2d", Light2d);
	registerBuiltinTiledClass("Sprite", Sprite);
	registerBuiltinTiledClass("NineSliceSprite", NineSliceSprite);
	registerBuiltinTiledClass("ImageLayer", ImageLayer);
	registerBuiltinTiledClass("ColorLayer", ColorLayer);

	// publish Boot notification
	emit(BOOT);

	// enable/disable the cache
	setNocache(!!getUriFragment().nocache);

	// automatically enable keyboard events
	initKeyboardEvent();

	// register blur/focus and visibility change handlers
	initVisibilityEvents();

	// mark melonJS as initialized
	initialized = true;

	// notify that the engine is ready
	emit(DOM_READY);
}
