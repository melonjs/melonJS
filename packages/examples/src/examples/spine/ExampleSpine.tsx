/**
 * melonJS — Spine 4.3 runtime animation example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import Spine, { Slider, SpinePlugin } from "@melonjs/spine-plugin";
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
	// (debug panel is hidden by default — press "s" to toggle, or append
	// "#debug" to the URL)
	plugin.register(DebugPanelPlugin, "debugPanel");
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
			{selected === "diamond" && <SliderControl />}
		</div>
	);
};

// Interactive showcase for the Spine 4.3 `Slider` constraint API.
//
// The diamond's "rotation" Slider is auto-driven by its control bone,
// which the playing animation rotates — so the diamond spins on its
// own. We leave the auto-driving alone and let the HTML range input
// scrub `slider.pose.mix` from 0 → 1, which scales how much of the
// pre-baked rotation pose actually applies. At mix=0 the rotation pose
// has zero influence (diamond freezes in setup pose); at mix=1 it
// applies fully (full spin); in between you can see the rotation
// amplitude dialled down live while the slider itself keeps ticking
// (see the read-out below).
const SliderControl = () => {
	const [mix, setMix] = useState(1);
	const [sliderTime, setSliderTime] = useState(0);

	useEffect(() => {
		if (!currentSpine) return;
		const slider = currentSpine.findConstraint("rotation");
		if (!(slider instanceof Slider)) return;
		slider.pose.mix = mix;
	}, [mix]);

	// poll the Slider's auto-driven time so the read-out updates while
	// the diamond spins (we never write to time — bone drives it)
	useEffect(() => {
		let raf = 0;
		const tick = () => {
			if (currentSpine) {
				const slider = currentSpine.findConstraint("rotation");
				if (slider instanceof Slider) setSliderTime(slider.pose.time);
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, []);

	return (
		<div style={{ marginTop: 12, color: "#e0e0e0", fontSize: 12 }}>
			<div style={{ marginBottom: 4 }}>
				<code>Slider</code> API · rotation intensity
			</div>
			<input
				type="range"
				min={0}
				max={1}
				step={0.01}
				value={mix}
				onChange={(e) => setMix(+e.target.value)}
				style={{ width: 200 }}
			/>
			<div style={{ marginTop: 4, fontSize: 10, color: "#888" }}>
				findConstraint("rotation").pose.mix = {mix.toFixed(2)}
				<br />
				findConstraint("rotation").pose.time = {sliderTime.toFixed(2)}s
				<span style={{ color: "#666" }}> · bone-driven (auto)</span>
			</div>
		</div>
	);
};

export const ExampleSpine = () => {
	useEffect(() => {
		createGame();
	}, []);
	return <CharacterSelector />;
};
