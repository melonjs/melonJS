/**
 * melonJS — Spine 4.2 runtime animation example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import Spine, { SpinePlugin } from "@melonjs/spine-plugin";
import { event, game, input, loader, plugin, state, video } from "melonjs";
import { useEffect, useState } from "react";
import { characters, resources } from "./resources";

let currentSpine: InstanceType<typeof Spine> | null = null;

const loadCharacter = (char: (typeof characters)[number]) => {
	// remove previous spine object
	if (currentSpine) {
		game.world.removeChild(currentSpine);
		currentSpine = null;
	}

	// create new spine renderable
	const spineObj = new Spine(char.x, char.y, {
		atlasFile: char.atlas,
		jsonFile: char.json,
	});

	// set skin if specified
	if ("skin" in char && char.skin) {
		spineObj.setSkinByName(char.skin);
	}

	// apply scale if specified
	if ("scale" in char && char.scale) {
		spineObj.scale(char.scale);
	}

	// set default animation
	spineObj.setAnimation(0, char.animation, true);

	// add to world
	game.world.addChild(spineObj);
	currentSpine = spineObj;
};

let initialized = false;

const createGame = () => {
	if (initialized) {
		return;
	}
	initialized = true;

	if (
		!video.init(1462, 1119, {
			parent: "screen",
			renderer: video.AUTO,
			scale: "auto",
			scaleMethod: "fit",
			antiAlias: true,
		})
	) {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	// register plugins
	plugin.register(DebugPanelPlugin);
	(plugin.get(DebugPanelPlugin) as DebugPanelPlugin)?.show();
	plugin.register(SpinePlugin);

	// set cross-origin
	loader.setOptions({ crossOrigin: "anonymous" });

	loader.preload(resources, () => {
		event.on(event.KEYDOWN, (_action: unknown, keyCode: number) => {
			if (keyCode === input.KEY.F) {
				if (!document.fullscreenElement) {
					document.documentElement.requestFullscreen();
				} else {
					document.exitFullscreen();
				}
			}
		});

		state.change(state.DEFAULT, true);
		game.world.backgroundColor.parseCSS("#202020");

		// load default character
		loadCharacter(characters[0]);
	});
};

const CharacterSelector = () => {
	const [selected, setSelected] = useState(characters[0].name);

	return (
		<div
			style={{
				position: "absolute",
				top: 200,
				left: 16,
				zIndex: 1000,
			}}
		>
			<select
				value={selected}
				onChange={(e) => {
					const char = characters.find((c) => c.name === e.target.value);
					if (char) {
						setSelected(char.name);
						loadCharacter(char);
					}
				}}
				style={{
					padding: "6px 12px",
					fontSize: 14,
					background: "#1a1a1a",
					color: "#e0e0e0",
					border: "1px solid #444",
					borderRadius: 4,
				}}
			>
				{characters.map((c) => (
					<option key={c.name} value={c.name}>
						{c.label}
					</option>
				))}
			</select>
		</div>
	);
};

export const ExampleSpine = () => {
	useEffect(() => {
		if (!game.isInitialized) {
			createGame();
		}
	}, []);
	return <CharacterSelector />;
};
