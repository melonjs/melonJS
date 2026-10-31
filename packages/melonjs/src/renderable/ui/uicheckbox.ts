import type Camera2d from "../../camera/camera2d.ts";
import type Pointer from "../../input/pointer.ts";
import type Renderer from "../../video/renderer.js";
import type { Paint } from "./panelpaint.ts";
import { PanelPainter } from "./panelpaint.ts";
import UIBaseElement, { isPointerUp } from "./uibaseelement.ts";
import type { UILabel } from "./uilabel.ts";
import { createLabel } from "./uilabel.ts";
import type { UISkin } from "./uiskin.ts";
import { SkinDrawer } from "./uiskin.ts";

/**
 * The art of a skinned {@link UICheckbox}: one atlas region per state.
 * @category UI
 */
export interface UICheckboxSkin extends UISkin {
	/** the box when checked */
	on: string;
	/** the box when not checked */
	off: string;
	/** the box while disabled; the current one at half opacity if left out */
	disabled?: string;
}

/**
 * Everything {@link UICheckbox} takes.
 * @category UI
 */
export interface UICheckboxSettings {
	/**
	 * whether it starts checked
	 * @default false
	 */
	checked?: boolean;
	/** the text next to the box, whatever the state */
	label?: string;
	/** the text while checked, in place of `label` */
	labelOn?: string;
	/** the text while not checked, in place of `label` */
	labelOff?: string;
	/**
	 * Called when the user changes it, never when `checked` is set from code.
	 * See {@link UICheckbox#onChange}.
	 */
	onChange?: (checked: boolean, checkbox: UICheckbox) => void;
	/**
	 * whether it answers input
	 * @default true
	 */
	enabled?: boolean;
	/**
	 * the side of the box, in pixels; 24, or the height of the skin's `off`
	 * region
	 */
	size?: number;
	/**
	 * Make it one of a set of radio buttons: checkboxes sharing a group name
	 * have exactly one checked. See {@link UICheckbox#group}.
	 */
	group?: string;
	/**
	 * a CSS font family, or the name of a loaded bitmap font
	 * @default "sans-serif"
	 */
	font?: string;
	/** the label's height, in pixels; two thirds of `size` by default */
	fontSize?: number;
	/**
	 * the label's colour
	 * @default "#000000"
	 */
	labelFillStyle?: string;
	/**
	 * the space between the box and the label, in pixels
	 * @default 8
	 */
	labelGap?: number;
	/**
	 * the box's fill (drawn look)
	 * @default "#ffffff"
	 */
	boxColor?: Paint;
	/**
	 * the box's fill under the pointer (drawn look)
	 * @default "#e4eefb"
	 */
	hoverOnColor?: Paint;
	/**
	 * the box's fill when checked, and the radio dot (drawn look)
	 * @default "#2a7de1"
	 */
	checkColor?: Paint;
	/**
	 * the box's outline (drawn look)
	 * @default "#3a3a3a"
	 */
	borderColor?: Paint;
	/**
	 * the outline's thickness (drawn look)
	 * @default 2
	 */
	borderWidth?: number;
	/**
	 * the box's corner radius (drawn look); a radio button is round
	 * @default 4
	 */
	radius?: number;
	/** draw the box from atlas regions instead */
	skin?: UICheckboxSkin;
}

/** checkboxes by group name, while they are in the scene */
const groups = new Map<string, Set<UICheckbox>>();

