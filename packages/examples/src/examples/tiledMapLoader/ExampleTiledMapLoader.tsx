import { TiledInflatePlugin } from "@melonjs/tiled-inflate-plugin";
import {
	event,
	game,
	input,
	level,
	loader,
	plugin,
	state,
	video,
} from "melonjs";
import { useEffect } from "react";
import { levels, resources } from "./resources";

let currentLevel = "village";

const loadLevel = (name: string) => {
	currentLevel = name;
	level.load(name, {
		container: game.world,
		onLoaded: () => {
			game.world.backgroundColor.setColor(0, 0, 0);
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

const onScroll = (ev: WheelEvent) => {
	if (ev.deltaX !== 0) {
		onKeyPressed(null, ev.deltaX < 0 ? input.KEY.LEFT : input.KEY.RIGHT);
	}
	if (ev.deltaY !== 0) {
		onKeyPressed(null, ev.deltaY < 0 ? input.KEY.UP : input.KEY.DOWN);
	}
};

const createGame = () => {
	if (
		!video.init(1024, 768, {
			parent: "screen",
			scaleMethod: "flex",
		})
	) {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

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
