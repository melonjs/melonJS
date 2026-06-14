/**
 * melonJS — Spine 4.3 runtime animation example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import Spine, { SpinePlugin } from "@melonjs/spine-plugin";
import {
	Application,
	event,
	input,
	loader,
	plugin,
	state,
	video,
} from "melonjs";
import { useEffect, useState } from "react";
import { characters, resources } from "./resources";

let app: Application | null = null;
let currentSpine: InstanceType<typeof Spine> | null = null;

const loadCharacter = (char: (typeof characters)[number]) => {
	if (!app) {
		return;
	}

	// remove previous spine object
	if (currentSpine) {
		app.world.removeChild(currentSpine);
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
	app.world.addChild(spineObj);
	currentSpine = spineObj;
	// biome-ignore lint/suspicious/noExplicitAny: TEMP debug hook
	(window as any).__spine = spineObj;
};

const createGame = () => {
	if (app) {
		return;
	}

	// scale relative to the `#screen` flex container (below the example
	// topbar) rather than the default `window` parent, so `fit` does not
	// overshoot the topbar height
	const scaleTarget = document.getElementById("screen");
	app = new Application(1462, 1119, {
		parent: "screen",
		renderer: video.AUTO,
		scale: "auto",
		scaleMethod: "fit",
		...(scaleTarget ? { scaleTarget } : {}),
		antiAlias: true,
	});

	// register plugins against this application instance
	plugin.register(DebugPanelPlugin, "debugPanel");
	(plugin.get(DebugPanelPlugin) as DebugPanelPlugin)?.show();
	plugin.register(SpinePlugin, "SpinePlugin", app);

	// set cross-origin
	loader.setOptions({ crossOrigin: "anonymous" });

	loader.preload(resources, () => {
		event.on(event.KEYDOWN, (_action: unknown, keyCode: number) => {
			if (keyCode === input.KEY.F && app) {
				if (app.isFullscreen()) {
					app.exitFullscreen();
				} else {
					app.requestFullscreen();
				}
			}
		});

		state.change(state.DEFAULT, true);
		if (app) {
			app.world.backgroundColor.parseCSS("#202020");
		}

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
		createGame();
	}, []);
	return <CharacterSelector />;
};