/**
 * A box that can be checked, with a label next to it; with a `group`, a
 * radio button.
 *
 * Drawn with primitives by default, so it needs no art, or from atlas
 * regions through a {@link UICheckboxSkin}. The label is part of the
 * widget: clicking it toggles the box, and removing the widget takes it
 * along.
 *
 * Its state is {@link UICheckbox#checked}. The game hears about a change
 * through `onChange`, which only user input calls: restoring saved settings
 * by setting `checked` does not run the game logic attached to it.
 * @category UI
 * @example
 * const music = new UICheckbox(40, 60, {
 *     labelOn: "Music ON",
 *     labelOff: "Music OFF",
 *     checked: settings.music,
 *     onChange: (on) => {
 *         settings.music = on;
 *         on ? audio.playTrack("theme") : audio.stopTrack();
 *     },
 * });
 * panel.addChild(music);
 *
 * // three radio buttons, one checked at a time
 * for (const [i, level] of ["Easy", "Normal", "Hard"].entries()) {
 *     panel.addChild(new UICheckbox(40, 120 + i * 32, {
 *         label: level,
 *         group: "difficulty",
 *         checked: level === "Normal",
 *     }));
 * }
 * const chosen = UICheckbox.checkedIn("difficulty");
 */
export default class UICheckbox extends UIBaseElement {
	/**
	 * Called when the user checks or unchecks it, with the new state.
	 *
	 * Never called when {@link UICheckbox#checked} is set, or
	 * {@link UICheckbox#toggle} is called, from code. In a radio group only
	 * the button the user picked is told; the one that was unchecked to make
	 * room is not, as with radio buttons in a web page.
	 */
	onChange: ((checked: boolean, checkbox: UICheckbox) => void) | undefined;

	/**
	 * The radio group this checkbox belongs to, if any.
	 *
	 * Checkboxes sharing a group have exactly one checked: checking one
	 * unchecks the others, and clicking the checked one leaves it checked. A
	 * checkbox is in its group while it is in the scene; removing it takes it
	 * out. Changing this property takes effect the next time it is added.
	 */
	group: string | undefined;

	/** the box's fill (drawn look) */
	boxColor: Paint;
	/** the box's fill under the pointer (drawn look) */
	hoverOnColor: Paint;
	/** the box's fill when checked, and the radio dot (drawn look) */
	checkColor: Paint;
	/** the box's outline (drawn look) */
	borderColor: Paint;
	/** the outline's thickness (drawn look) */
	borderWidth: number;
	/** the box's corner radius (drawn look) */
	radius: number;

	/** the side of the box, in pixels */
	readonly boxSize: number;
	/** the space between the box and the label, in pixels */
	readonly labelGap: number;
	/** the label, absent when there is no text */
	readonly label: UILabel | undefined;
	/** the art, when it is skinned */
	readonly skin: UICheckboxSkin | undefined;

	/** @ignore */
	private _checked: boolean;
	/** @ignore */
	private _enabled = true;
	/** @ignore */
	private readonly _labelOn: string;
	/** @ignore */
	private readonly _labelOff: string;
	/** @ignore */
	private readonly _painter = new PanelPainter();
	/** @ignore */
	private readonly _skin: SkinDrawer | undefined;
	/** @ignore */
	private _joined: string | undefined;

	/**
	 * @param x - left edge
	 * @param y - top edge
	 * @param settings - see {@link UICheckboxSettings}
	 */
	constructor(x: number, y: number, settings: UICheckboxSettings = {}) {
		super(x, y, 1, 1);

		this.skin = settings.skin;
		let size = settings.size;
		if (this.skin !== undefined) {
			this._skin = new SkinDrawer(this.skin);
			const off = this._skin.size(this.skin.off);
			this._skin.size(this.skin.on);
			if (this.skin.disabled !== undefined) {
				this._skin.size(this.skin.disabled);
			}
			size ??= off.height;
		}
		this.boxSize = size ?? 24;
		this.labelGap = settings.labelGap ?? 8;

		this._checked = settings.checked ?? false;
		this.onChange = settings.onChange;
		this.group = settings.group;

		this.boxColor = settings.boxColor ?? "#ffffff";
		this.hoverOnColor = settings.hoverOnColor ?? "#e4eefb";
		this.checkColor = settings.checkColor ?? "#2a7de1";
		this.borderColor = settings.borderColor ?? "#3a3a3a";
		this.borderWidth = settings.borderWidth ?? 2;
		this.radius = settings.radius ?? 4;

		this._labelOn = settings.labelOn ?? settings.label ?? "";
		this._labelOff = settings.labelOff ?? settings.label ?? "";

		let width = this.boxSize;
		let height = this.boxSize;
		if (this._labelOn !== "" || this._labelOff !== "") {
			const label = createLabel({
				text: this._checked ? this._labelOn : this._labelOff,
				font: settings.font ?? "sans-serif",
				fontSize:
					settings.fontSize ?? Math.round(Math.max(12, this.boxSize * 0.66)),
				fillStyle: settings.labelFillStyle ?? "#000000",
				textAlign: "left",
				textBaseline: "middle",
			});
			// as wide as the longer of the two texts, so the widget does not
			// change size, and move what is laid out after it, as it toggles
			const on = label.measureText(this._labelOn);
			const off = label.measureText(this._labelOff);
			width += this.labelGap + Math.max(on.width, off.width);
			height = Math.max(height, on.height, off.height);
			this.label = label;
		}
		this.resize(Math.ceil(width), Math.ceil(height));

		this.enabled = settings.enabled ?? true;
	}

