/**
 * melonJS — UI widget showcase example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Application as App,
	type Application,
	audio,
	Color,
	ColorLayer,
	loader,
	ProgressBar,
	Stage,
	state,
	Text,
	TextureAtlas,
	UICheckbox,
	UIFocus,
	UIPanel,
	UISlider,
	UITextButton,
} from "melonjs";
import { createExampleComponent } from "../utils";

const base = `${import.meta.env.BASE_URL}assets/ui/`;
// borrowed from two other examples, so this one ships no audio of its own
const MUSIC = "ingame-loop";
const MUSIC_PATH = `${import.meta.env.BASE_URL}assets/afterBurner/bgm/`;
const SFX = "dungeonCoins";
const SFX_PATH = `${import.meta.env.BASE_URL}assets/isometricDungeon/sfx/`;

let texture: TextureAtlas;

/** the text style every widget here shares: the same names on each */
const FONT = { font: "kenpixel", fontSize: 14, labelFillStyle: "black" };

/** the options as last accepted */
const saved = { music: false, musicVolume: 0.5, sfx: true, sfxVolume: 0.8 };
/** and as they are on screen */
const current = { ...saved };

/**
 * Start or stop the music to match the current options.
 */
const applyMusic = () => {
	if (current.music) {
		if (audio.getCurrentTrack() !== MUSIC) {
			audio.playTrack(MUSIC, current.musicVolume);
		}
	} else {
		audio.stopTrack();
	}
};

/**
 * A skinned button: the Kenney art has a shorter pressed image, which the
 * button draws lowered so it looks pushed in.
 * @param color - the art's colour
 * @param text - the label
 * @param width - the button's width; the art stretches to it
 * @param onClick - what it does
 * @returns the button
 */
const button = (
	color: string,
	text: string,
	width: number,
	onClick: () => void,
) => {
	return new UITextButton(0, 0, {
		...FONT,
		fontSize: 12,
		text,
		width,
		// a little bounce under the pointer or the focus, and when pressed
		hoverScale: 1.04,
		pressScale: 0.96,
		skin: {
			atlas: texture,
			normal: `${color}_button04`,
			pressed: `${color}_button05`,
		},
		onClick,
	});
};

/**
 * A volume slider on the Kenney track and thumb.
 * @param label - its caption
 * @param value - where it starts
 * @param onChange - called while it moves
 * @param onChangeEnd - called once when it is let go
 * @returns the slider
 */
const volume = (
	label: string,
	value: number,
	onChange: (v: number) => void,
	onChangeEnd?: (v: number) => void,
) => {
	return new UISlider(0, 0, {
		...FONT,
		label,
		showValue: true,
		valueFormat: (_value, ratio) => {
			return `${Math.round(ratio * 100)}%`;
		},
		length: 320,
		value,
		step: 0.01,
		skin: {
			atlas: texture,
			track: "grey_sliderHorizontal",
			thumb: "blue_sliderDown",
		},
		onChange,
		onChangeEnd,
	});
};

/**
 * A checkbox on the Kenney boxes.
 * @param labelOn - its label while checked
 * @param labelOff - its label while not
 * @param checked - whether it starts checked
 * @param onChange - called when the user changes it
 * @returns the checkbox
 */
const checkbox = (
	labelOn: string,
	labelOff: string,
	checked: boolean,
	onChange: (on: boolean) => void,
) => {
	return new UICheckbox(0, 0, {
		...FONT,
		labelOn,
		labelOff,
		checked,
		hoverScale: 1.04,
		skin: {
			atlas: texture,
			on: "green_boxCheckmark",
			off: "grey_boxCheckmark",
		},
		onChange,
	});
};

/**
 * A panel on the Kenney grey frame, with a title, that can be dragged.
 * @param x - left edge
 * @param y - top edge
 * @param width - its width
 * @param height - its height
 * @param title - its title
 * @returns the panel, for more settings to be added to
 */
const framed = (
	x: number,
	y: number,
	width: number,
	height: number,
	title: string,
) => {
	return {
		x,
		y,
		settings: {
			width,
			height,
			title,
			titleFont: "kenpixel",
			titleFontSize: 20,
			titleFillStyle: "black",
			skin: {
				atlas: texture,
				region: "grey_panel",
				insetx: 10,
				insety: 10,
			},
			// a soft drop shadow, rounded like the art's corners
			shadowColor: "#00000059",
			shadowOffsetY: 6,
			shadowBlur: 10,
			radius: 6,
			draggable: true,
		},
	};
};

class PlayScreen extends Stage {
	override onResetEvent(app: Application) {
		const background = new ColorLayer("background", "rgba(248, 194, 40, 1.0)");
		app.world.addChild(background, 0);

		this.addOptions(app, background);
		this.addBars(app);
		this.addLevels(app);

		// the arrow keys or a pad's D-pad move between the widgets, Enter or
		// the pad's A button acts on the one with the focus
		UIFocus.enable();
		app.world.addChild(
			new Text(20, 575, {
				font: "kenpixel",
				size: 13,
				fillStyle: "black",
				textAlign: "left",
				textBaseline: "bottom",
				text: "Keyboard: arrows and Enter   Gamepad: D-pad and A",
			}),
			1,
		);
	}

