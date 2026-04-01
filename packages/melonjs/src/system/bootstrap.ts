import { initKeyboardEvent } from "../input/keyboard.ts";
import { registerBuiltinTiledClass } from "../level/tiled/TMXObjectFactory.js";
import { setNocache } from "../loader/loader.js";
import Particle from "../particles/particle.ts";
import Collectable from "../renderable/collectable.js";
import ColorLayer from "../renderable/colorlayer.js";
import Entity from "../renderable/entity/entity.js";
import ImageLayer from "../renderable/imagelayer.js";
import Light2d from "../renderable/light2d.js";
import NineSliceSprite from "../renderable/nineslicesprite.js";
import Renderable from "../renderable/renderable.js";
import Sprite from "../renderable/sprite.js";
import BitmapText from "../renderable/text/bitmaptext.js";
import Text from "../renderable/text/text.js";
import Trigger from "../renderable/trigger.js";
import Tween from "../tweens/tween.ts";
import { getUriFragment } from "../utils/utils.ts";
import { version } from "../version.ts";
import { initVisibilityEvents } from "./device.js";
import { BOOT, DOM_READY, emit } from "./event.ts";
import pool from "./legacy_pool.js";

/**
 * a flag indicating that melonJS is fully initialized
 */
export let initialized = false;

/**
 * Initialize the melonJS library.
 * This is called automatically in two cases:
 * - On DOMContentLoaded, unless {@link skipAutoInit} is set to true
 * - By {@link Application.init} when creating a new game instance
 *
 * Multiple calls are safe — boot() is idempotent.
 * @see {@link skipAutoInit}
 */
export function boot() {
	// don't do anything if already initialized (should not happen anyway)
	if (initialized) {
		return;
	}

	// output melonJS version in the console
	console.log(`melonJS 2 (v${version}) | http://melonjs.org`);

	// register all built-ins objects into the object legacy pool
	// eslint-disable-next-line @typescript-eslint/no-deprecated
	pool.register("Entity", Entity);
	pool.register("Collectable", Collectable);
	pool.register("Trigger", Trigger);
	pool.register("Light2d", Light2d);
	pool.register("Particle", Particle, true);
	pool.register("Sprite", Sprite);
	pool.register("NineSliceSprite", NineSliceSprite);
	pool.register("Renderable", Renderable);
	pool.register("Text", Text, true);
	pool.register("BitmapText", BitmapText);
	pool.register("ImageLayer", ImageLayer);
	pool.register("Tween", Tween, true);
	pool.register("ColorLayer", ColorLayer, true);

	// ensure built-in classes are registered as Tiled object factories
	// (redundant with pool.register auto-registration, but ensures
	// built-ins remain available if pool behavior changes in the future)
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
