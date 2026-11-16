/**
 * melonJS — Starsweep: the play screen.
 *
 * A `Stage` that builds the board's containers, loads each level's Tiled
 * map into one of them, and hosts the playing field (`game/Field.ts`).
 * Drawn in the two layers of `layers.ts`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	type Camera3d,
	Container,
	level,
	type Renderable,
	Stage,
	state,
	type TMXLayer,
} from "melonjs";
import { HEIGHT, OX, OY, WIDTH } from "../config/layout";
import { Bolt } from "../entities/Bolt";
import type { DeepSpace } from "../fx/DeepSpace";
import { Effects } from "../fx/Effects";
import { SpaceBackdrop } from "../fx/SpaceBackdrop";
import { Field } from "../game/Field";
import { controls } from "../input/Controls";
import type { LevelDef } from "../rules/levels";
import { setUpLayers, withSpaceCamera } from "./layers";

/** The play screen: the board, the characters, and the field that runs them. */
export class PlayScreen extends Stage {
	private field: Field | null = null;
	/** what this screen put in the world and must take out again */
	private kept: Renderable[] = [];
	private effects: Effects | null = null;
	private deep: DeepSpace | null = null;
	private readonly space: Camera3d | null;

	/**
	 * @param levels - the levels, in play order
	 */
	constructor(private readonly levels: readonly LevelDef[]) {
		const { camera, settings } = withSpaceCamera();
		super(settings);
		this.space = camera;
	}

	override onResetEvent(app: Application) {
		app.reset();
		const world = app.world;
		const { game, sky, deep } = setUpLayers(app, this.space);
		this.deep = deep;
		// `level.load` empties the world of everything not persistent: keep
		// what this screen added, and take it out again when leaving
		for (const child of world.getChildren()) {
			const kept = child as Renderable;
			kept.isPersistent = true;
			this.kept.push(kept);
		}
		// the planet, and the whole sky when there is no shader for it
		const backdrop = new SpaceBackdrop(WIDTH, HEIGHT, sky === null, {
			x: WIDTH - 40,
			y: OY + 70,
		});
		// each level's Tiled map is loaded into this container, at the board's place
		const board = new Container(OX, OY, WIDTH, HEIGHT);
		board.name = "board";
		// Bolt and the monsters, over the board
		const actors = new Container(0, 0, WIDTH, HEIGHT);
		game.addChild(backdrop, -1);
		game.addChild(board, 0);
		game.addChild(actors, 2);
		this.effects = new Effects(game, 3);

		const field = new Field(
			{
				controls,
				effects: this.effects,
				actors,
				backdrop,
				sky,
				space: deep,
				loadBoard: async (file) => {
					await level.load(file, {
						container: board,
						setViewportBounds: false,
						async: true,
					});
					const layer = (name: string) =>
						board.getChildByName(name)[0] as unknown as TMXLayer;
					return {
						layers: { station: layer("station"), power: layer("power") },
						// built from the map's `Bolt` object (see objects.ts)
						bolt: board.getChildByType(Bolt)[0] as Bolt,
					};
				},
			},
			this.levels,
		);
		field.onExit = () => state.change(state.MENU);
		game.addChild(field, 1);
		game.addChild(field.front, 4);
		for (const item of field.hudItems) {
			game.addChild(item, 10);
		}
		this.field = field;
		controls.attach(true);
		field.newGame();
	}

	/** the world pauses with the game, but a stage keeps updating: pause here */
	override update(dt: number) {
		if (
			controls.pause() &&
			(state.isPaused() || this.field?.canPause === true)
		) {
			if (state.isPaused()) {
				state.resume();
			} else {
				state.pause();
			}
		}
		return super.update(dt);
	}

	override onDestroyEvent(app: Application) {
		if (state.isPaused()) {
			state.resume();
		}
		this.effects?.destroy();
		this.deep?.destroy();
		this.deep = null;
		for (const r of this.kept) {
			if (r.ancestor) {
				app.world.removeChild(r);
			}
		}
		this.kept = [];
		this.effects = null;
		this.field = null;
	}
}
