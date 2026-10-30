/**
 * The gamepad plugin's visual test page, for developers. A small scene with
 * the controls over it, a readout of what the engine receives, and toggles
 * for each feature, to try on a desktop (with a mouse, or a real pad) and on
 * a phone. `?renderer=canvas|webgl|webgpu` picks the renderer.
 */
import {
	Application,
	Camera2d,
	event,
	input,
	Renderable,
	type Renderer,
	Stage,
	state,
	video,
} from "melonjs";
import { GamepadPlugin, type GamepadPluginOptions } from "../src/index.ts";

const { BUTTONS, AXES } = input.GAMEPAD;
const { KEY } = input;

const renderers: Record<string, (typeof video)[keyof typeof video]> = {
	canvas: video.CANVAS,
	webgl: video.WEBGL,
	webgpu: video.WEBGPU,
	auto: video.AUTO,
};
// `?renderer=webgl`, or `#webgl` where only the hash reaches the page
const rendererName =
	new URLSearchParams(location.search).get("renderer") ??
	(location.hash.slice(1) || "auto");

const app = new Application(960, 540, {
	parent: "screen",
	scaleMethod: "flex",
	renderer: renderers[rendererName] ?? video.AUTO,
});
await app.init();

// the actions a game would have, bound the way a game binds a real pad
const ACTIONS = {
	up: KEY.UP,
	down: KEY.DOWN,
	left: KEY.LEFT,
	right: KEY.RIGHT,
	A: KEY.X,
	B: KEY.Z,
	X: KEY.C,
	Y: KEY.V,
} as const;
for (const [action, key] of Object.entries(ACTIONS)) {
	input.bindKey(key, action);
}
const PAD_BUTTONS: [number, number][] = [
	[BUTTONS.UP, KEY.UP],
	[BUTTONS.DOWN, KEY.DOWN],
	[BUTTONS.LEFT, KEY.LEFT],
	[BUTTONS.RIGHT, KEY.RIGHT],
	[BUTTONS.FACE_1, KEY.X],
	[BUTTONS.FACE_2, KEY.Z],
	[BUTTONS.FACE_3, KEY.C],
	[BUTTONS.FACE_4, KEY.V],
];
for (const [button, key] of PAD_BUTTONS) {
	input.bindGamepad(0, { type: "buttons", code: button }, key);
}
// the sticks, bound with a threshold so the engine reads them and reports
// their analog values on GAMEPAD_UPDATE
input.bindKey(KEY.J, "lx-");
input.bindKey(KEY.L, "lx+");
input.bindKey(KEY.I, "ly-");
input.bindKey(KEY.K, "ly+");
input.bindKey(KEY.F, "rx-");
input.bindKey(KEY.H, "rx+");
input.bindKey(KEY.T, "ry-");
input.bindKey(KEY.G, "ry+");
const AXIS_KEYS: [number, number, number][] = [
	[AXES.LX, -0.3, KEY.J],
	[AXES.LX, 0.3, KEY.L],
	[AXES.LY, -0.3, KEY.I],
	[AXES.LY, 0.3, KEY.K],
	[AXES.RX, -0.3, KEY.F],
	[AXES.RX, 0.3, KEY.H],
	[AXES.RY, -0.3, KEY.T],
	[AXES.RY, 0.3, KEY.G],
];
for (const [axis, threshold, key] of AXIS_KEYS) {
	input.bindGamepad(0, { type: "axes", code: axis, threshold }, key);
}

/** the analog values of slot 0, as the engine reports them */
const axes = [0, 0, 0, 0];
event.on(event.GAMEPAD_UPDATE, (index, type, code, value) => {
	if (Number(index) === 0 && type === "axes") {
		axes[code] = value as unknown as number;
	}
});

/** a dot the left stick (analog) or the D-pad (digital) moves */
class Dot extends Renderable {
	constructor(x: number, y: number) {
		super(x, y, 40, 40);
		this.anchorPoint.set(0.5, 0.5);
		this.alwaysUpdate = true;
	}