	/**
	 * Whether it is checked.
	 *
	 * Setting it updates the look WITHOUT calling `onChange`, so restoring
	 * saved settings does not trigger the game logic that a click would.
	 * Checking a radio button unchecks the others in its group.
	 */
	get checked(): boolean {
		return this._checked;
	}

	set checked(value: boolean) {
		if (value === this._checked) {
			return;
		}
		this._checked = value;
		if (value) {
			this.uncheckOthers();
		}
		this.label?.setText(value ? this._labelOn : this._labelOff);
		this.isDirty = true;
	}

	/**
	 * Flip it, from code. Like setting {@link UICheckbox#checked}, this does
	 * not call `onChange`.
	 * @returns the new state
	 */
	toggle(): boolean {
		this.checked = !this._checked;
		return this._checked;
	}

	/**
	 * Whether it answers input.
	 *
	 * A disabled checkbox is drawn with its `disabled` skin region, or at
	 * half opacity, and ignores the pointer.
	 * @default true
	 */
	get enabled(): boolean {
		return this._enabled;
	}

	set enabled(value: boolean) {
		this._enabled = value;
		this.isClickable = value;
		if (!value) {
			this.cancelPress();
		}
		this.isDirty = true;
	}

	/**
	 * The checked checkbox of a radio group.
	 * @param group - the group name
	 * @returns the checked member in the scene, or undefined
	 */
	static checkedIn(group: string): UICheckbox | undefined {
		const members = groups.get(group);
		if (members !== undefined) {
			for (const member of members) {
				if (member.checked) {
					return member;
				}
			}
		}
		return undefined;
	}

	/**
	 * Uncheck the rest of the group, silently.
	 * @ignore
	 * @internal
	 */
	private uncheckOthers() {
		if (this._joined === undefined) {
			return;
		}
		const members = groups.get(this._joined);
		if (members === undefined) {
			return;
		}
		for (const member of members) {
			if (member !== this && member._checked) {
				member._checked = false;
				member.label?.setText(member._labelOff);
				member.isDirty = true;
			}
		}
	}

	/**
	 * Toggle on a completed click: pressed and released over the widget.
	 * @ignore
	 * @internal
	 */
	override release(event: Pointer): boolean | void {
		const completed = !this.released && isPointerUp(event);
		const result = super.release(event);
		if (completed && this._enabled) {
			// a radio button that is already checked stays checked
			if (!(this._checked && this._joined !== undefined)) {
				this.checked = !this._checked;
				this.onChange?.(this._checked, this);
			}
		}
		return result;
	}

	/**
	 * Join its group.
	 * @ignore
	 */
	override onActivateEvent(): void {
		super.onActivateEvent();
		if (this.group !== undefined) {
			let members = groups.get(this.group);
			if (members === undefined) {
				members = new Set();
				groups.set(this.group, members);
			}
			members.add(this);
			this._joined = this.group;
			// the newest checked member wins
			if (this._checked) {
				this.uncheckOthers();
			}
		}
	}

