/**
 * The title screen.
 *
 * A stage of its own rather than an overlay on the game, so the two never
 * share state: entering it builds the sky, the drifting rocks and the saucer,
 * and leaving it throws all three away. `onResetEvent` runs on every entry, so
 * coming back from a finished run gets a fresh title rather than whatever the
 * last one left behind.
 *
 * It is also where the asset credits live, which is not decoration: the
 * saucer and the bomb are CC0 and the drone is CC-BY, and CC-BY means the
 * attribution has to be somewhere a player can actually read it.
 */
import {
	type Application,
	audio,
	BloomEffect,
	Camera3d,
	Color,
	input,
	Light3d,
	loader,
	Mesh,
	math,
	Sprite3d,
	Stage,
	save,
	state,
	Text,
	Tween,
	Vector2d,
	Vector3d,
} from "melonjs";
import {
	AXIS_X,
	AXIS_Y,
	AXIS_Z,
	BEST_COLOR,
	BEST_SAVE_KEY,
	BLOOM_INTENSITY,
	BLOOM_RADIUS,
	BLOOM_THRESHOLD,
	BONUS_HUE,
	BONUS_LIGHTNESS,
	BONUS_SATURATION,
	FILL_COLOR,
	GAME_VERSION,
	HUD_FONT,
	ICE_HUE,
	ICE_LIGHTNESS,
	ICE_SATURATION,
	MENU_MUSIC,
	MENU_MUSIC_VOLUME,
	NEBULA_ALPHA,
	NEBULA_SPAN,
	ROCK_ALBEDO,
	ROCK_MODEL,
	ROCK_NORMAL,
	ROCK_SHININESS,
	ROCK_SPECULAR,
	SKY_Z,
	SUN_COLOR,
	UFO_MODEL,
	VERSION_COLOR,
} from "../constants";
import { nebulaSky } from "../fx/nebula";
import {
	CREDITS,
	INSTRUCTION_ROCKS,
	INSTRUCTIONS,
	ITEM_STEP,
	MenuItem,
	MODAL_GUTTER,
	Modal,
} from "../ui/menu";
import { SettingsPanel } from "../ui/settings";

/** where the title's own camera stands, and the depth its scene sits at */
const TITLE_Z = 1400;
/** one leg of the saucer's patrol, milliseconds: left edge to right edge */
const UFO_CROSS_MS = 9000;
/**
 * How far either side of centre the saucer turns around.
 *
 * At this depth the frame is about 745 world units either side, so it turns
 * just off screen rather than anywhere further: a wider run is time the
 * screen spends empty.
 */
const UFO_SPAN = 880;
/** scratch for the projection probe that calibrates the rock placement */
const _probeA = new Vector2d();
const _probeB = new Vector2d();

/** how near the camera the instruction rocks sit, and how big they read */
const MODAL_ROCK_Z = 150;
const MODAL_ROCK_PX = 15;
/**
 * How far left of the line's own left edge the rock's centre sits.
 *
 * HALF the gutter the panel opens for it, which is what puts the rock in the
 * middle of that space. Derived rather than tuned, so the two cannot drift
 * apart and leave the rock hanging over the card's edge again.
 */
const MODAL_ROCK_GAP = MODAL_GUTTER / 2;
/** the middle of the open band between the tagline and the controls */
const UFO_Y = 70;
/** how far the patrol bows upward at mid-screen */
const UFO_ARC = 90;
/** how far it leans into the direction it is travelling, radians */
const UFO_BANK = 0.55;
/**
 * How quickly the lean follows a change of direction, per millisecond.
 *
 * This is what rolls it over at each end rather than snapping, and it is
 * also what makes the lean immune to the tween's cadence: see the stall note
 * in `update`.
 */
const UFO_BANK_DAMP = 0.004;
/**
 * The step below which the saucer is treated as not having moved.
 *
 * A stalled frame is not a change of direction. Half a pixel at this depth.
 */
const UFO_STEP_EPS = 0.5;

interface TitleRock {
	mesh: Mesh;
	/** radians per second, one per axis, so it turns rather than spins flat */
	spin: Vector3d;
	turn: Vector3d;
	/** world units per second */
	drift: Vector3d;
}

