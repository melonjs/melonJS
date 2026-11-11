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
 *
 * Only `on` and `off` are needed. Each region is drawn as a square of
 * {@link UICheckboxSettings#boxSize} pixels (the height of `off` by
 * default). Every region named is looked up when the checkbox is built, so
 * a misspelt name throws there.
 * @category UI
 * @example
 * // two regions: the rest fall back to them
 * const skin = { atlas, on: "green_boxCheckmark", off: "grey_boxCheckmark" };
 */
export interface UICheckboxSkin extends UISkin {
	/** the region drawn when checked */
	on: string;
	/** the region drawn when not checked */
	off: string;
	/** the region drawn when checked and under the pointer; `on` if left out */
	hoverOn?: string;
	/**
	 * the region drawn when not checked and under the pointer; `off` if left
	 * out
	 */
	hoverOff?: string;
	/**
	 * the region drawn when checked and disabled; `on` at half opacity if
	 * left out
	 */
	disabledOn?: string;
	/**
	 * the region drawn when not checked and disabled; `off` at half opacity
	 * if left out
	 */
	disabledOff?: string;
}

/**
 * The settings {@link UICheckbox} takes. All are optional.
 *
 * The colour settings are for the drawn look and are ignored when a `skin`
 * is given.
 * @category UI
 */
export interface UICheckboxSettings extends UIJuiceSettings {
	/**
	 * whether it starts checked
	 * @default false
	 */
	checked?: boolean;
	/**
	 * the text next to the box, the same in both states; `labelOn` and
	 * `labelOff` replace it for one state each
	 */
	label?: string;
	/** the text while checked; `label` if left out */
	labelOn?: string;
	/** the text while not checked; `label` if left out */
	labelOff?: string;
	/**
	 * Called with the new state when the user checks or unchecks it (click,
	 * tap, or Enter with the focus). Never called when `checked` is set or
	 * `toggle()` is called from code. See {@link UICheckbox#onChange}.
	 */
	onChange?: (checked: boolean, checkbox: UICheckbox) => void;
	/**
	 * whether it answers input; a disabled checkbox is drawn faded, or with
	 * the skin's `disabledOn` / `disabledOff` regions
	 * @default true
	 */
	enabled?: boolean;
	/**
	 * the side of the box, in pixels; with a skin, the height of its `off`
	 * region by default
	 * @default 24
	 */
	boxSize?: number;
	/**
	 * a radio group name: checkboxes sharing it have one checked at a time,
	 * and are drawn round. See {@link UICheckbox#group}.
	 */
	group?: string;
	/**
	 * a CSS font family, or the name of a loaded bitmap font
	 * @default "sans-serif"
	 */
	font?: string;
	/**
	 * the label's text height, in pixels; two thirds of `boxSize`, and at
	 * least 12, by default
	 */
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
	 * the box's fill when not checked (drawn look); also the tick's colour
	 * @default "#ffffff"
	 */
	boxColor?: Paint;
	/**
	 * the box's fill when not checked and under the pointer (drawn look)
	 * @default "#e4eefb"
	 */
	boxHoverColor?: Paint;
	/**
	 * the box's fill and outline when checked, and a radio button's dot
	 * (drawn look)
	 * @default "#2a7de1"
	 */
	checkColor?: Paint;
	/**
	 * the box's outline when not checked (drawn look)
	 * @default "#3a3a3a"
	 */
	borderColor?: Paint;
	/**
	 * the outline's thickness, in pixels (drawn look); `0` for none
	 * @default 2
	 */
	borderWidth?: number;
	/**
	 * the box's corner radius, in pixels (drawn look); ignored by a radio
	 * button, which is round
	 * @default 4
	 */
	radius?: number;
	/** draw the box from atlas regions instead of the drawn look */
	skin?: UICheckboxSkin;
}

/**
 * checkboxes by group name, from when they are made until they are
 * destroyed; held weakly, so a checkbox dropped without being destroyed can
 * still be collected
 */
const groups = new Map<string, Set<WeakRef<UICheckbox>>>();

/**
 * the live members of a group, dropping the ones collected since
 * @param name - the group name
 * @yields {UICheckbox} each member still alive
 */
function* membersOf(name: string): Generator<UICheckbox> {
	const refs = groups.get(name);
	if (refs === undefined) {
		return;
	}
	for (const ref of refs) {
		const member = ref.deref();
		if (member === undefined) {
			refs.delete(ref);
		} else {
			yield member;
		}
	}
	if (refs.size === 0) {
		groups.delete(name);
	}
}

