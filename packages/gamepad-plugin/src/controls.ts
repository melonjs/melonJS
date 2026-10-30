import { input, math, type Renderer, Text } from "melonjs";
import type { VirtualPad } from "./pad.ts";
import type {
	ButtonOptions,
	Placement,
	StickKeys,
	StickOptions,
} from "./types.ts";

const { AXES, BUTTONS } = input.GAMEPAD;

// each control presses its keys under its own source id, so a key also held
// on the keyboard stays down until both let go (gamepads use 256 and up)
let nextKeySource = 1024;

/** a key pressed or released by a control */
class KeyPress {
	private down = false;
	private readonly source = nextKeySource++;

	constructor(private readonly key: number | undefined) {}

	set(down: boolean): void {
		if (this.key === undefined || down === this.down) {
			return;
		}
		this.down = down;
		input.triggerKeyEvent(this.key, down, this.source);
	}
}

/**
 * where a placement puts a point in a viewport of this size
 * @param placement - the distances to the edges
 * @param width - the viewport width, in pixels
 * @param height - the viewport height, in pixels
 */
function resolve(
	placement: Placement,
	width: number,
	height: number,
): { x: number; y: number } {
	return {
		x:
			placement.left !== undefined
				? placement.left
				: width - (placement.right ?? 0),
		y:
			placement.top !== undefined
				? placement.top
				: height - (placement.bottom ?? 0),
	};
}

/** a stick's thumb, as a fraction of its base's radius */
const THUMB = 0.45;

/** the look shared by every control */
export interface Look {
	color: string;
	opacity: number;
}

/**
 * A stick: a base and a thumb that follows the finger, reporting how far it
 * leans on two axes, from -1 to 1 (down and right are positive, as on a
 * real pad).
 */
export class VirtualStick {
	/** which stick of the pad it is */
	readonly side: "left" | "right";
	/** whether it is centered where the thumb lands */
	readonly floating: boolean;
	/** the radius of its base, in viewport pixels */
	radius = 0;
	/** where its base is drawn, in viewport pixels */
	readonly center = { x: 0, y: 0 };
	/** how far it leans, from -1 to 1 on each axis, after the deadzone */
	readonly value = { x: 0, y: 0 };
	/** where the thumb is drawn, from the center: under the finger, as far as it goes */
	private readonly thumb = { x: 0, y: 0 };
	/** the pointer holding it, or null */
	pointerId: number | null = null;

	private readonly options: StickOptions;
	/** where it rests, set by the layout */
	private readonly home = { x: 0, y: 0 };
	private readonly deadzone: number;
	private readonly dpadThreshold: number;
	private readonly axisX: number;
	private readonly axisY: number;
	private readonly dpad: boolean;
	private readonly keys: Record<keyof StickKeys, KeyPress>;
	private readonly directions = {
		up: false,
		down: false,
		left: false,
		right: false,
	};

	constructor(
		options: StickOptions,
		side: "left" | "right",
		private readonly pad: VirtualPad,
	) {
		this.options = options;
		this.side = options.side ?? side;
		this.floating = options.floating ?? false;
		this.deadzone = math.clamp(options.deadzone ?? 0.1, 0, 0.95);
		this.dpadThreshold = math.clamp(options.dpadThreshold ?? 0.5, 0.05, 1);
		this.axisX = this.side === "left" ? AXES.LX : AXES.RX;
		this.axisY = this.side === "left" ? AXES.LY : AXES.RY;
		this.dpad = options.dpad ?? this.side === "left";
		const keys = options.keys ?? {};
		this.keys = {
			up: new KeyPress(keys.up),
			down: new KeyPress(keys.down),
			left: new KeyPress(keys.left),
			right: new KeyPress(keys.right),
		};
	}

	/**
	 * place it in a viewport of this size
	 * @param width - the viewport width, in pixels
	 * @param height - the viewport height, in pixels
	 * @param margin - the space kept from the edges
	 */
	layout(width: number, height: number, margin: number): void {
		const short = Math.min(width, height);
		this.radius = this.options.radius ?? Math.max(24, Math.round(short * 0.13));
		const offset = margin + this.radius;
		const placement: Placement = this.options.position ?? {
			bottom: offset,
			...(this.side === "left" ? { left: offset } : { right: offset }),
		};
		const { x, y } = resolve(placement, width, height);
		this.home.x = x;
		this.home.y = y;
		if (this.pointerId === null) {
			this.center.x = x;
			this.center.y = y;
		}
	}

	/**
	 * whether a finger landing here takes the stick
	 * @param x - in viewport pixels
	 * @param y - in viewport pixels
	 * @param width - the viewport width, in pixels
	 */
	hits(x: number, y: number, width: number): boolean {
		if (this.floating) {
			// its half of the screen
			return this.side === "left" ? x < width / 2 : x >= width / 2;
		}
		// a little past its base, for a thumb
		return (
			Math.hypot(x - this.center.x, y - this.center.y) <= this.radius * 1.25
		);
	}