export class TitleScreen extends Stage {
	/**
	 * This screen's camera, narrowed ONCE on reset.
	 *
	 * `app.viewport` is the active stage's camera and so is typed `Camera2d`,
	 * since a stage can override the application's `cameraClass` and the
	 * built-in loader does. `instanceof` is the narrowing the language
	 * verifies, where `as` is merely believed.
	 *
	 * NOT an owned camera passed through `super({ cameras: [...] })`, which
	 * is the other sound pattern: that one lives for the application rather
	 * than for the stage, and this game adds post effects to its viewport
	 * and never removes them (`removePostEffect` destroys the effect, so the
	 * code toggles `enabled` instead). A camera that outlived the stage
	 * therefore collected another copy of every effect on each visit, which
	 * showed up as the menu text ghosting.
	 */
	private camera3d!: Camera3d;
	private rocks: TitleRock[] = [];
	private ufoParts: Mesh[] = [];
	private ufoMs = 0;
	/**
	 * The saucer's position along its patrol, driven by a yoyo tween rather
	 * than by hand. `lastX` is what the bank is read from: the sign of the
	 * step IS the direction of travel, and because the tween eases in and out
	 * the step passes smoothly through zero at each end, so the lean rolls
	 * over instead of snapping.
	 */
	private ufoDrive = { x: -UFO_SPAN };
	private ufoLastX = -UFO_SPAN;
	/** +1 travelling right, -1 travelling left; held through a stalled frame */
	private ufoHeading = 1;
	/** the lean actually applied, damped towards the heading */
	private ufoLean = UFO_BANK;
	private ufoTween: Tween | undefined;
	private started = false;
	private items: MenuItem[] = [];
	private cursor = 0;
	private modal: Modal | undefined;
	/**
	 * The settings card, while it is open.
	 *
	 * Separate from {@link TitleScreen#modal} rather than sharing it: a modal
	 * is a slab of text that any key dismisses, and this one has rows to move
	 * between, so the two cannot share the menu's input gate.
	 *
	 * NOT `settings`, which `Stage` already owns.
	 */
	private settingsPanel: SettingsPanel | undefined;
	/** the rocks that illustrate the instructions, while that panel is up */
	private modalRocks: TitleRock[] = [];
	/**
	 * Which menu keys were down last frame.
	 *
	 * The menu needs an EDGE — one step per press — and the actions it shares
	 * with the game (`boost` for up, `fire` for select) are bound without the
	 * lock, because the game wants them to repeat while held. Rather than
	 * rebind them here and have to restore them, the edge is taken here.
	 */
	private wasDown: Record<string, boolean> = {};
	/** `Stage` does not keep the application it was reset with, and the menu
	 * needs it to raise a panel after the build has finished */
	private app: Application | undefined;

	/**
	 * Build the title.
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
		this.started = false;
		this.rocks = [];
		this.ufoParts = [];
		this.ufoMs = 0;
		this.items = [];
		this.cursor = 0;
		this.modal = undefined;
		this.settingsPanel = undefined;
		this.modalRocks = [];
		// Seeded from the keys that are ALREADY down, not emptied.
		//
		// `pressed` below reports an edge when a key is down and was not down
		// last frame, and an empty map says every key was up. Arriving here
		// with one held therefore read as a fresh press on the first frame:
		// a player who held space to leave a finished run was bounced
		// straight back into a new game, 600ms after asking to leave. Keys
		// held across the switch have to be released before they count.
		this.wasDown = {};
		this.seedHeld();
		this.app = app;
		this.ufoDrive.x = -UFO_SPAN;
		this.ufoLastX = -UFO_SPAN;
		this.ufoHeading = 1;
		this.ufoLean = UFO_BANK;

		app.world.backgroundColor.parseCSS("#05060f");

		// The same camera pose the game uses, minus the sphere: looking down
		// +Z with +Y down the screen, so a world position reads as a screen
		// position and the models below can be placed by eye.
		const camera = this.camera3d;
		camera.setBasis(
			new Vector3d(1, 0, 0),
			new Vector3d(0, 1, 0),
			new Vector3d(0, 0, 1),
		);
		camera.setPosition(0, 0, 0);
		// `Camera3d` clips at 1000 by default, and this screen puts the rocks
		// past 2000 and the nebula at nine times that. Set from here, not at
		// boot: a stage change resets the camera, so clip planes written
		// before `state.change` are quietly restored.
		camera.setClipPlanes(1, SKY_Z + 8000);

		// a sun over the viewer's shoulder, so the rocks have a lit side and a
		// dark one and read as solid rather than as flat cutouts
		app.world.addChild(
			new Light3d({
				type: "directional",
				direction: new Vector3d(-0.45, 0.6, 0.65),
				color: new Color().parseCSS(SUN_COLOR),
				intensity: 0.95,
			}),
		);
		app.world.addChild(
			new Light3d({
				type: "ambient",
				color: new Color().parseCSS(FILL_COLOR),
				intensity: 0.3,
			}),
		);

		// The menu's bed, which `playTrack` loops by default and which
		// replaces whatever the last screen was playing. Safe on every
		// entry: coming back from a run, it takes the floor from the battle
		// bed rather than layering over it.
		audio.playTrack(MENU_MUSIC, MENU_MUSIC_VOLUME);

		this.addSky(app);
		this.addRocks(app);
		this.addUfo(app);
		this.addText(app);

		// The same bloom the game runs, so the title's hot top edge actually
		// bleeds instead of just being bright. Added here and not at boot for
		// the usual reason: a stage instantiates its own camera on first
		// reset, so an effect hung on the viewport earlier is attached to a
		// camera that is no longer the one being drawn through.
		app.viewport.addPostEffect(
			new BloomEffect(app.renderer, {
				threshold: BLOOM_THRESHOLD,
				intensity: BLOOM_INTENSITY,
				radius: BLOOM_RADIUS,
			}),
		);
	}

	/** the same generated nebula the game flies in front of */
	private addSky(app: Application) {
		const cloud = new Sprite3d(0, 0, {
			image: nebulaSky("far"),
			width: NEBULA_SPAN,
			height: NEBULA_SPAN,
			billboard: "spherical",
			transparent: true,
			alphaCutoff: 0,
		});
		cloud.depth = SKY_Z;
		cloud.setOpacity(NEBULA_ALPHA);
		cloud.blendMode = "additive";
		app.world.addChild(cloud, cloud.depth);
	}

