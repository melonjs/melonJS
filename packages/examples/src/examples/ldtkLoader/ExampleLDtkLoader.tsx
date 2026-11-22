/**
 * melonJS — LDtk level loader example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Application,
	event,
	game,
	input,
	LDtkEntity,
	type LDtkLevel,
	type LDtkWorld,
	level,
	loader,
	type Pointer,
	Renderable,
	type Renderer,
	state,
} from "melonjs";
import { useEffect, useState } from "react";
import { createExampleComponent } from "../utils";
import { resources, samples } from "./resources";

/**
 * The entities of what is loaded, outlined in the color LDtk shows each in.
 * No class is registered for them here, so each is a plain box
 * (`LDtkEntity`) carrying its fields, drawn with its tile when it has one: a
 * game registers its own classes with `registerObjectClass("Player", Player)`.
 */
class EntityOutlines extends Renderable {
	entities: Renderable[];

	constructor(
		entities: Renderable[],
		x: number,
		y: number,
		width: number,
		height: number,
	) {
		super(x, y, width, height);
		this.anchorPoint.set(0, 0);
		this.entities = entities;
	}

	override draw(renderer: Renderer) {
		renderer.lineWidth = 1;
		for (const entity of this.entities) {
			if (entity instanceof LDtkEntity) {
				renderer.setColor(entity.source.color ?? "#ffffff");
				renderer.strokeRect(
					entity.pos.x + 0.5,
					entity.pos.y + 0.5,
					entity.width - 1,
					entity.height - 1,
				);
			}
		}
	}
}

/** what the selectors show of the level or world on screen */
type Info = { size: string; layers: number; entities: number };
let report: (info: Info) => void = () => {};

/**
 * Load a level of a project, or its whole world.
 * A level's id is the project's name and the level's identifier; the world's
 * is the project's name alone.
 */
const loadLevel = (id: string) => {
	level.load(id, {
		container: game.world,
		// IntGrid layers with no tiles of their own are drawn in LDtk's
		// colors here, to show the samples that are nothing else
		showIntGrid: true,
		onLoaded: () => {
			const loaded = level.getCurrentLevel() as unknown as
				| LDtkLevel
				| LDtkWorld;
			const entities = loaded.getEntities();
			// a world keeps LDtk's coordinates: it can start left of or above 0
			const x = "x" in loaded ? loaded.x : 0;
			const y = "y" in loaded ? loaded.y : 0;
			game.world.addChild(
				new EntityOutlines(entities, x, y, loaded.width, loaded.height),
				Number.MAX_SAFE_INTEGER,
			);
			// a world is entered at its first level
			const first =
				"info" in loaded && "levels" in loaded.info
					? loaded.info.levels[0]
					: undefined;
			game.viewport.moveTo(first?.x ?? 0, first?.y ?? 0);
			report({
				size: `${loaded.width} x ${loaded.height}`,
				layers: loaded.layers.length,
				entities: entities.length,
			});
			game.repaint();
		},
	});
};

const STEP = 16;

const onKeyPressed = (_action: unknown, keyCode: number) => {
	if (keyCode === input.KEY.LEFT) {
		game.viewport.move(-STEP, 0);
	}
	if (keyCode === input.KEY.RIGHT) {
		game.viewport.move(STEP, 0);
	}
	if (keyCode === input.KEY.UP) {
		game.viewport.move(0, -STEP);
	}
	if (keyCode === input.KEY.DOWN) {
		game.viewport.move(0, STEP);
	}
	game.repaint();
};

const onScroll = (ev: Pointer) => {
	game.viewport.move(Math.sign(ev.deltaX) * STEP, Math.sign(ev.deltaY) * STEP);
	game.repaint();
};

// dragging moves the view
let dragFrom: { x: number; y: number } | undefined;
const onDragStart = (ev: Pointer) => {
	dragFrom = { x: ev.gameScreenX, y: ev.gameScreenY };
};
const onDrag = (ev: Pointer) => {
	if (dragFrom !== undefined) {
		game.viewport.move(
			dragFrom.x - ev.gameScreenX,
			dragFrom.y - ev.gameScreenY,
		);
		dragFrom = { x: ev.gameScreenX, y: ev.gameScreenY };
		game.repaint();
	}
};
const onDragEnd = () => {
	dragFrom = undefined;
};