	override update(dt: number): boolean {
		// pixels per millisecond at full lean
		const speed = 0.4 * dt;
		let dx = axes[AXES.LX];
		let dy = axes[AXES.LY];
		if (dx === 0 && dy === 0) {
			dx = Number(input.keyStatus("right")) - Number(input.keyStatus("left"));
			dy = Number(input.keyStatus("down")) - Number(input.keyStatus("up"));
		}
		const { width, height } = app.viewport;
		this.pos.x = Math.min(Math.max(this.pos.x + dx * speed, 20), width - 20);
		this.pos.y = Math.min(Math.max(this.pos.y + dy * speed, 20), height - 20);
		return true;
	}

	override draw(renderer: Renderer): void {
		renderer.setColor(input.keyStatus("A") ? "#ffd166" : "#ef476f");
		renderer.fillEllipse(this.pos.x, this.pos.y, 20, 20);
	}
}

/** where the game itself received a tap */
class Marker extends Renderable {
	private life = 1000;
	constructor(x: number, y: number) {
		super(x, y, 16, 16);
		this.anchorPoint.set(0.5, 0.5);
		this.alwaysUpdate = true;
	}

	override update(dt: number): boolean {
		this.life -= dt;
		if (this.life <= 0) {
			app.world.removeChild(this);
		}
		return true;
	}

	override draw(renderer: Renderer): void {
		const radius = 8 + (1000 - this.life) / 40;
		renderer.setColor("#06d6a0");
		renderer.setGlobalAlpha(
			renderer.globalAlpha() * Math.max(this.life / 1000, 0),
		);
		renderer.lineWidth = 3;
		renderer.strokeEllipse(this.pos.x, this.pos.y, radius, radius);
	}
}

/** the floor: a grid in the world, so a minimap camera shows it too */
class Floor extends Renderable {
	constructor() {
		super(0, 0, 4000, 3000);
		this.anchorPoint.set(0, 0);
	}

	override draw(renderer: Renderer): void {
		renderer.setColor("#26547c");
		renderer.fillRect(0, 0, this.width, this.height);
		renderer.setColor("#2f6497");
		renderer.lineWidth = 2;
		for (let x = 0; x <= this.width; x += 60) {
			renderer.strokeLine(x, 0, x, this.height);
		}
		for (let y = 0; y <= this.height; y += 60) {
			renderer.strokeLine(0, y, this.width, y);
		}
	}
}

/** a dark shade over the whole screen, as a darkness or a fade is */
class Shade extends Renderable {
	constructor() {
		super(0, 0, 1, 1);
		this.anchorPoint.set(0, 0);
		this.floating = true;
	}

	override draw(renderer: Renderer): void {
		const { width, height } = app.viewport;
		renderer.setColor("#000000");
		renderer.setGlobalAlpha(renderer.globalAlpha() * 0.6);
		renderer.fillRect(0, 0, width, height);
	}
}

let gameTaps = 0;
let dot: Dot;

class TestStage extends Stage {
	override onResetEvent(): void {
		app.world.addChild(new Floor(), 0);
		dot = new Dot(app.viewport.width / 2, app.viewport.height / 2);
		app.world.addChild(dot, 10);
		// a tap the controls let through reaches the game: it leaves a ring
		input.registerPointerEvent("pointerdown", app.viewport, (pointer) => {
			gameTaps++;
			app.world.addChild(
				new Marker(pointer.gameWorldX, pointer.gameWorldY),
				20,
			);
		});
	}
}
state.set(state.PLAY, new TestStage());
state.change(state.PLAY);

// the toggles: options that need the plugin made again, and run-time ones
const options: GamepadPluginOptions = {
	enabled: true,
	sticks: [{}],
	buttons: [{ label: "A" }, { label: "B" }, { label: "X" }, { label: "Y" }],
};
let gamepad = new GamepadPlugin(options, app);

const remake = (change: Partial<GamepadPluginOptions>): void => {
	Object.assign(options, change);
	gamepad.destroy();
	gamepad = new GamepadPlugin(options, app);
};

/** a shade over everything else, at a very high z */
const overlay = new Shade();
let overlayShown = false;

/** a minimap camera, which must not draw the controls */
const minimap = new Camera2d(0, 0, 240, 135);
minimap.name = "minimap";
minimap.autoResize = false;
minimap.zoom = 0.25;
let minimapShown = false;