	/**
	 * A handful of rocks, tumbling.
	 *
	 * They DO tumble here, unlike the ones in the game: nothing in a title
	 * screen stands on a surface, so there is no frame to keep them upright
	 * against and a free rotation is simply what a rock in open space does.
	 * @param app - the application
	 */
	private addRocks(app: Application) {
		const data = loader.getGLTF(ROCK_MODEL);
		if (!data) {
			return;
		}
		for (let i = 0; i < 7; i++) {
			const node = data.nodes[i % data.nodes.length];
			const size = math.randomFloat(46, 84);
			const mesh = new Mesh(0, 0, {
				vertices: node.vertices,
				uvs: node.uvs,
				normals: node.normals,
				indices: node.indices,
				normalize: false,
				scale: size,
				width: size * 2,
				height: size * 2,
				lit: true,
				rightHanded: true,
				// the same colour map and relief the game's rocks wear, so
				// the title is showing the actual asset rather than a
				// stand-in with the same silhouette
				texture: ROCK_ALBEDO,
				normalMap: ROCK_NORMAL,
				specular: ROCK_SPECULAR,
				shininess: ROCK_SHININESS,
				// the material's own base colour, encoded from the
				// loader's LINEAR factor by the engine
				baseColorFactor: node.baseColorFactor,
			});
			// Far enough back to read as distant debris. The middle of this
			// screen is words, and the surest way to keep a drifting rock
			// from making them hard to read is for it to be small: at this
			// depth one is a chip of light rather than a boulder laid over a
			// sentence.
			const depth = math.randomFloat(3400, 5600);
			const edge = i % 2 === 0 ? -1 : 1;
			app.world.addChild(mesh, depth);
			mesh.setPosition(
				edge * math.randomFloat(400, 2400),
				math.randomFloat(-1100, 1100),
				depth,
			);
			this.rocks.push({
				mesh,
				spin: new Vector3d(
					math.randomFloat(-0.4, 0.4),
					math.randomFloat(-0.4, 0.4),
					math.randomFloat(-0.4, 0.4),
				),
				turn: new Vector3d(0, 0, 0),
				drift: new Vector3d(
					math.randomFloat(-22, 22),
					math.randomFloat(-12, 12),
					0,
				),
			});
		}
	}