	/**
	 * Leave its group.
	 * @ignore
	 */
	override onDeactivateEvent(): void {
		if (this._joined !== undefined) {
			const members = groups.get(this._joined);
			members?.delete(this);
			if (members?.size === 0) {
				groups.delete(this._joined);
			}
			this._joined = undefined;
		}
		super.onDeactivateEvent();
	}

	/**
	 * Draw the box, then the label.
	 * @param renderer - the renderer to draw with
	 * @param viewport - the camera being drawn through
	 */
	override draw(renderer: Renderer, viewport?: Camera2d) {
		const alpha = renderer.globalAlpha();
		const size = this.boxSize;
		const x = this.pos.x;
		const y = this.pos.y + (this.height - size) / 2;
		const faded = alpha * 0.5;

		if (this._skin !== undefined) {
			const skin = this.skin!;
			let region = this._checked ? skin.on : skin.off;
			if (!this._enabled) {
				if (skin.disabled !== undefined) {
					region = skin.disabled;
				} else {
					renderer.setGlobalAlpha(faded);
				}
			}
			this._skin.draw(renderer, region, x, y, size, size);
		} else {
			this.drawBox(renderer, x, y, size, this._enabled ? alpha : faded);
		}

		if (this.label !== undefined) {
			const lx = x + size + this.labelGap;
			const ly = this.pos.y + this.height / 2;
			if (this.label.pos.x !== lx || this.label.pos.y !== ly) {
				this.label.setPosition(lx, ly);
			}
			renderer.setGlobalAlpha(this._enabled ? alpha : faded);
			this.label.preDraw(renderer);
			this.label.draw(renderer);
			this.label.postDraw(renderer);
		}
		renderer.setGlobalAlpha(alpha);
		super.draw(renderer, viewport);
	}

	/**
	 * The drawn box: square with a tick, or round with a dot for a radio
	 * button.
	 * @ignore
	 * @internal
	 */
	private drawBox(
		renderer: Renderer,
		x: number,
		y: number,
		size: number,
		alpha: number,
	) {
		const painter = this._painter;
		const fill =
			this._checked && this.group === undefined
				? this.checkColor
				: this.hover && this._enabled
					? this.hoverOnColor
					: this.boxColor;
		const half = size / 2;

		if (this.group !== undefined) {
			// a radio button
			painter.paint(renderer, fill, alpha);
			renderer.fillEllipse(x + half, y + half, half, half);
			if (this.borderWidth > 0) {
				const previous = renderer.lineWidth;
				renderer.lineWidth = this.borderWidth;
				painter.paint(renderer, this.borderColor, alpha);
				const r = half - this.borderWidth / 2;
				renderer.strokeEllipse(x + half, y + half, r, r);
				renderer.lineWidth = previous;
			}
			if (this._checked) {
				painter.paint(renderer, this.checkColor, alpha);
				const dot = size * 0.25;
				renderer.fillEllipse(x + half, y + half, dot, dot);
			}
			return;
		}

		painter.paint(renderer, fill, alpha);
		painter.rect(renderer, x, y, size, size, this.radius);
		if (this.borderWidth > 0) {
			painter.paint(
				renderer,
				this._checked ? this.checkColor : this.borderColor,
				alpha,
			);
			painter.border(renderer, x, y, size, size, this.radius, this.borderWidth);
		}
		if (this._checked) {
			// a tick, in the box colour over the checked fill
			const previous = renderer.lineWidth;
			renderer.lineWidth = Math.max(2, size / 8);
			painter.paint(renderer, this.boxColor, alpha);
			renderer.strokeLine(
				x + size * 0.24,
				y + size * 0.52,
				x + size * 0.42,
				y + size * 0.7,
			);
			renderer.strokeLine(
				x + size * 0.42,
				y + size * 0.7,
				x + size * 0.76,
				y + size * 0.32,
			);
			renderer.lineWidth = previous;
		}
	}

	/**
	 * Hand back what it borrowed.
	 * @ignore
	 */
	override onDestroyEvent() {
		this._painter.dispose();
		this._skin?.dispose();
		this.label?.destroy();
		super.onDestroyEvent();
	}
}
