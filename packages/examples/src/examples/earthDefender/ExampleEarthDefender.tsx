/**
 * melonJS — Earth Defender.
 *
 * A shooter played on the surface of a planet, built to answer one
 * question: does melonJS's 3D tier make a sphere a place you can play on,
 * and can 2D and 3D share the frame convincingly while it happens?
 *
 * Module layout:
 * - `sphereMath.ts`    — great-circle movement and the view basis
 * - `constants.ts`     — tuning, in radians per second
 * - `domeGlow.ts`      — the shader each bolt lights the glass with
 * - `GameController.ts`— the game itself
 *
 * Controls: LEFT and RIGHT turn the craft and keep turning it, so holding
 * one brings it through a full 360 and round again; the ship traverses the
 * globe freely in any direction by pointing itself there first. UP or SHIFT
 * boosts, SPACE fires. A run ends back at the title screen.
 *
 * The craft has no lives. It has a shield that takes the damage, throws the
 * rock that hit it clear, and comes back on its own once nothing has
 * touched it for a couple of seconds; the run ends on the impact the shield
 * has nothing left to absorb.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	audio,
	BloomEffect,
	Camera3d,
	Color,
	Ellipse,
	event,
	input,
	Light3d,
	loader,
	plugin,
	Stage,
	state,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";
import { earthDefenderAssets } from "./assets";
import {
	BATTLE_MUSIC,
	BATTLE_MUSIC_VOLUME,
	BLOOM_INTENSITY,
	BLOOM_RADIUS,
	BLOOM_THRESHOLD,
	FILL_COLOR,
	FILL_INTENSITY,
	SUN_COLOR,
	SUN_DIRECTION,
	SUN_INTENSITY,
} from "./constants";
import { GameController } from "./GameController";
import { TitleScreen } from "./scenes/TitleScreen";
import { WarningScreen } from "./scenes/WarningScreen";

/**
 * The state the photosensitivity notice runs in.
 *
 * `state.USER` and not one of the named ids: `READY` means "get ready", and
 * none of the others mean "read this first". The engine reserves everything
 * from `USER` up for exactly this.
 */
const WARNING_STATE = state.USER;