	/** the saucer, one mesh per material, crossing the frame on a long arc */
	private addUfo(app: Application) {
		const data = loader.getGLTF(UFO_MODEL);
		if (!data) {
			return;
		}
		for (const node of data.nodes) {
			const mesh = new Mesh(0, 0, {
				vertices: node.vertices,
				uvs: node.uvs,
				normals: node.normals,
				indices: node.indices,
				normalize: false,
				scale: 120,
				width: 240,
				height: 240,
				lit: true,
				rightHanded: true,
				// the model's own holes read as seams from behind, and at this
				// size nothing is close enough for the saving to matter
				cullBackFaces: false,
				// the material's own base colour, encoded from the
				// loader's LINEAR factor by the engine
				baseColorFactor: node.baseColorFactor,
			});
			if (node.emissive) {
				mesh.emissive = new Float32Array(node.emissive);
			}
			app.world.addChild(mesh, TITLE_Z - 420);
			this.ufoParts.push(mesh);
		}

		// The patrol. A yoyo repeat rather than a modulo of elapsed time: the
		// saucer never leaves, so there is no off-screen wait to schedule, and
		// the turn at each end is the tween reversing rather than a wrap from
		// one edge to the other.
		//
		// Eased, and that is the part doing the work. A linear yoyo reverses
		// at full speed and reads as the saucer hitting a wall; easing in and
		// out brings it to rest at the edge, turns it over, and takes it back
		// the other way.
		this.ufoTween = new Tween(this.ufoDrive)
			.to(
				{ x: UFO_SPAN },
				{
					duration: UFO_CROSS_MS,
					easing: Tween.Easing.Quadratic.InOut,
					yoyo: true,
					repeat: Number.POSITIVE_INFINITY,
				},
			)
			.start();
	}

	/**
	 * One step per press.
	 *
	 * `isKeyPressed` reports a key as pressed for as long as it is HELD unless
	 * it was bound with the lock, and the two actions the menu shares with the
	 * game — `boost` for up, `fire` for select — are deliberately unlocked
	 * there so they repeat while flying. Taking the edge here means the menu
	 * does not have to rebind them and restore them on the way out.
	 * @param action - the bound action name
	 * @returns true on the frame the key goes down
	 */
	private pressed(action: string): boolean {
		const down = input.isKeyPressed(action);
		const edge = down && this.wasDown[action] !== true;
		this.wasDown[action] = down;
		return edge;
	}

	/** move the cursor, open a panel, close one, or start the game */
	private readMenuKeys() {
		// Every action is sampled every frame, open panel or not: `pressed`
		// is edge-triggered off the previous frame, so skipping a read would
		// leave a key looking freshly pressed the moment the panel closes.
		const up = this.pressed("boost");
		const down = this.pressed("menuDown");
		const select = this.pressed("fire") || this.pressed("menuSelect");
		const back = this.pressed("menuBack");

		if (this.modal !== undefined) {
			if (back || select) {
				this.closeModal();
			}
			return;
		}
		// The settings card runs its own cursor off the same actions, so the
		// menu underneath has to stay out of the way entirely while it is up.
		if (this.settingsPanel !== undefined) {
			return;
		}
		if (up) {
			this.moveTo(this.cursor - 1);
		}
		if (down) {
			this.moveTo(this.cursor + 1);
		}
		if (select) {
			this.choose(this.cursor);
		}
	}

	/**
	 * Stop the patrol with the screen.
	 *
	 * A tween subscribes to the game loop on `start()` and nothing here owns
	 * it otherwise, so leaving it running would keep writing into this
	 * stage's driver long after the title is gone.
	 * @ignore
	 */
	override onDestroyEvent() {
		this.ufoTween?.stop();
		this.ufoTween = undefined;
		// Not for the game, which replaces this track by starting its own,
		// but for leaving the example from the title: nothing follows then
		// to take the floor.
		audio.stopTrack();
	}