	/**
	 * The options: two checkboxes, two volume sliders and three buttons, laid
	 * out as a column by the panel itself.
	 * @param app - the application
	 * @param background - the backdrop the video button recolours
	 */
	private addOptions(app: Application, background: ColorLayer) {
		const frame = framed(20, 20, 380, 100, "OPTIONS");
		const panel = new UIPanel(frame.x, frame.y, {
			...frame.settings,
			layout: "column",
			padding: 16,
			gap: 12,
			// grows to fit what is added below
			autoSize: true,
		});

		const music = checkbox("Music ON", "Music OFF", current.music, (on) => {
			current.music = on;
			applyMusic();
		});
		const musicVolume = volume("Music volume", current.musicVolume, (v) => {
			current.musicVolume = v;
			if (audio.getCurrentTrack() === MUSIC) {
				audio.fade(MUSIC, v, v, 1);
			}
		});
		const sfx = checkbox("Sound FX ON", "Sound FX OFF", current.sfx, (on) => {
			current.sfx = on;
			if (on) {
				audio.play(SFX, false, null, current.sfxVolume);
			}
		});
		const sfxVolume = volume(
			"Sound FX volume",
			current.sfxVolume,
			(v) => {
				current.sfxVolume = v;
			},
			// once on release, not on every step of the drag
			(v) => {
				if (current.sfx) {
					audio.play(SFX, false, null, v);
				}
			},
		);

		const backdrops = ["#f8c228", "#5ab0e8", "#8fd16a"];
		let backdrop = 0;
		const video = button("blue", "Video Options", 320, () => {
			backdrop = (backdrop + 1) % backdrops.length;
			background.color.parseCSS(backdrops[backdrop]);
		});

		// a row inside the column: a panel that draws nothing and lets clicks
		// through, laying out its two buttons side by side
		const actions = new UIPanel(0, 0, {
			width: 320,
			height: 49,
			layout: "row",
			gap: 12,
			blocking: false,
		});
		actions.addChild(
			button("green", "Accept", 154, () => {
				Object.assign(saved, current);
			}),
		);
		actions.addChild(
			button("yellow", "Cancel", 154, () => {
				// Restored from code, so no onChange runs: the widgets only
				// change their look, and the audio is put back here.
				Object.assign(current, saved);
				music.checked = saved.music;
				musicVolume.value = saved.musicVolume;
				sfx.checked = saved.sfx;
				sfxVolume.value = saved.sfxVolume;
				applyMusic();
			}),
		);

		panel.addChild(music);
		panel.addChild(musicVolume);
		panel.addChild(sfx);
		panel.addChild(sfxVolume);
		panel.addChild(video);
		panel.addChild(actions);
		app.world.addChild(panel, 1);
	}

	/**
	 * A level picker: more levels than fit, in a grid that scrolls with the
	 * wheel or a drag. A drag that starts on a level scrolls the list rather
	 * than picking it.
	 * @param app - the application
	 */
	private addLevels(app: Application) {
		// sized to show the first 16 levels: 4 rows of 49, the title, padding and frame
		const frame = framed(724, 20, 260, 292, "LEVELS");
		const panel = new UIPanel(frame.x, frame.y, {
			...frame.settings,
			layout: "grid",
			columns: 4,
			padding: 10,
			gap: 8,
			align: "center",
			scroll: "vertical",
		});
		for (let level = 1; level <= 30; level++) {
			const pick = new UITextButton(0, 0, {
				...FONT,
				fontSize: 16,
				hoverScale: 1.12,
				pressScale: 0.9,
				text: String(level),
				skin: {
					atlas: texture,
					normal: "blue_button07",
					pressed: "blue_button08",
				},
				// the last six are locked
				enabled: level <= 24,
				onClick: () => {
					panel.title?.setText(`LEVEL ${level}`);
				},
			});
			panel.addChild(pick);
		}
		app.world.addChild(panel, 1);
	}