const createGame = async () => {
	const app = new Application(1024, 576, {
		parent: "screen",
		renderer: video.AUTO,
		scale: "auto",
		cameraClass: Camera3d,
		// The scene is lit geometry over a flat black ground: a world-space
		// blob shadow has nothing to land on out here.
		castGroundShadow: false,
		// Half-float render targets, so the emitters can put out more light
		// than the display can show and the bloom has something real to
		// threshold on. Without this the frame clamps at every write and the
		// brightest bolt is the same white as the dimmest one. Refused
		// gracefully on a driver that cannot do it, so this is safe to ask
		// for unconditionally; `renderer.supportsHDR` says what was granted.
		hdr: true,
	});
	await app.init();

	// Kept on, not a leftover: toggle with S, or add `#debug` to the URL.
	// On a scene where everything collides on a SPHERE, the hitbox overlay is
	// the only thing that shows whether a rock is where it says it is, and
	// this example is partly here to be read.
	plugin.register(DebugPanelPlugin, "debugPanel");

	// A 3D tier needs a programmable pipeline. Under the Canvas fallback a
	// Camera3d draws a black frame, which reads as a broken example rather
	// than an unsupported browser, so say which it is.
	if (app.renderer.shaderLanguage === null) {
		throw new Error(
			"Earth Defender needs WebGL 2 or WebGPU — this browser fell back to Canvas.",
		);
	}

	// deep space, not black: the planet's dark limb needs something to sit
	// against or it reads as a hole in the screen
	app.world.backgroundColor.parseCSS("#05060f");

	input.bindKey(input.KEY.LEFT, "left");
	input.bindKey(input.KEY.A, "left");
	input.bindKey(input.KEY.RIGHT, "right");
	input.bindKey(input.KEY.D, "right");
	// Left and right TURN, and keep turning: hold one and the craft comes
	// all the way round, through a full circle and on. Up and shift are the
	// same control, thrust; down does nothing, since slowing to turn about
	// is what the turn itself is for.
	input.bindKey(input.KEY.UP, "boost");
	input.bindKey(input.KEY.W, "boost");
	input.bindKey(input.KEY.SHIFT, "boost");
	input.bindKey(input.KEY.SPACE, "fire");

	// The title menu's own keys. Only the three the game does not already
	// have: its cursor moves on "boost" (UP / W / SHIFT) and selects on
	// "fire" (SPACE), which are the same physical keys, so rebinding those
	// would mean restoring them on the way into the game.
	input.bindKey(input.KEY.DOWN, "menuDown");
	input.bindKey(input.KEY.ENTER, "menuSelect");
	input.bindKey(input.KEY.ESC, "menuBack");

	// Fullscreen, on its own key rather than only in a menu: it is the one
	// setting a player wants BEFORE they start, and the title screen has no
	// room for a fourth entry (the best-score line sits a step below the
	// menu, and the saucer's band a step above it).
	input.bindKey(input.KEY.F, "fullscreen");
	input.bindKey(input.KEY.M, "muteAudio");

	/**
	 * Toggle fullscreen or the sound from anywhere: title, run, settings
	 * card or pause menu.
	 *
	 * One subscription rather than a poll in each of the three screens that
	 * would have to read it. `requestFullscreen` checks support itself and
	 * no-ops without it, so there is nothing to branch on here.
	 * @param action - the bound action the key carries, if any
	 * @param _keyCode - unused
	 * @param edge - true on the press, false on an auto-repeat
	 */
	const onSettingKey = (
		action: string | undefined,
		_keyCode: number,
		edge: boolean,
	) => {
		// EDGE only. A held key repeats, and a repeat would toggle straight
		// back out of whatever it just turned on.
		if (!edge) {
			return;
		}
		if (action === "fullscreen") {
			if (app.isFullscreen()) {
				app.exitFullscreen();
			} else {
				app.requestFullscreen();
			}
		} else if (action === "muteAudio") {
			if (audio.muted()) {
				audio.unmuteAll();
			} else {
				audio.muteAll();
			}
		}
	};
	event.on(event.KEYDOWN, onSettingKey);

	// ── the same game on a controller ────────────────────────────────
	//
	// `bindGamepad` maps a pad input onto a KEYCODE rather than onto an
	// action, which is why this sits below the keys and not beside the code
	// that reads them: the keycode must already carry an action or the bind
	// throws, and nothing downstream ever learns a controller was involved.
	// `isKeyPressed("left")` answers the same whichever device moved.
	//
	// EVERY slot, not just the first. Bindings are per gamepad INDEX, and the
	// index is handed out in plug order, so slot 0 is a guess: a wheel, a
	// spare pad or a keyboard-shaped device left plugged in can hold it for a
	// whole session while the player presses buttons on slot 1. A one-player
	// game wants whichever pad is to hand, so it binds them all to the same
	// actions and lets `input.activeGamepad()` say which one is in use when
	// something has to be sent BACK, which is the rumble.
	//
	// It costs nothing: the poll skips a bound index with no pad in it.
	const SLOTS = 4;
	const button = (code: number, key: number) => {
		for (let pad = 0; pad < SLOTS; pad++) {
			input.bindGamepad(pad, { type: "buttons", code }, key);
		}
	};
	const axis = (code: number, threshold: number, key: number) => {
		for (let pad = 0; pad < SLOTS; pad++) {
			input.bindGamepad(pad, { type: "axes", code, threshold }, key);
		}
	};

	// Steering, on the stick and the D-pad both. The stick is the one that
	// will be used and the D-pad is what a player tries first.
	//
	// The threshold is ADDED to the deadzone rather than replacing it, so
	// 0.15 asks for a quarter deflection: low enough that a nudge turns,
	// high enough that a worn stick resting off centre does not fly the
	// craft into the dome while the player is reading the title screen.
	axis(input.GAMEPAD.AXES.LX, -0.15, input.KEY.LEFT);
	axis(input.GAMEPAD.AXES.LX, 0.15, input.KEY.RIGHT);
	button(input.GAMEPAD.BUTTONS.LEFT, input.KEY.LEFT);
	button(input.GAMEPAD.BUTTONS.RIGHT, input.KEY.RIGHT);

	// Thrust. On the right trigger, because it is the one analogue control a
	// hand expects to hold down, and on up as well since "boost" is also the
	// title menu's cursor-up and a player in a menu reaches for up.
	button(input.GAMEPAD.BUTTONS.R2, input.KEY.UP);
	button(input.GAMEPAD.BUTTONS.UP, input.KEY.UP);
	axis(input.GAMEPAD.AXES.LY, -0.15, input.KEY.UP);

	// The gun, on the bottom face button and the right bumper. The face
	// button doubles as menu select, which is what it already means
	// everywhere else, so the title screen needs nothing of its own.
	button(input.GAMEPAD.BUTTONS.FACE_1, input.KEY.SPACE);
	button(input.GAMEPAD.BUTTONS.R1, input.KEY.SPACE);

	// Menus. Down is its own action because the game has no use for it, and
	// start and the right face button are the two a player will try for
	// confirm and back.
	button(input.GAMEPAD.BUTTONS.DOWN, input.KEY.DOWN);
	axis(input.GAMEPAD.AXES.LY, 0.15, input.KEY.DOWN);
	button(input.GAMEPAD.BUTTONS.FACE_2, input.KEY.ESC);

	// SELECT and START both go to ESC, which is pause in game and back in a
	// menu. They are the two a hand reaches for to pause, whatever the pad
	// calls them: Options and Share on a PlayStation pad, Menu and View on an
	// Xbox one, and 8 and 9 to the browser either way.
	//
	// START therefore no longer reaches ENTER, and nothing on the pad does.
	// It does not need to: the menus select on `fire`, which is the bottom
	// face button, and the game-over screen takes either. A pad that paused
	// the game with one button and confirmed with the same one would be
	// unable to leave a pause at all.
	button(input.GAMEPAD.BUTTONS.SELECT, input.KEY.ESC);
	button(input.GAMEPAD.BUTTONS.START, input.KEY.ESC);

	// Everything the game needs goes through the loader, models and shader
	// alike: the compile and the parse then land behind the loading screen
	// rather than as a hitch on the first frame that wants them.
	// Before the preload: the audio loader appends each of these extensions to
	// a clip's name and takes the first the browser can play, so it has to know
	// them before it is asked for anything. Ogg for the size, wav as the
	// fallback and the gapless one, which a seamless loop wants.
	// Every clip here ships an `.ogg`, so the first rung resolves and nothing
	// asks for a file that is not there. `mp3` is the fallback for a browser
	// without Vorbis, and `wav` is the saucer drone's.
	audio.init("ogg,mp3,wav");

	// THE SCENE'S SCALE, which the engine's defaults cannot know.
	//
	// Those are shaped for a game measured in pixels: `refDistance: 240` with
	// an inverse model. Here the listener rides the camera and the action
	// happens 743 to 2175 world units away, median 1626 — measured, not
	// guessed — so a rock breaking apart played at 240/1626, about 15% of its
	// volume, and simply could not be heard under the music. Matching the
	// reference distance to the play area puts a nearby event at full volume
	// and still leaves the far side of the globe audibly further off.
	audio.setSpatialDefaults({ refDistance: 1200, maxDistance: 20000 });

	await loader.preload(earthDefenderAssets());

	// Into a stage of our own, which is where the scene gets built.
	//
	// `loader.preload` with no callback switches to `state.LOADING` itself and
	// does NOT switch back, so without this the built-in loader stage keeps
	// drawing its logo and progress bar over a game running perfectly
	// underneath. `state.change(state.DEFAULT)` would be enough to escape it,
	// but a stage of our own is the thing actually wanted: it gives the scene
	// a lifecycle, so entering the state IS building the scene and leaving it
	// tears the scene down.
	// An iris between states, rather than the hard cut this had.
	//
	// It works on this scene at all because a camera effect reaches a
	// `Camera3d` now: a transition is a camera effect, so before that a 3D
	// scene changed state with nothing drawn over it. The shape is a unit
	// ellipse scaled to the screen by the effect, which on a game played on a
	// sphere reads as a viewport closing rather than as a curtain.
	//
	// Global, so it covers the first switch out of the loader as well: the
	// title opens up out of black instead of appearing whole.
	state.transition("mask", "#000", 520, new Ellipse(0, 0, 1, 1));
	// One of the engine's user state slots rather than a built-in id. There is
	// no built-in that means "a notice the player has to acknowledge", and
	// `state.USER` exists precisely so a game does not have to borrow one that
	// means something else.
	state.set(WARNING_STATE, new WarningScreen());
	state.set(state.MENU, new TitleScreen());
	state.set(state.PLAY, new PlayScreen());
	// The notice first, not the title.
	//
	// It is owed on its own merits, and it pays for itself twice: a browser
	// keeps the audio context suspended until the page has been clicked,
	// tapped or typed into, so the gesture that dismisses the notice is also
	// the one that lets the title's music start. Before this screen existed
	// the menu track was simply missing until the player happened to click
	// something, which on a keyboard game could be the whole way in.
	//
	// `true` to switch now rather than on the next tick, which is what you
	// want immediately after a preload.
	state.change(WARNING_STATE, true);

	// Handed back to the example harness, which runs it on unmount. The
	// subscription outlives every stage in this example, so nothing else is
	// in a position to take it down.
	return () => {
		event.off(event.KEYDOWN, onSettingKey);
	};
};