	/** the title and its tagline; the rest is in the menu */
	private addText(app: Application) {
		const w = app.renderer.width;

		// WHY FLAT LETTERS READ AS SOLID ONES.
		//
		// Nothing here is 3D: it is one `Text` over another, both flat. The
		// depth is two tricks, and the ramp is the bigger of them.
		//
		// A vertical luminance ramp down a letterform is what a light does to
		// a rounded, extruded face — a hot line along the top edge where it
		// catches, the body colour across the middle, the underside falling
		// into shadow — so the eye reads a bevel that was never modelled. The
		// four stops below are that in order: white, pale cyan, mid blue, and
		// a near-black navy at the foot. Flatten it to a single colour and
		// the whole effect goes; it is the GRADIENT doing the work, not the
		// font.
		//
		// `Text.fillStyle` takes a `Gradient`, and its coordinates are the
		// label's OWN bake rather than the screen's, so the ramp runs down
		// every glyph wherever the label sits. That is what makes it one
		// gradient instead of per-letter work.
		//
		// Additive so the white end blows out against the nebula rather than
		// blending into it. Note there is no bloom on THIS stage — the
		// viewport effect belongs to `PlayScreen` — so the top edge is doing
		// its own work here.
		const ramp = app.renderer.createLinearGradient(0, 0, 0, 92);
		ramp.addColorStop(0, "#ffffff");
		ramp.addColorStop(0.3, "#9fe8ff");
		ramp.addColorStop(0.62, "#2f9bd8");
		ramp.addColorStop(1, "#0b1b33");

		// a dark pass behind the bright one, offset down: cheap, and it is
		// what stops the letters dissolving into the nebula behind them
		const shadow = new Text(w / 2 + 4, 96 + 5, {
			font: HUD_FONT,
			size: 92,
			fillStyle: "#030611",
			textAlign: "center",
			textBaseline: "top",
			text: "EARTH DEFENDER",
		});
		shadow.floating = true;
		shadow.setOpacity(0.85);
		app.world.addChild(shadow, 9000);

		const title = new Text(w / 2, 96, {
			font: HUD_FONT,
			size: 92,
			fillStyle: ramp,
			textAlign: "center",
			textBaseline: "top",
			text: "EARTH DEFENDER",
		});
		title.floating = true;
		title.blendMode = "additive";
		app.world.addChild(title, 9001);

		const line = (
			y: number,
			size: number,
			color: string,
			text: string,
			alpha = 1,
		) => {
			const label = new Text(w / 2, y, {
				font: HUD_FONT,
				size,
				fillStyle: color,
				textAlign: "center",
				textBaseline: "top",
				text,
			});
			label.floating = true;
			label.setOpacity(alpha);
			app.world.addChild(label, 9001);
			return label;
		};

		line(
			196,
			20,
			"#7fe9ff",
			"HOLD THE DOME. SHOOT THE ROCKS. SHOOT THE BOMBS.",
			0.9,
		);

		// The controls and the credits now live behind the menu. They used to
		// be printed here, which left no room for it; a credits PANEL also has
		// space to name the engine and to spell the licences out, where the
		// two lines that fitted down here could not.
		this.addMenu(app);
		this.addBest(app, line);
		this.addVersion(app);
	}

	/**
	 * What this is, in the corner, for anyone reporting a problem with it.
	 *
	 * The game's version, and nothing else.
	 *
	 * It carried the engine's too, and then a build sha, and neither earned
	 * the space. The example depends on `melonjs` as `workspace:^`, so it is
	 * always built against the engine in the same commit and a sha states the
	 * engine version already; and the site publishes from master on every
	 * push, so the deployed page IS the latest commit unless something is
	 * serving a stale copy. That leaves one number a player might quote, and
	 * eight hex characters that mean nothing to the person actually looking
	 * at this corner.
	 *
	 * Bottom LEFT, away from the best score in the middle and small enough to
	 * read as a stamp rather than as something the player is meant to do.
	 * @param app - the application
	 */
	private addVersion(app: Application): void {
		const label = new Text(14, app.renderer.height - 22, {
			font: HUD_FONT,
			size: 13,
			fillStyle: VERSION_COLOR,
			textAlign: "left",
			textBaseline: "top",
			text: `v${GAME_VERSION}`,
		});
		label.floating = true;
		label.setOpacity(0.55);
		app.world.addChild(label, 9001);
	}

	/**
	 * The best score so far, under the menu.
	 *
	 * Read through the same `save` key the game writes, so it survives a
	 * reload: `save.add` loads what localStorage already holds and only
	 * falls back to the default when the key has never been written. It is
	 * therefore the live number, not a copy the title has to be told about.
	 *
	 * Nothing at all until there IS one. A run of zeroes on the front page
	 * of a game nobody has played yet is noise, and the first score the
	 * player sets is a better moment for the line to appear.
	 * @param app - the application
	 * @param line - the title's own label factory
	 */
	private addBest(
		app: Application,
		line: (
			y: number,
			size: number,
			color: string,
			text: string,
			alpha?: number,
		) => Text,
	): void {
		const best = save.add({ [BEST_SAVE_KEY]: 0 })[BEST_SAVE_KEY];
		if (best <= 0) {
			return;
		}
		line(
			// well clear of CREDITS: any closer and it reads as a fourth
			// entry rather than as a record standing under the menu
			app.renderer.height - 56,
			18,
			BEST_COLOR,
			`BEST ${String(best).padStart(6, "0")}`,
			0.85,
		);
	}

