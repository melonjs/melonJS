/**
 * melonJS — Tiled map loader (multi-format viewer) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { TiledInflatePlugin } from "@melonjs/tiled-inflate-plugin";
import {
	Application,
	event,
	game,
	input,
	level,
	loader,
	type Pointer,
	plugin,
	state,
} from "melonjs";
import { useEffect } from "react";
import { levels, resources } from "./resources";

const loadLevel = (name: string) => {
	const entry = levels.find((l) => l.name === name);
	level.load(name, {
		container: game.world,
		// don't auto-center small maps; we anchor everything at world (0,0)
		setViewportBounds: false,
		onLoaded: () => {
			game.world.backgroundColor.setColor(0, 0, 0);
			game.world.pos.set(0, 0);
			game.viewport.zoom = entry?.zoom ?? 1;

			// expand the viewport bounds to the map size so arrow-key scrolling
			// works on maps bigger than the canvas. Bounds default to the
			// renderer rect, which forbids any camera movement.
			const map = level.getCurrentLevel();
			const mapW = map.cols * map.tilewidth;
			const mapH = map.rows * map.tileheight;
			game.viewport.setBounds(
				0,
				0,
				Math.max(mapW, game.viewport.width),
				Math.max(mapH, game.viewport.height),
			);
			game.viewport.moveTo(0, 0);
			game.repaint();
		},
	});
};

const onKeyPressed = (_action: unknown, keyCode: number) => {
	const currentMap = level.getCurrentLevel();
	if (keyCode === input.KEY.LEFT) {
		game.viewport.move(-(currentMap.tilewidth / 2), 0);
	}
	if (keyCode === input.KEY.RIGHT) {
		game.viewport.move(currentMap.tilewidth / 2, 0);
	}
	if (keyCode === input.KEY.UP) {
		game.viewport.move(0, -(currentMap.tileheight / 2));
	}
	if (keyCode === input.KEY.DOWN) {
		game.viewport.move(0, currentMap.tileheight / 2);
	}
	game.repaint();
};

const onScroll = (ev: Pointer) => {
	if (ev.deltaX !== 0) {
		onKeyPressed(null, ev.deltaX < 0 ? input.KEY.LEFT : input.KEY.RIGHT);
	}
	if (ev.deltaY !== 0) {
		onKeyPressed(null, ev.deltaY < 0 ? input.KEY.UP : input.KEY.DOWN);
	}
};

const createGame = () => {
	// create the melonJS Application (replaces the legacy video.init)
	new Application(1024, 768, {
		parent: "screen",
		scaleMethod: "fill-max",
		preferWebGL1: false,
	});

	// register zlib/gzip inflate for compressed Tiled maps
	plugin.register(TiledInflatePlugin);

	loader.preload(resources, () => {
		event.on(event.KEYDOWN, onKeyPressed);
		input.registerPointerEvent("wheel", game.viewport, onScroll);
		state.change(state.DEFAULT, true);
		loadLevel("village");
	});
};

const LevelSelector = () => {
	return (
		<div
			style={{
				position: "absolute",
				top: 44,
				left: 16,
				zIndex: 1000,
			}}
		>
			<select
				defaultValue="village"
				onChange={(e) => loadLevel(e.target.value)}
				style={{
					padding: "6px 12px",
					fontSize: 14,
					background: "#1a1a1a",
					color: "#e0e0e0",
					border: "1px solid #444",
					borderRadius: 4,
				}}
			>
				{levels.map((l) => (
					<option key={l.name} value={l.name}>
						{l.label}
					</option>
				))}
			</select>
		</div>
	);
};

export const ExampleTiledMapLoader = () => {
	useEffect(() => {
		if (!game.isInitialized) {
			createGame();
		}
	}, []);
	return <LevelSelector />;
};
