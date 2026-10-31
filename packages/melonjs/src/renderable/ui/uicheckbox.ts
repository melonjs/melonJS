import type Camera2d from "../../camera/camera2d.ts";
import type Pointer from "../../input/pointer.ts";
import type Renderer from "../../video/renderer.js";
import type { Paint } from "./panelpaint.ts";
import { PanelPainter } from "./panelpaint.ts";
import type { UIJuiceSettings } from "./uibaseelement.ts";
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
	/** the checked box under the pointer; `on` if left out */
	hoverOn?: string;
	/** the unchecked box under the pointer; `off` if left out */
	hoverOff?: string;
	/** the checked box while disabled; `on` at half opacity if left out */
	disabledOn?: string;
	/** the unchecked box while disabled; `off` at half opacity if left out */
	disabledOff?: string;
}

/**
 * Everything {@link UICheckbox} takes.
 * @category UI
 */
export interface UICheckboxSettings extends UIJuiceSettings {
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
	boxSize?: number;
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
	/** the label's height, in pixels; two thirds of `boxSize` by default */
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
	boxHoverColor?: Paint;
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
	 * out. Changing it moves the checkbox to the new group straight away;
	 * a checked one then unchecks the others there.
	 */
	get group(): string | undefined {
		return this._group;
	}

	set group(value: string | undefined) {
		if (value === this._group) {
			return;
		}
		const active = this._active;
		if (active) {
			this.leaveGroup();
		}
		this._group = value;
		if (active) {
			this.joinGroup();
		}
		this.isDirty = true;
	}

	/** the box's fill (drawn look) */
	boxColor: Paint;
	/** the box's fill under the pointer (drawn look) */
	boxHoverColor: Paint;
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
	label: UILabel | undefined;
	/** the art, when it is skinned */
	readonly skin: UICheckboxSkin | undefined;

	/** @ignore */
	private _checked: boolean;
	/** @ignore */
	private _labelOn: string;
	/** @ignore */
	private _labelOff: string;
	/** how a label is made, for one added after construction */
	private readonly _labelStyle: {
		font: string;
		fontSize: number;
		fillStyle: string;
	};
	/** @ignore */
	private _group: string | undefined;
	/** whether it is in the scene */
	private _active = false;
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
		let size = settings.boxSize;
		if (this.skin !== undefined) {
			this._skin = new SkinDrawer(this.skin);
			const off = this._skin.size(this.skin.off);
			// every region named is checked now, so a typo fails here
			for (const state of [
				"on",
				"hoverOn",
				"hoverOff",
				"disabledOn",
				"disabledOff",
			] as const) {
				const region = this.skin[state];
				if (region !== undefined) {
					this._skin.size(region);
				}
			}
			size ??= off.height;
		}
		this.boxSize = size ?? 24;
		this.labelGap = settings.labelGap ?? 8;

		this._checked = settings.checked ?? false;
		this.onChange = settings.onChange;
		this._group = settings.group;

		this.boxColor = settings.boxColor ?? "#ffffff";
		this.boxHoverColor = settings.boxHoverColor ?? "#e4eefb";
		this.checkColor = settings.checkColor ?? "#2a7de1";
		this.borderColor = settings.borderColor ?? "#3a3a3a";
		this.borderWidth = settings.borderWidth ?? 2;
		this.radius = settings.radius ?? 4;

		this._labelOn = settings.labelOn ?? settings.label ?? "";
		this._labelOff = settings.labelOff ?? settings.label ?? "";
		this._labelStyle = {
			font: settings.font ?? "sans-serif",
			fontSize:
				settings.fontSize ?? Math.round(Math.max(12, this.boxSize * 0.66)),
			fillStyle: settings.labelFillStyle ?? "#000000",
		};
		this.fitLabel();

		this.focusable = true;
		this.hoverScale = settings.hoverScale ?? 1;
		this.pressScale = settings.pressScale ?? 1;
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
	 * The text while checked. Setting it resizes the widget to fit.
	 */
	get labelOn(): string {
		return this._labelOn;
	}