const toggles = document.getElementById("toggles")!;
const toggle = (
	label: string,
	initial: boolean,
	apply: (on: boolean) => void,
): void => {
	const button = document.createElement("button");
	let on = initial;
	button.textContent = label;
	button.setAttribute("aria-pressed", String(on));
	button.addEventListener("click", () => {
		on = !on;
		button.setAttribute("aria-pressed", String(on));
		apply(on);
	});
	toggles.appendChild(button);
};

toggle("enabled", true, (on) => {
	gamepad.enabled = on;
});
toggle("2 sticks", false, (on) => {
	remake({ sticks: on ? [{}, {}] : [{}] });
});
toggle("floating", false, (on) => {
	remake({
		sticks: (options.sticks as object[]).map((stick) => {
			return { ...stick, floating: on };
		}),
	});
});
toggle("hide on pad", true, (on) => {
	remake({ hideOnGamepad: on });
});
toggle("dim B", false, (on) => {
	gamepad.buttons[1].dimmed = on;
});
toggle("hide X", false, (on) => {
	gamepad.buttons[2].visible = !on;
});
toggle("B: Open", false, (on) => {
	gamepad.buttons[1].label = on ? "Open" : "B";
});
toggle("overlay", false, (on) => {
	overlayShown = on;
	if (on) {
		app.world.addChild(overlay, 999_999);
	} else {
		app.world.removeChild(overlay, true);
	}
});
toggle("minimap", false, (on) => {
	minimapShown = on;
	const stage = state.current()!;
	if (on) {
		minimap.screenX = app.viewport.width - 240 - 8;
		minimap.screenY = 8;
		stage.cameras.set("minimap", minimap);
	} else {
		stage.cameras.delete("minimap");
	}
});

const vibrate = document.createElement("button");
vibrate.textContent = "vibrate";
vibrate.addEventListener("click", () => {
	void input.vibrateGamepad(input.activeGamepad(), { duration: 150 });
});
toggles.appendChild(vibrate);

const select = document.createElement("select");
for (const name of Object.keys(renderers)) {
	const option = document.createElement("option");
	option.value = name;
	option.textContent = name;
	option.selected = name === rendererName;
	select.appendChild(option);
}
select.addEventListener("change", () => {
	location.hash = select.value;
	location.reload();
});
toggles.appendChild(select);

// the readout, refreshed every frame
const readout = document.getElementById("state")!;
const fixed = (value: number): string => {
	return (value < 0 ? "" : "+") + value.toFixed(2);
};
const refresh = (): void => {
	const realPads = navigator.getGamepads?.().filter((pad) => {
		return pad !== null;
	}).length;
	const held = Object.keys(ACTIONS)
		.filter((action) => {
			return input.keyStatus(action);
		})
		.join(" ");
	const sticks = gamepad.sticks
		.map((stick) => {
			return `${stick.side} ${fixed(stick.value.x)} ${fixed(stick.value.y)}`;
		})
		.join("  ");
	const buttons = gamepad.buttons
		.map((button) => {
			const flags = `${button.pressed ? "*" : ""}${button.dimmed ? "~" : ""}${button.visible ? "" : "-"}`;
			return `${button.label || "?"}${flags}`;
		})
		.join(" ");
	readout.textContent = [
		`${app.renderer.type}  ${app.viewport.width}x${app.viewport.height}`,
		`enabled ${gamepad.enabled}  visible ${gamepad.visible}`,
		`real pads ${realPads ?? 0}  active slot ${input.activeGamepad()}`,
		`plugin: ${sticks}`,
		`buttons: ${buttons}   (* held ~ dimmed - hidden)`,
		`engine axes: LX ${fixed(axes[0])} LY ${fixed(axes[1])} RX ${fixed(axes[2])} RY ${fixed(axes[3])}`,
		`engine actions: ${held || "-"}`,
		`taps the game got: ${gameTaps}`,
		`overlay ${overlayShown}  minimap ${minimapShown}`,
	].join("\n");
	requestAnimationFrame(refresh);
};
refresh();