	/**
	 * @param pointerId - the pointer
	 * @param x - in viewport pixels
	 * @param y - in viewport pixels
	 */
	grab(pointerId: number, x: number, y: number): void {
		this.pointerId = pointerId;
		if (this.floating) {
			this.center.x = x;
			this.center.y = y;
		}
		this.move(x, y);
	}

	/**
	 * @param x - in viewport pixels
	 * @param y - in viewport pixels
	 */
	move(x: number, y: number): void {
		const dx = x - this.center.x;
		const dy = y - this.center.y;
		const distance = Math.hypot(dx, dy);
		const lean = Math.min(distance / this.reach, 1);
		const shown = distance > 0 ? (lean * this.reach) / distance : 0;
		this.thumb.x = dx * shown;
		this.thumb.y = dy * shown;
		if (lean <= this.deadzone) {
			this.value.x = 0;
			this.value.y = 0;
		} else {
			// from 0 at the deadzone to 1 at full reach
			const scaled = (lean - this.deadzone) / (1 - this.deadzone);
			this.value.x = (dx / distance) * scaled;
			this.value.y = (dy / distance) * scaled;
		}
		this.report();
	}

	/**
	 * how far the thumb moves from the center, in viewport pixels: the stick
	 * reads full when the finger is this far
	 */
	get reach(): number {
		return this.radius * (1 - THUMB);
	}

	/** back to rest */
	release(): void {
		this.pointerId = null;
		this.value.x = 0;
		this.value.y = 0;
		this.thumb.x = 0;
		this.thumb.y = 0;
		this.center.x = this.home.x;
		this.center.y = this.home.y;
		this.report();
	}

	/** write the stick to the pad and press the keys it leans to */
	private report(): void {
		this.pad.axes[this.axisX] = this.value.x;
		this.pad.axes[this.axisY] = this.value.y;

		// 8 directions past the threshold, 45 degrees each; a diagonal
		// presses two
		const { x, y } = this.value;
		const lean = Math.hypot(x, y);
		const directions = this.directions;
		if (lean < this.dpadThreshold) {
			directions.up = directions.down = false;
			directions.left = directions.right = false;
		} else {
			const sector = Math.round(Math.atan2(y, x) / (Math.PI / 4));
			// sectors: 0 right, 2 down, 4 / -4 left, -2 up
			directions.right = sector >= -1 && sector <= 1;
			directions.left = sector >= 3 || sector <= -3;
			directions.down = sector >= 1 && sector <= 3;
			directions.up = sector >= -3 && sector <= -1;
		}

		if (this.dpad) {
			this.pad.setButton(BUTTONS.UP, directions.up);
			this.pad.setButton(BUTTONS.DOWN, directions.down);
			this.pad.setButton(BUTTONS.LEFT, directions.left);
			this.pad.setButton(BUTTONS.RIGHT, directions.right);
		}
		this.keys.up.set(directions.up);
		this.keys.down.set(directions.down);
		this.keys.left.set(directions.left);
		this.keys.right.set(directions.right);
	}

	draw(renderer: Renderer, look: Look): void {
		const { x, y } = this.center;
		const r = this.radius;
		const held = this.pointerId !== null;
		const alpha = math.clamp(look.opacity * (held ? 2 : 1), 0, 1);
		renderer.setColor(look.color);
		renderer.setGlobalAlpha(alpha * 0.5);
		renderer.fillEllipse(x, y, r, r);
		renderer.setGlobalAlpha(alpha);
		renderer.strokeEllipse(x, y, r, r);
		const thumb = r * THUMB;
		renderer.fillEllipse(x + this.thumb.x, y + this.thumb.y, thumb, thumb);
	}
}

/**
 * Where the buttons gather from the bottom-right corner, in steps of a
 * button's width: across to the left, and up.
 */
const BUTTON_GRID = [
	[0, 0],
	[1, 0.55],
	[0, 1.1],
	[1, 1.65],
	[2, 0],
	[2, 1.1],
] as const;

const LABEL_FONT = "sans-serif";

/**
 * A button, pressed while a finger is on it.
 */
export class VirtualButton {
	/** the pad button it presses, or null */
	readonly button: number | null;
	/** its radius, in viewport pixels */
	radius = 0;
	/** where its center is, in viewport pixels */
	readonly center = { x: 0, y: 0 };

	private readonly options: ButtonOptions;
	private readonly order: number;
	private readonly key: KeyPress;
	private text: Text | null = null;
	private _label: string;
	private _visible = true;
	private _dimmed = false;
	/** the pointers on it: pressed while there is one */
	private readonly pointers = new Set<number>();