/**
 * A checkbox with a text label, for an on/off option such as music, sound
 * or full screen. Give several the same `group` and they become radio
 * buttons: one choice out of a few, such as a difficulty level.
 *
 * ## Look
 * - Drawn with shapes by default, so it needs no art: a square with a tick,
 *   or a circle with a dot for a radio button. The colour settings
 *   (`boxColor`, `checkColor`, `borderColor`...) change it.
 * - Skinned: pass a {@link UICheckboxSkin} of atlas regions, one per state
 *   (`on`, `off`, and optionally `hoverOn`, `hoverOff`, `disabledOn`,
 *   `disabledOff`).
 *
 * ## Label
 * `label` is the text next to the box. `labelOn` and `labelOff` give it a
 * different text in each state ("Music ON" / "Music OFF"). The
 * {@link UICheckbox#labelOn} and {@link UICheckbox#labelOff} properties
 * change the text later, and the widget resizes to fit. It is as wide as the box
 * plus the longer of the two texts, so it does not change size as it
 * toggles. The label is part of the widget: clicking it toggles the box too.
 *
 * ## State and onChange
 * The state is {@link UICheckbox#checked}. `onChange` is called only when
 * the player changes it. Setting `checked`, or calling `toggle()`, from code
 * never calls it: restore saved settings by setting `checked`, without
 * running the code a click would (starting the music twice, saving again).
 *
 * ## Radio groups
 * Checkboxes with the same {@link UICheckbox#group} name have one checked
 * at a time: checking one unchecks the others, and clicking the checked one
 * leaves it checked. A checkbox belongs to its group from the moment it is
 * made until it is destroyed (removing it from the world for good destroys
 * it), so the group holds one choice before it is ever shown, and
 * {@link UICheckbox.checkedIn} answers straight away. A checked one joining
 * a group unchecks the others already there.
 *
 * ## Keyboard and gamepad
 * It can take the focus ({@link UIBaseElement#focus}). With the focus,
 * Enter, Space or the pad's A button toggles it, as a click does, and calls
 * `onChange`.
 *
 * Set `enabled` to `false` to turn it off: it ignores input and is drawn
 * faded, or with the skin's disabled regions.
 * @category UI
 * @example
 * // a settings toggle, drawn, with no assets
 * const subtitles = new UICheckbox(40, 60, {
 *     label: "Subtitles",
 *     checked: settings.subtitles,
 *     onChange: (on) => {
 *         settings.subtitles = on;
 *     },
 * });
 * panel.addChild(subtitles);
 * @example
 * // a label that follows the state
 * const music = new UICheckbox(40, 100, {
 *     labelOn: "Music ON",
 *     labelOff: "Music OFF",
 *     checked: true,
 *     onChange: (on) => {
 *         on ? audio.playTrack("theme") : audio.stopTrack();
 *     },
 * });
 * panel.addChild(music);
 * @example
 * // a radio group, and reading the choice
 * const levels = new Map();
 * for (const [i, level] of ["easy", "normal", "hard"].entries()) {
 *     const radio = new UICheckbox(40, 140 + i * 32, {
 *         label: level,
 *         group: "difficulty",
 *         checked: level === "normal",
 *         onChange: () => console.log("picked", level),
 *     });
 *     levels.set(radio, level);
 *     panel.addChild(radio);
 * }
 * // later, e.g. when OK is clicked
 * const difficulty = levels.get(UICheckbox.checkedIn("difficulty"));
 * @example
 * // skinned from an atlas, with a bitmap font
 * const sfx = new UICheckbox(40, 260, {
 *     label: "Sound effects",
 *     font: "kenpixel",
 *     fontSize: 14,
 *     skin: { atlas, on: "green_boxCheckmark", off: "grey_boxCheckmark" },
 * });
 * @example
 * // restoring saved settings without calling onChange
 * save.add({ music: true });
 * music.checked = save.music; // the look updates, onChange is not called
 * save.music ? audio.playTrack("theme") : audio.stopTrack(); // applied once
 */
export default class UICheckbox extends UIBaseElement {
	/**
	 * Called with the new state when the user checks or unchecks it: a
	 * click or tap on the box or its label, or Enter, Space or the pad's A
	 * with the focus.
	 *
	 * Never called when {@link UICheckbox#checked} is set, or
	 * {@link UICheckbox#toggle} is called, from code. In a radio group only
	 * the button the user picked is called; the one unchecked to make room
	 * is not. Not called while the checkbox is disabled.
	 * @example
	 * sfx.onChange = (on) => {
	 *     settings.sfx = on;
	 * };
	 */
	onChange: ((checked: boolean, checkbox: UICheckbox) => void) | undefined;