/**
 * The game itself, as a stage.
 *
 * A `Stage` and not a pile of `app.world.addChild` calls in the bootstrap,
 * because a screen wants a lifecycle: `onResetEvent` runs on EVERY entry to
 * the state, so the scene is built by entering it and thrown away by leaving.
 * Built in here rather than in a constructor for the same reason — a
 * constructor runs once, and a scene built there would not come back.
 *
 * Note what does NOT live here: the simulation. {@link GameController} is a
 * child of the world, and only `Container.update` consults `state.isPaused()`
 * — a stage's own `update()` runs whatever the pause says. A game driven from
 * `Stage.update` keeps simulating behind a pause with its world frozen, which
 * reads as anything but a pause bug.
 */
class PlayScreen extends Stage {
	/** kept only so leaving the stage can tear the run down */
	private controller: GameController | undefined;
	/** this stage's camera; see {@link TitleScreen} for why it is narrowed */
	private camera3d!: Camera3d;

	/**
	 * Build the scene.
	 * @param app - the application this stage belongs to
	 */
	override onResetEvent(app: Application) {
		// The stage's camera, narrowed ONCE here rather than asserted at each
		// use. `app.viewport` is whatever the active stage resolved to, so
		// it is typed `Camera2d`; `instanceof` is the check the language
		// verifies, and it fails loudly if the application is ever built
		// without `cameraClass: Camera3d`.
		const viewport = app.viewport;
		if (!(viewport instanceof Camera3d)) {
			throw new Error("Earth Defender needs a Camera3d viewport");
		}
		this.camera3d = viewport;

		// deep space, not black: the planet's dark limb needs something to sit
		// against or it reads as a hole in the screen
		app.world.backgroundColor.parseCSS("#05060f");

		// The game's own bed, which replaces the title's: `playTrack` stops
		// the track it replaces, so stating the music a screen wants is the
		// whole of it. The `stopTrack` in `onDestroyEvent` is for the other
		// case, leaving the example altogether, where nothing follows to
		// take the floor.
		audio.playTrack(BATTLE_MUSIC, BATTLE_MUSIC_VOLUME);

		// A key light low and to one side so the planet has a terminator to
		// read its curvature by, plus a cool ambient fill so the dark side is
		// navigable rather than a void the player loses rocks in.
		// The key light travels AWAY from the camera and into the scene, which
		// is what puts the terminator round the far limb and leaves a specular
		// hit on the near face of the dome: a sun behind the viewer's shoulder.
		// `direction` is the direction light travels, not where it comes from.
		//
		// Stated in the CAMERA's frame, and turned into the world every frame by
		// the controller. The camera is posed from the player's surface point, so
		// a direction fixed in the world would leave the player flying into night
		// the moment they crossed the terminator; over the shoulder is where this
		// sun belongs, and that is a statement about the view.
		const sun = new Light3d({
			type: "directional",
			direction: SUN_DIRECTION,
			color: new Color().parseCSS(SUN_COLOR),
			intensity: SUN_INTENSITY,
		});
		app.world.addChild(sun);
		// A cool fill so the night side is navigable rather than a void the
		// player loses rocks in.
		app.world.addChild(
			new Light3d({
				type: "ambient",
				color: new Color().parseCSS(FILL_COLOR),
				intensity: FILL_INTENSITY,
			}),
		);

		const gc = new GameController(app, sun, this.camera3d);
		this.controller = gc;
		app.world.addChild(gc);

		// Bloom on the emitters: the half of the HDR chain that spills light onto
		// its surroundings. The other half is the `1 - exp(-x)` curve each emitter
		// carries in its own shader, driven by the exposure constants under
		// `─── HDR ───` in `constants.ts`.
		//
		// `BloomEffect` and not a hand-written pass: the engine ships this since
		// 20.8, it sizes its taps from the renderer rather than needing a `uTexel`
		// kept in step by hand, and `radius` puts its two rings where the pass
		// that used to live here put them.
		//
		// Not `GlowEffect`, which does nothing on a viewport: it draws a halo
		// around a SPRITE by reading neighbouring alpha where its own alpha is
		// zero, and every fragment of a full frame is opaque, so it returns early
		// on all of them.
		//
		// Added HERE and not in the bootstrap: a stage instantiates the camera on
		// its first reset and the application repoints `viewport` at it, so an
		// effect added before this point would be hung on a camera that is no
		// longer the one being drawn through.
		app.viewport.addPostEffect(
			new BloomEffect(app.renderer, {
				threshold: BLOOM_THRESHOLD,
				intensity: BLOOM_INTENSITY,
				radius: BLOOM_RADIUS,
			}),
		);
		// No tone map on this camera, under `hdr` or without it.
		//
		// This scene's look is built ON the clamp: clipped white specular on the
		// ocean, a hot rim on the limb, saturated neon in the HUD. Every tone
		// curve maps 1 to less than 1, so grading it turns those whites matte and
		// the picture reads as duller and flatter than the same build with `hdr`
		// off, whatever the exposure. Measured rather than argued: the frame mean
		// went UP while the near-white pixel count went DOWN, which is exactly
		// what "lost its highlights" looks like in numbers.
		//
		// What `hdr` buys here without one: the dome, the atmosphere, the nebula
		// and the bolt flares all write additively, and each used to saturate on
		// the way in, so overlapping light was thrown away before any effect ran.
		// Now it survives to the bloom, and the threshold above discriminates
		// genuinely over-bright pixels instead of merely bright ones.
		//
		// `hdrOutput` is off here for the same reason, and it is the same
		// decision rather than a second one. It removes the clamp on the final
		// blit, so on an HDR display everything driven above 1 — the dome, the
		// atmosphere, the bolt flares — would present brighter instead of
		// saturating. That clamp is what this scene was art-directed against, so
		// taking it away would change the picture on exactly the displays that
		// can show the difference, and nobody would have authored for it.
		//
		// A game whose art is authored in linear light wants the opposite choice
		// on both counts; see the HDR example, which turns both on and drives
		// them.
	}
	/**
	 * Leaving the game: a death goes back to the title now, so this runs
	 * once per run rather than never.
	 *
	 * `World.reset` destroys world children, which is most of the scene. The
	 * controller holds what it cannot see: idle pool entries with a shader
	 * clone apiece, tweens still in flight, and the saucer's looping drone.
	 */
	override onDestroyEvent() {
		this.controller?.destroy();
		this.controller = undefined;
		// For the exit the title does not cover: navigating away from the
		// example leaves the stage with nothing following it, and a looping
		// track with no successor to replace it would play on over whatever
		// the visitor opened next.
		audio.stopTrack();
	}
}

export const ExampleEarthDefender = createExampleComponent(createGame);