const createGame = async () => {
	// pixel art: a small view, scaled up to the page with its pixels sharp
	const app = new Application(640, 480, {
		parent: "screen",
		scale: "auto",
		antiAlias: false,
	});
	await app.init();

	// an LDtk project is an asset of type "ldtk", and each of its levels a
	// level of the level director: nothing to register
	loader.preload(resources, () => {
		event.on(event.KEYDOWN, onKeyPressed);
		input.registerPointerEvent("wheel", game.viewport, onScroll);
		input.registerPointerEvent("pointerdown", game.viewport, onDragStart);
		input.registerPointerEvent("pointermove", game.viewport, onDrag);
		input.registerPointerEvent("pointerup", game.viewport, onDragEnd);
		input.registerPointerEvent("pointercancel", game.viewport, onDragEnd);
		state.change(state.DEFAULT, true);
		loadLevel(`${samples[0].name}:${levelsOf(samples[0].name)[0]}`);
	});
};

/** the identifiers of a project's levels, once it is loaded */
const levelsOf = (name: string) => {
	return (
		loader.getLDtk(name)?.levels.map((info) => {
			return info.identifier;
		}) ?? []
	);
};

const selectStyle = {
	padding: "6px 12px",
	fontSize: 14,
	background: "#1a1a1a",
	color: "#e0e0e0",
	border: "1px solid #444",
	borderRadius: 4,
};

const Selectors = () => {
	const [sample, setSample] = useState(samples[0].name);
	const [levels, setLevels] = useState<string[]>([]);
	const [selected, setSelected] = useState("");
	const [info, setInfo] = useState<Info | undefined>();

	useEffect(() => {
		report = setInfo;
		// the projects are there once the loader is done
		const ready = () => {
			const names = levelsOf(samples[0].name);
			setLevels(names);
			setSelected(names[0] ?? "");
		};
		event.on(event.LOADER_COMPLETE, ready);
		ready();
		return () => {
			report = () => {};
			event.off(event.LOADER_COMPLETE, ready);
		};
	}, []);

	const pickSample = (name: string) => {
		const names = levelsOf(name);
		setSample(name);
		setLevels(names);
		setSelected(names[0] ?? "");
		if (names.length > 0) {
			loadLevel(`${name}:${names[0]}`);
		}
	};

	const pickLevel = (identifier: string) => {
		setSelected(identifier);
		// the whole world by the project's name alone
		loadLevel(identifier === "" ? sample : `${sample}:${identifier}`);
	};

	return (
		<div
			style={{
				position: "absolute",
				top: 44,
				left: 16,
				zIndex: 1000,
				display: "flex",
				gap: 8,
				alignItems: "center",
				flexWrap: "wrap",
			}}
		>
			<select
				value={sample}
				onChange={(e) => pickSample(e.target.value)}
				style={selectStyle}
			>
				{samples.map((s) => (
					<option key={s.name} value={s.name}>
						{s.label}
					</option>
				))}
			</select>
			<select
				value={selected}
				onChange={(e) => pickLevel(e.target.value)}
				style={selectStyle}
			>
				{levels.map((identifier) => (
					<option key={identifier} value={identifier}>
						{identifier}
					</option>
				))}
				<option value="">
					Whole world ({levels.length}{" "}
					{levels.length === 1 ? "level" : "levels"})
				</option>
			</select>
			{info && (
				<span style={{ color: "#e0e0e0", fontSize: 13 }}>
					{info.size} px · {info.layers} tile layers · {info.entities} entities
					· drag or use the arrow keys to move
				</span>
			)}
		</div>
	);
};

const Game = createExampleComponent(createGame);

export const ExampleLDtkLoader = () => {
	return (
		<>
			<Game />
			<Selectors />
		</>
	);
};