	/**
	 * The radio group this checkbox belongs to, or `undefined` for a plain
	 * checkbox.
	 *
	 * Checkboxes sharing a group have one checked at a time: checking one
	 * unchecks the others, and clicking the checked one leaves it checked.
	 * A radio button is drawn round, with a dot. A checkbox is in its group
	 * from when it is made until it is destroyed. Changing `group`
	 * moves it to the new group straight away, and if it is checked it
	 * unchecks the others there.
	 */
	get group(): string | undefined {
		return this._group;
	}

	set group(value: string | undefined) {
		if (value === this._group) {
			return;
		}
		this.leaveGroup();
		this._group = value;
		this.joinGroup();
		this.isDirty = true;
	}

	/** the box's fill when not checked, and the tick's colour (drawn look) */
	boxColor: Paint;
	/** the box's fill when not checked and under the pointer (drawn look) */
	boxHoverColor: Paint;
	/**
	 * the box's fill and outline when checked, and a radio button's dot
	 * (drawn look)
	 */
	checkColor: Paint;
	/** the box's outline when not checked (drawn look) */
	borderColor: Paint;
	/** the outline's thickness, in pixels (drawn look); `0` for none */
	borderWidth: number;
	/** the box's corner radius, in pixels (drawn look; not for a radio button) */
	radius: number;

	/** the side of the box, in pixels */
	readonly boxSize: number;
	/** the space between the box and the label, in pixels */
	readonly labelGap: number;
	/**
	 * The text object drawn next to the box, or `undefined` when there is no
	 * text. Change the text through {@link UICheckbox#labelOn} and
	 * {@link UICheckbox#labelOff}, which also resize the widget.
	 */
	label: UILabel | undefined;
	/** the atlas regions it is drawn from, or `undefined` for the drawn look */
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
	/** how its group holds it */
	private readonly _ref = new WeakRef<UICheckbox>(this);
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
		// in its group from now on, so the group holds one choice before
		// it is ever added to the scene
		this.joinGroup();

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
	 * Setting it updates the look and the label, and does NOT call
	 * `onChange`: restoring saved settings this way does not run the code a
	 * click would. Checking a radio button unchecks the others in its group,
	 * silently too.
	 * @example
	 * // show the saved state when the menu opens
	 * music.checked = save.music;
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
	 * The text shown while checked. Setting it updates the label and
	 * resizes the widget to fit; set both this and
	 * {@link UICheckbox#labelOff} to change a single `label`.
	 * @example
	 * music.labelOn = "Music: on";
	 * music.labelOff = "Music: off";
	 */
	get labelOn(): string {
		return this._labelOn;
	}

	set labelOn(value: string) {
		this._labelOn = value;
		this.fitLabel();
	}

	/**
	 * The text shown while not checked. Setting it updates the label and
	 * resizes the widget to fit.
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
			// read straight away: for the label's current string `measureText`
			// re-measures into the label's own metrics, which a later call
			// for that string would overwrite
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
	 * Flip it from code, as a click would. Like setting
	 * {@link UICheckbox#checked}, this does not call `onChange`. A checked
	 * radio button stays checked, as it does when clicked; set `checked` to
	 * `false` to uncheck it on purpose.
	 * @returns the new state
	 */
	toggle(): boolean {
		if (this._checked && this._group !== undefined) {
			return true;
		}
		this.checked = !this._checked;
		return this._checked;
	}

	/**
	 * The checked checkbox of a radio group: the player's choice.
	 *
	 * It answers as soon as the checkboxes are made, before they are added
	 * to the world.
	 * @param group - the group name
	 * @returns the checked member, or `undefined` when none is checked
	 * @example
	 * const picked = UICheckbox.checkedIn("difficulty");
	 * console.log(picked?.labelOn); // the text of the checked radio button
	 */
	static checkedIn(group: string): UICheckbox | undefined {
		for (const member of membersOf(group)) {
			if (member._checked) {
				return member;
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
		for (const member of membersOf(this._joined)) {
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
	 * Enter, Space or the pad's A let go with the focus here: toggle, and
	 * call `onChange`, as a click does.
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
		members.add(this._ref);
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
		members?.delete(this._ref);
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
		this.leaveGroup();
		this._painter.dispose();
		this._skin?.dispose();
		this.label?.destroy();
		super.onDestroyEvent();
	}
}