	/**
	 * The menu.
	 *
	 * Entries are {@link UIBaseElement}s, so the pointer works for free; the
	 * cursor below is what the arrow keys move, and hovering an entry moves it
	 * there too, so the two can never disagree.
	 * @param app - the application
	 */
	private addMenu(app: Application) {
		const w = app.renderer.width;
		const h = app.renderer.height;
		// Clear of the best-score line below it, and of the saucer's band
		// above. Raised a step when SETTINGS made it four entries: at the old
		// start the fourth row sat on top of the best score.
		const top = h - 300;
		const labels = ["NEW GAME", "SETTINGS", "INSTRUCTIONS", "CREDITS"];
		labels.forEach((text, i) => {
			const item = new MenuItem(
				i,
				w / 2,
				top + i * ITEM_STEP,
				text,
				(index) => {
					this.choose(index);
				},
				(index) => {
					this.moveTo(index);
				},
			);
			app.world.addChild(item, 9002);
			this.items.push(item);
		});
		this.moveTo(0);
	}

	/** put the cursor on an entry */
	private moveTo(index: number) {
		this.cursor = (index + this.items.length) % this.items.length;
		this.items.forEach((item, i) => {
			item.selected = i === this.cursor;
		});
	}

	/** act on the entry under the cursor */
	private choose(index: number) {
		// Both panels, not just the modal. `choose` is reached from an
		// entry's own click callback, which does NOT go through the input
		// gate in `update`, so a guard there is no guard here.
		if (this.modal !== undefined || this.settingsPanel !== undefined) {
			return;
		}
		this.moveTo(index);
		if (index === 0) {
			this.begin();
			return;
		}
		if (index === 1) {
			this.openSettings();
			return;
		}
		const [title, lines] =
			index === 2 ? ["INSTRUCTIONS", INSTRUCTIONS] : ["CREDITS", CREDITS];
		this.openModal(title as string, lines as string[]);
	}

	/**
	 * Treat every menu key that is CURRENTLY held as already seen.
	 *
	 * Used twice, and the second use is the one that is easy to miss. On the
	 * way in it stops a key held from the previous screen reading as a fresh
	 * press here. On the way OUT of a panel it stops the press that closed
	 * the panel reading as a press on the menu underneath: the panel's own
	 * BACK row is taken with the same button that opens things, and on the
	 * frame the panel goes away this screen is live again with the cursor
	 * still sitting on the entry that opened it. Without this the panel shut
	 * and reopened in the same frame, which looks exactly like a button that
	 * does nothing.
	 */
	private seedHeld() {
		for (const action of [
			"fire",
			"menuSelect",
			"menuDown",
			"menuBack",
			"boost",
		]) {
			this.wasDown[action] = input.isKeyPressed(action);
		}
	}

	/**
	 * Let the menu entries take pointer events, or stop them.
	 *
	 * Stopping them is not belt and braces on top of the guard in `choose`,
	 * it is the half that makes the panels WORK. A panel is centred and the
	 * menu sits under it, so a row near the top of a card shares its pixels
	 * with an entry: the settings card's SOUND row lies across NEW GAME. The
	 * dispatcher asks one candidate at a time and stops at the first that
	 * consumes, and a `MenuItem` always consumes, so whichever it asked first
	 * won. A guard alone turns that into a dead click rather than a wrong
	 * one. `isKinematic` is what the dispatcher skips on, so the entries stop
	 * being candidates at all and the click reaches the card.
	 * @param enabled - true to let the entries be clicked
	 */
	private setMenuPointer(enabled: boolean) {
		for (const item of this.items) {
			item.isKinematic = !enabled;
		}
	}

	/** raise the settings card over the menu */
	private openSettings() {
		const app = this.app;
		if (app === undefined) {
			return;
		}
		const panel = new SettingsPanel(app, {
			isFullscreen: () => app.isFullscreen(),
			toggleFullscreen: () => {
				if (app.isFullscreen()) {
					app.exitFullscreen();
				} else {
					app.requestFullscreen();
				}
			},
			isAudioOn: () => !audio.muted(),
			toggleAudio: () => {
				if (audio.muted()) {
					audio.unmuteAll();
				} else {
					audio.muteAll();
				}
			},
			close: () => {
				this.closeSettings();
			},
		});
		// the same depth the modals use, and for the same reason
		this.setMenuPointer(false);
		panel.open(app, 200);
		this.settingsPanel = panel;
	}