	set labelOn(value: string) {
		this._labelOn = value;
		this.fitLabel();
	}

	/**
	 * The text while not checked. Setting it resizes the widget to fit.
	 */
	get labelOff(): string {
		return this._labelOff;
	}

	set labelOff(value: string) {
		this._labelOff = value;
		this.fitLabel();
	}

	/**
	 * Show the current text, and size the widget to the box and the longer
	 * of the two texts, so it keeps its size, and does not move what is laid
	 * out after it, as it toggles.
	 * @ignore
	 * @internal
	 */
	private fitLabel() {
		let width = this.boxSize;
		let height = this.boxSize;
		if (this._labelOn !== "" || this._labelOff !== "") {
			const text = this._checked ? this._labelOn : this._labelOff;
			if (this.label === undefined) {
				this.label = createLabel({
					...this._labelStyle,
					text,
					textAlign: "left",
					textBaseline: "middle",
				});
			} else {
				this.label.setText(text);
			}
			// read straight away: `measureText` hands back the same object
			// each time, so a second call overwrites the first
			let metrics = this.label.measureText(this._labelOn);
			const onWidth = metrics.width;
			const onHeight = metrics.height;
			metrics = this.label.measureText(this._labelOff);
			width += this.labelGap + Math.max(onWidth, metrics.width);
			height = Math.max(height, onHeight, metrics.height);
		} else if (this.label !== undefined) {
			this.label.destroy();
			this.label = undefined;
		}
		this.resize(Math.ceil(width), Math.ceil(height));
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
		if (completed) {
			this.userToggle();
		}
		return result;
	}

	/**
	 * Accept let go with the focus here: toggle, as a click does.
	 */
	override focusRelease(): void {
		const pressed = !this.released;
		super.focusRelease();
		if (pressed) {
			this.userToggle();
		}
	}

	/**
	 * Toggle as the user, telling `onChange`; a checked radio button stays
	 * checked.
	 * @ignore
	 * @internal
	 */
	private userToggle() {
		if (!this._enabled || (this._checked && this._joined !== undefined)) {
			return;
		}
		this.checked = !this._checked;
		this.onChange?.(this._checked, this);
	}

	/**
	 * Join its group.
	 * @ignore
	 */
	override onActivateEvent(): void {
		super.onActivateEvent();
		this._active = true;
		this.joinGroup();
	}

	/**
	 * Leave its group.
	 * @ignore
	 */
	override onDeactivateEvent(): void {
		this._active = false;
		this.leaveGroup();
		super.onDeactivateEvent();
	}

	/**
	 * Join the group it names, if any; the newest checked member wins.
	 * @ignore
	 * @internal
	 */
	private joinGroup() {
		if (this._group === undefined) {
			return;
		}
		let members = groups.get(this._group);
		if (members === undefined) {
			members = new Set();
			groups.set(this._group, members);
		}
		members.add(this);
		this._joined = this._group;
		if (this._checked) {
			this.uncheckOthers();
		}
	}

	/**
	 * Leave the group it is in, if any.
	 * @ignore
	 * @internal
	 */
	private leaveGroup() {
		if (this._joined === undefined) {
			return;
		}
		const members = groups.get(this._joined);
		members?.delete(this);
		if (members?.size === 0) {
			groups.delete(this._joined);
		}
		this._joined = undefined;
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
			const on = this._checked;
			let region = on ? skin.on : skin.off;
			if (!this._enabled) {
				const disabled = on ? skin.disabledOn : skin.disabledOff;
				if (disabled !== undefined) {
					region = disabled;
				} else {
					renderer.setGlobalAlpha(faded);
				}
			} else if (this.hover) {
				region = (on ? skin.hoverOn : skin.hoverOff) ?? region;
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
					? this.boxHoverColor
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