	/**
	 * `ProgressBar`, in the shapes it tends to be wanted in.
	 *
	 * All of them are drawn with primitives and no artwork. The track and the
	 * fill are `fillRect`; a square border is four more rects, so it lands
	 * exactly inside the bar and keeps its corners; a rounded one goes through
	 * the `RoundRect` shape path instead.
	 * @param app - the application
	 */
	private addBars(app: Application) {
		const frame = framed(408, 20, 300, 400, "PROGRESS");
		const panel = new UIPanel(frame.x, frame.y, frame.settings);

		/**
		 * one caption, in the panel's own coordinates
		 * @param x - left edge
		 * @param y - top edge
		 * @param text - what it says
		 * @returns the label
		 */
		const caption = (x: number, y: number, text: string) => {
			return new Text(x, y, {
				font: "kenpixel",
				size: 13,
				fillStyle: "black",
				textAlign: "left",
				textBaseline: "top",
				text,
			});
		};

		// 1. square, bordered, with the built-in percentage label
		panel.addChild(caption(24, 52, "squared + label"));
		panel.addChild(
			new ProgressBar(24, 72, {
				width: 252,
				height: 24,
				value: 0.72,
				trackColor: "#0000001a",
				fillColor: "#4a8fd4",
				borderColor: "black",
				borderWidth: 2,
				padding: 2,
				showLabel: true,
				font: "kenpixel",
				fontSize: 12,
				labelFillStyle: "white",
			}),
		);

		// 2. ROUNDED, which takes the shape path rather than `fillRect`
		panel.addChild(caption(24, 112, "rounded"));
		panel.addChild(
			new ProgressBar(24, 132, {
				width: 252,
				height: 24,
				value: 0.45,
				radius: 12,
				// with a shadow, a solid track: a see-through one shows it
				shadowColor: "#00000040",
				shadowOffsetY: 3,
				shadowBlur: 4,
				trackColor: "#dcdcdc",
				fillColor: "#59b25b",
				borderColor: "black",
				borderWidth: 2,
				padding: 3,
			}),
		);

		// 3. vertical, filling upward, with a gradient down its length
		panel.addChild(caption(24, 232, "vertical"));
		const ramp = app.renderer.createLinearGradient(0, 372, 0, 252);
		ramp.addColorStop(0, "#d4553a");
		ramp.addColorStop(0.5, "#e8c84a");
		ramp.addColorStop(1, "#59b25b");
		panel.addChild(
			new ProgressBar(24, 252, {
				width: 30,
				height: 120,
				value: 0.8,
				direction: "bottom-to-top",
				trackColor: "#0000001a",
				fillColor: ramp,
				borderColor: "black",
				borderWidth: 2,
				padding: 3,
				radius: 8,
			}),
		);

		// 4. a value-driven colour. The bar re-reads `fillColor` every frame,
		// so a `Color` the caller keeps and mutates is all an animated one
		// takes; no rule about it lives in the bar.
		panel.addChild(caption(150, 232, "live colour"));
		const hot = new Color().parseCSS("#d4553a");
		const cool = new Color().parseCSS("#4a8fd4");
		const mixed = new Color().copy(cool);
		const pulse = new ProgressBar(150, 252, {
			width: 30,
			height: 120,
			value: 1,
			direction: "bottom-to-top",
			trackColor: "#0000001a",
			fillColor: mixed,
			borderColor: "black",
			borderWidth: 2,
			padding: 3,
		});
		panel.addChild(pulse);

		// 5. right-to-left, which is the mirrored form a second player gets
		panel.addChild(caption(24, 172, "right to left"));
		const mirrored = new ProgressBar(24, 192, {
			width: 252,
			height: 24,
			value: 0.6,
			direction: "right-to-left",
			trackColor: "#0000001a",
			fillColor: "#b25b9b",
			borderColor: "black",
			borderWidth: 2,
			padding: 2,
		});
		panel.addChild(mirrored);

		app.world.addChild(panel, 1);

		let t = 0;
		this.pulseUpdate = (dt: number) => {
			t = (t + dt / 2200) % 1;
			const v = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
			pulse.value = v;
			mixed.copy(hot).lerp(cool, v);
		};
	}

	/** drives the live-colour bar; see {@link PlayScreen.addBars} */
	private pulseUpdate?: (dt: number) => void;

	/**
	 * @param dt - milliseconds since the last frame
	 * @returns true, since the pulsing bar always has something to redraw
	 */
	override update(dt: number) {
		super.update(dt);
		this.pulseUpdate?.(dt);
		return true;
	}

	/**
	 * The music belongs to this screen.
	 */
	override onDestroyEvent() {
		audio.stopTrack();
		UIFocus.disable();
	}
}

const createGame = async () => {
	const app = new App(800, 600, {
		parent: "screen",
		scale: "auto",
		scaleMethod: "flex-width",
	});
	await app.init();
	audio.init("mp3,ogg");

	const resources = [
		{ name: "UI_Assets-0", type: "image", src: `${base}img/UI_Assets-0.png` },
		{ name: "UI_Assets-1", type: "image", src: `${base}img/UI_Assets-1.png` },
		{ name: "UI_Assets-2", type: "image", src: `${base}img/UI_Assets-2.png` },
		{ name: "UI_Assets-0", type: "json", src: `${base}img/UI_Assets-0.json` },
		{ name: "UI_Assets-1", type: "json", src: `${base}img/UI_Assets-1.json` },
		{ name: "UI_Assets-2", type: "json", src: `${base}img/UI_Assets-2.json` },
		{
			name: "kenpixel",
			type: "fontface",
			src: `${base}font/kenvector_future.woff2`,
		},
		{ name: MUSIC, type: "audio", src: MUSIC_PATH },
		{ name: SFX, type: "audio", src: SFX_PATH },
	];

	loader.preload(resources, () => {
		texture = new TextureAtlas([
			loader.getJSON("UI_Assets-0"),
			loader.getJSON("UI_Assets-1"),
			loader.getJSON("UI_Assets-2"),
		]);

		state.set(state.PLAY, new PlayScreen());
		state.change(state.PLAY);
	});
};

export const ExampleUI = createExampleComponent(createGame);