	constructor(
		options: ButtonOptions,
		order: number,
		private readonly pad: VirtualPad,
		private readonly changed: () => void,
	) {
		this.options = options;
		this.order = order;
		const faces = [
			BUTTONS.FACE_1,
			BUTTONS.FACE_2,
			BUTTONS.FACE_3,
			BUTTONS.FACE_4,
		];
		this.button =
			options.button !== undefined
				? options.button
				: options.key !== undefined
					? null
					: (faces[order] ?? null);
		this.key = new KeyPress(options.key);
		this._label = options.label ?? "";
	}

	/** whether a finger is on it */
	get pressed(): boolean {
		return this.pointers.size > 0;
	}

	/** the text shown on it */
	get label(): string {
		return this._label;
	}

	set label(value: string) {
		if (value !== this._label) {
			this._label = value;
			this.text?.setText(value);
			this.text?.setFont(LABEL_FONT, this.labelSize());
			this.changed();
		}
	}

	/**
	 * whether it is shown. A hidden button is not drawn and cannot be
	 * pressed, and lets go if it was.
	 */
	get visible(): boolean {
		return this._visible;
	}

	set visible(value: boolean) {
		if (value !== this._visible) {
			this._visible = value;
			if (!value) {
				this.releaseAll();
			}
			this.changed();
		}
	}

	/**
	 * whether it is drawn faded, as a button with nothing to do right now.
	 * It can still be pressed.
	 */
	get dimmed(): boolean {
		return this._dimmed;
	}

	set dimmed(value: boolean) {
		if (value !== this._dimmed) {
			this._dimmed = value;
			this.changed();
		}
	}

	/**
	 * place it in a viewport of this size, above `floor` (the right stick)
	 * @param width - the viewport width, in pixels
	 * @param height - the viewport height, in pixels
	 * @param margin - the space kept from the edges
	 * @param floor - the height taken by a right stick below the buttons
	 */
	layout(width: number, height: number, margin: number, floor: number): void {
		const short = Math.min(width, height);
		this.radius =
			this.options.radius ?? Math.max(18, Math.round(short * 0.075));
		let placement = this.options.position;
		if (placement === undefined) {
			const step = this.radius * 2 + Math.round(short * 0.02);
			const [across, up] = BUTTON_GRID[this.order % BUTTON_GRID.length];
			placement = {
				right: margin + this.radius + across * step,
				bottom: margin + floor + this.radius + up * step,
			};
		}
		const { x, y } = resolve(placement, width, height);
		this.center.x = x;
		this.center.y = y;
		if (this.text) {
			this.text.pos.set(x, y);
			this.text.setFont(LABEL_FONT, this.labelSize());
		}
	}

	/** a short label fills the button, a word is set smaller */
	private labelSize(): number {
		return Math.round(this.radius * (this._label.length > 2 ? 0.55 : 0.8));
	}

	/**
	 * whether a finger here is on it
	 * @param x - in viewport pixels
	 * @param y - in viewport pixels
	 */
	hits(x: number, y: number): boolean {
		return (
			this._visible &&
			Math.hypot(x - this.center.x, y - this.center.y) <= this.radius * 1.15
		);
	}

	/**
	 * @param pointerId - the pointer
	 */
	press(pointerId: number): void {
		this.pointers.add(pointerId);
		this.report();
	}

	/**
	 * @param pointerId - the pointer
	 */
	release(pointerId: number): void {
		if (this.pointers.delete(pointerId)) {
			this.report();
		}
	}

	releaseAll(): void {
		this.pointers.clear();
		this.report();
	}

	private report(): void {
		const pressed = this.pressed;
		if (this.button !== null) {
			this.pad.setButton(this.button, pressed);
		}
		this.key.set(pressed);
	}

	draw(renderer: Renderer, look: Look): void {
		if (!this._visible) {
			return;
		}
		const { x, y } = this.center;
		const r = this.radius;
		const alpha = math.clamp(
			look.opacity * (this.pressed ? 2 : 1) * (this._dimmed ? 0.4 : 1),
			0,
			1,
		);
		renderer.setColor(look.color);
		renderer.setGlobalAlpha(alpha * (this.pressed ? 0.8 : 0.5));
		renderer.fillEllipse(x, y, r, r);
		renderer.setGlobalAlpha(alpha);
		renderer.strokeEllipse(x, y, r, r);
		if (this._label !== "") {
			if (this.text === null) {
				this.text = new Text(x, y, {
					font: LABEL_FONT,
					size: this.labelSize(),
					fillStyle: look.color,
					textAlign: "center",
					textBaseline: "middle",
					bold: true,
					text: this._label,
				});
			}
			renderer.setGlobalAlpha(Math.min(1, alpha * 2));
			this.text.draw(renderer);
		}
	}

	destroy(): void {
		// `Text.destroy()` is internal, as a container normally calls it, but
		// this label is in none
		(this.text as unknown as { destroy(): void } | null)?.destroy();
		this.text = null;
	}
}