	/** take the settings card away */
	private closeSettings() {
		const app = this.app;
		if (app === undefined || this.settingsPanel === undefined) {
			return;
		}
		this.settingsPanel.close(app);
		this.settingsPanel = undefined;
		this.setMenuPointer(true);
		this.seedHeld();
	}

	/** raise a panel over the menu */
	private openModal(title: string, lines: string[]) {
		const app = this.app;
		if (app === undefined) {
			return;
		}
		const modal = new Modal(
			app.renderer.width / 2,
			app.renderer.height / 2,
			title,
			lines,
			() => {
				this.closeModal();
			},
			// which lines have to leave room for a rock. The panel is told
			// rather than left to find out, because only this screen knows
			// it is about to hang something off them.
			lines === INSTRUCTIONS ? INSTRUCTION_ROCKS.map((r) => r.line) : [],
		);
		// NEARER than the menu and the title, which is what puts it in front:
		// `Container._sortZ` sorts DESCENDING (`b.pos.z - a.pos.z`), so the
		// biggest z is drawn first and ends up at the back. That reads
		// backwards until you remember this is a 3D scene and z is distance
		// from the camera. The saucer is the nearest thing at `TITLE_Z - 420`,
		// so this clears it.
		this.setMenuPointer(false);
		app.world.addChild(modal, 200);
		this.modal = modal;
		if (title === "INSTRUCTIONS") {
			this.addModalRocks(app, modal);
		}
	}

	/**
	 * A real rock beside each line that talks about one.
	 *
	 * Meshes in the WORLD rather than children of the panel: a rock is 3D and
	 * has to turn, while the panel is a flat screen-space container. They are
	 * placed by mapping the panel's own screen coordinates into the world at
	 * the depth they sit at, which is the only arithmetic here — `lineAt`
	 * owns where the lines are.
	 * @param app - the application
	 * @param modal - the panel to sit beside
	 */
	private addModalRocks(app: Application, modal: Modal) {
		const data = loader.getGLTF(ROCK_MODEL);
		if (!data) {
			return;
		}
		const camera = this.camera3d;
		// MEASURED through the camera, not derived from a remembered figure.
		// A world-per-pixel worked out by hand needs the fov and the aspect
		// to be what you think they are, and mine were not: the rocks landed
		// a third of the way off. Projecting two known points and reading
		// back the gap cannot be wrong about the projection it just used.
		const origin = camera.worldToScreen(
			new Vector3d(0, 0, MODAL_ROCK_Z),
			_probeA,
		);
		const unit = camera.worldToScreen(
			new Vector3d(100, 0, MODAL_ROCK_Z),
			_probeB,
		);
		if (origin === null || unit === null || unit.x === origin.x) {
			return;
		}
		const perPixel = 100 / (unit.x - origin.x);
		INSTRUCTION_ROCKS.forEach(({ line, kind }, i) => {
			const node = data.nodes[i % data.nodes.length];
			const size = MODAL_ROCK_PX * perPixel;
			const mesh = new Mesh(0, 0, {
				vertices: node.vertices,
				uvs: node.uvs,
				normals: node.normals,
				indices: node.indices,
				normalize: false,
				scale: size,
				width: size * 2,
				height: size * 2,
				lit: true,
				rightHanded: true,
				texture: ROCK_ALBEDO,
				normalMap: ROCK_NORMAL,
				specular: ROCK_SPECULAR,
				shininess: ROCK_SHININESS,
			});
			// the colours the game gives them, so the panel shows the actual
			// thing rather than a grey stand-in
			if (kind === "ice") {
				mesh.tint.setHSL(ICE_HUE, ICE_SATURATION, ICE_LIGHTNESS);
			} else {
				mesh.tint.setHSL(BONUS_HUE, BONUS_SATURATION, BONUS_LIGHTNESS);
			}
			const at = modal.lineAt(line);
			app.world.addChild(mesh, MODAL_ROCK_Z);
			mesh.setPosition(
				(at.left - MODAL_ROCK_GAP - origin.x) * perPixel,
				(at.middle - origin.y) * perPixel,
				MODAL_ROCK_Z,
			);
			this.modalRocks.push({
				mesh,
				spin: new Vector3d(0.5, 0.8, 0.3),
				turn: new Vector3d(0, 0, 0),
				drift: new Vector3d(0, 0, 0),
			});
		});
	}

	/** take it down again */
	private closeModal() {
		if (this.modal === undefined) {
			return;
		}
		for (const rock of this.modalRocks) {
			this.app?.world.removeChild(rock.mesh);
		}
		this.modalRocks = [];
		// through the world rather than `ancestor`, which is typed
		// `Container | Entity` and an `Entity` has no `removeChild`
		this.app?.world.removeChild(this.modal);
		this.modal = undefined;
		this.setMenuPointer(true);
		this.seedHeld();
	}

	/** leave for the game, once */
	private begin() {
		if (this.started) {
			return;
		}
		this.started = true;
		state.change(state.PLAY);
	}

	/**
	 * Drift the rocks, fly the saucer, read the menu.
	 * @param dt - milliseconds since the last frame
	 * @returns always true: something on this screen is always moving
	 */
	override update(dt: number) {
		super.update(dt);
		const dts = dt / 1000;

		for (const r of this.rocks) {
			r.turn.x += r.spin.x * dts;
			r.turn.y += r.spin.y * dts;
			r.turn.z += r.spin.z * dts;
			const t = r.mesh.currentTransform;
			t.identity();
			t.rotate(r.turn.x, AXIS_X);
			t.rotate(r.turn.y, AXIS_Y);
			t.rotate(r.turn.z, AXIS_Z);
			// wrap rather than respawn: the frame is wider than the spread, so
			// a rock that leaves one side is wanted back on the other
			let x = r.mesh.pos.x + r.drift.x * dts;
			let y = r.mesh.pos.y + r.drift.y * dts;
			if (x > 2500) x = -2500;
			if (x < -2500) x = 2500;
			if (y > 1150) y = -1150;
			if (y < -1150) y = 1150;
			r.mesh.setPosition(x, y, r.mesh.depth);
		}

		// the instruction panel's rocks, turning in place
		for (const r of this.modalRocks) {
			r.turn.x += r.spin.x * dts;
			r.turn.y += r.spin.y * dts;
			r.turn.z += r.spin.z * dts;
			const t = r.mesh.currentTransform;
			t.identity();
			t.rotate(r.turn.x, AXIS_X);
			t.rotate(r.turn.y, AXIS_Y);
			t.rotate(r.turn.z, AXIS_Z);
		}

		this.ufoMs += dt;
		const x = this.ufoDrive.x;
		// WHICH WAY it is going, not how fast.
		//
		// The lean used to be the step divided by the frame's `dt`, and that
		// wobbled: a tween advances on its own tick and does NOT move on
		// every frame. Measured here, the steps run
		// `-3.9, 0, -7.6, -4.1, -3.9` — one frame skipped and the next taking
		// a double step — so the quotient alternated between 0 and twice
		// nominal, and the saucer snapped between level and hard over.
		//
		// A stalled frame is not a change of direction, so the heading is
		// held through one, and the lean is DAMPED towards it rather than
		// recomputed from scratch. That also gives the roll-over at each end
		// for free: the heading flips, and the lean takes a moment to follow.
		const step = x - this.ufoLastX;
		if (Math.abs(step) > UFO_STEP_EPS) {
			this.ufoHeading = step > 0 ? 1 : -1;
		}
		this.ufoLastX = x;
		this.ufoLean = math.damp(
			this.ufoLean,
			this.ufoHeading * UFO_BANK,
			UFO_BANK_DAMP,
			dt,
		);
		// A shallow bow through the OPEN BAND between the tagline and the
		// controls, highest at mid-screen and level at both ends. Written
		// against x rather than against time so it retraces itself exactly on
		// the way back, which a yoyo demands.
		const y = UFO_Y - UFO_ARC * Math.cos((x / UFO_SPAN) * (Math.PI / 2));
		for (const part of this.ufoParts) {
			part.setPosition(x, y, TITLE_Z - 420);
			const tr = part.currentTransform;
			tr.identity();
			// Outermost, so it is a lean in SCREEN space: these POST-multiply,
			// so the call made last reaches the vertex first, and the bank has
			// to be written first to be applied last.
			tr.rotate(this.ufoLean, AXIS_Z);
			// tilted towards the viewer, and turning slowly on its own axis
			// the way it does in the game
			tr.rotate(0.35, AXIS_X);
			tr.rotate(this.ufoMs * 0.0011, AXIS_Y);
		}

		this.readMenuKeys();
		return true;
	}
}
