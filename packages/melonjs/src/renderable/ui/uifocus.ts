import { GAMEPAD, readGamepads } from "../../input/gamepad.ts";
import { KEY } from "../../input/key.ts";
import {
	GAME_BEFORE_UPDATE,
	KEYDOWN,
	KEYUP,
	off,
	on,
	POINTERMOVE,
} from "../../system/event.ts";
import type Renderable from "../renderable.js";
import type UIBaseElement from "./uibaseelement.ts";

/**
 * A direction the player moves the focus in.
 * @category UI
 */
export type UINavAction = "up" | "down" | "left" | "right";

/** the directions, as unit steps */
const DIRECTIONS: Record<UINavAction, [number, number]> = {
	up: [0, -1],
	down: [0, 1],
	left: [-1, 0],
	right: [1, 0],
};

/** the key for each direction */
const KEYS: Record<UINavAction, number> = {
	up: KEY.UP,
	down: KEY.DOWN,
	left: KEY.LEFT,
	right: KEY.RIGHT,
};

/** the keys that press the focused widget */
const ACCEPT_KEYS: readonly number[] = [KEY.ENTER, KEY.SPACE];

/**
 * Keyboard and gamepad navigation for UI elements, for a game played
 * without a mouse or a touch screen.
 *
 * One widget has the focus. The arrow keys or a pad's D-pad move it to the
 * nearest widget in that direction, Enter, Space or the pad's A button press
 * it as a click does, and a slider steps on left and right. A ring shows
 * which widget has the focus once a key or the pad is used, and the mouse
 * moving hides it. A focused widget in a scrolling panel is scrolled into
 * view.
 *
 * Off until {@link UIFocus.enable} is called, so a game that steers with the
 * arrow keys is not surprised. Buttons, checkboxes and sliders take part; a
 * widget of your own sets `focusable`.
 * @category UI
 * @example
 * UIFocus.enable();        // in the stage's onResetEvent
 * UIFocus.disable();       // and in its onDestroyEvent
 */
// one focus per page: a class of statics, documented as one API like `state`
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export default class UIFocus {
	/** the colour of the ring around the focused widget */
	static ringColor = "#ffcc33";

	/** whether navigation is on */
	private static _enabled = false;
	/** the focusable elements in the scene */
	private static readonly _elements = new Set<UIBaseElement>();
	/** the focused element */
	private static _focused: UIBaseElement | undefined;
	/** whether the ring shows: after keyboard or pad input, until the mouse */
	private static _ringVisible = false;
	/** the input holding accept down, if any */
	private static _accept: "key" | "pad" | undefined;
	/** the pad's state on the last frame */
	private static readonly _pad = { held: "", accept: false };

	/**
	 * Turn keyboard and gamepad navigation on.
	 */
	static enable(): void {
		if (UIFocus._enabled) {
			return;
		}
		UIFocus._enabled = true;
		on(KEYDOWN, UIFocus._onKeyDown);
		on(KEYUP, UIFocus._onKeyUp);
		on(POINTERMOVE, UIFocus._onPointer);
		on(GAME_BEFORE_UPDATE, UIFocus._onFrame);
	}

	/**
	 * Turn it off again, dropping the focus.
	 */
	static disable(): void {
		if (!UIFocus._enabled) {
			return;
		}
		UIFocus._enabled = false;
		off(KEYDOWN, UIFocus._onKeyDown);
		off(KEYUP, UIFocus._onKeyUp);
		off(POINTERMOVE, UIFocus._onPointer);
		off(GAME_BEFORE_UPDATE, UIFocus._onFrame);
		UIFocus.focus(undefined);
	}

	/** whether navigation is on */
	static get enabled(): boolean {
		return UIFocus._enabled;
	}

	/** the element with the focus, if any */
	static get focused(): UIBaseElement | undefined {
		return UIFocus._focused;
	}

	/** whether the focus ring is showing */
	static get ringVisible(): boolean {
		return UIFocus._ringVisible;
	}

	/**
	 * Give an element the focus, or take it away with `undefined`: to choose
	 * where navigation starts, say. A scrolling panel holding the element
	 * scrolls it into view.
	 * @param element - the element to focus
	 */
	static focus(element: UIBaseElement | undefined): void {
		if (UIFocus._focused === element) {
			return;
		}
		if (UIFocus._focused !== undefined) {
			UIFocus._focused.isDirty = true;
		}
		UIFocus._accept = undefined;
		UIFocus._focused = element;
		if (element !== undefined) {
			element.isDirty = true;
			UIFocus.scrollIntoView(element);
		}
	}

	/**
	 * Move the focus as an arrow key would, for input of the game's own. The
	 * focused widget is asked first, through `onNavigate`, so a slider steps
	 * instead. With nothing focused, the first widget takes the focus.
	 * @param action - which way
	 */
	static navigate(action: UINavAction): void {
		UIFocus._ringVisible = true;
		const focused = UIFocus._focused;
		if (focused === undefined || !UIFocus.isCandidate(focused)) {
			UIFocus.focus(UIFocus.first());
			return;
		}
		if (!focused.onNavigate(action)) {
			const next = UIFocus.next(focused, action);
			if (next !== undefined) {
				UIFocus.focus(next);
			}
		}
	}

	/**
	 * Track an element joining the scene.
	 * @param element - the element
	 * @ignore
	 * @internal
	 */
	static _add(element: UIBaseElement): void {
		UIFocus._elements.add(element);
	}

	/**
	 * Track an element leaving the scene; it loses the focus.
	 * @param element - the element
	 * @ignore
	 * @internal
	 */
	static _remove(element: UIBaseElement): void {
		UIFocus._elements.delete(element);
		if (UIFocus._focused === element) {
			UIFocus.focus(undefined);
		}
	}

	/**
	 * whether an element can take the focus now
	 * @param element - the element
	 * @returns true when it is focusable, enabled, shown and in the scene
	 */
	private static isCandidate(element: UIBaseElement): boolean {
		return (
			element.focusable &&
			element.enabled &&
			element.isRenderable &&
			UIFocus._elements.has(element)
		);
	}

	/**
	 * the elements that can take the focus now
	 * @returns them, in no particular order
	 */
	private static candidates(): UIBaseElement[] {
		return [...UIFocus._elements].filter((element) => {
			return UIFocus.isCandidate(element);
		});
	}

	/**
	 * Where the focus starts: the first in reading order, row by row, left
	 * to right. Two widgets whose tops are within half a height are on the
	 * same row, so one a few pixels higher on the right does not come first.
	 * @returns the element, or undefined when there is none
	 */
	private static first(): UIBaseElement | undefined {
		let first: UIBaseElement | undefined;
		for (const candidate of UIFocus.candidates()) {
			if (first === undefined) {
				first = candidate;
				continue;
			}
			const a = candidate.getBounds();
			const b = first.getBounds();
			const sameRow =
				Math.abs(a.top - b.top) < Math.min(a.height, b.height) / 2;
			if (sameRow ? a.left < b.left : a.top < b.top) {
				first = candidate;
			}
		}
		return first;
	}

	/**
	 * The nearest candidate in a direction, edge to edge, a step sideways
	 * counting double, so a narrow widget right below a wide one beats a
	 * wide one further down.
	 * @param from - the focused element
	 * @param direction - which way
	 * @returns the next element, or undefined when there is none that way
	 */
	private static next(
		from: UIBaseElement,
		direction: UINavAction,
	): UIBaseElement | undefined {
		const [dx, dy] = DIRECTIONS[direction];
		const origin = from.getBounds();
		let best: UIBaseElement | undefined;
		let bestScore = Infinity;
		for (const candidate of UIFocus.candidates()) {
			if (candidate === from) {
				continue;
			}
			const bounds = candidate.getBounds();
			// past the focused one, centre to centre, that way
			const ahead =
				(bounds.centerX - origin.centerX) * dx +
				(bounds.centerY - origin.centerY) * dy;
			if (ahead <= 1) {
				continue;
			}
			const gap =
				dx !== 0
					? Math.max(
							0,
							dx > 0 ? bounds.left - origin.right : origin.left - bounds.right,
						)
					: Math.max(
							0,
							dy > 0 ? bounds.top - origin.bottom : origin.top - bounds.bottom,
						);
			const side =
				dx !== 0
					? Math.max(0, bounds.top - origin.bottom, origin.top - bounds.bottom)
					: Math.max(0, bounds.left - origin.right, origin.left - bounds.right);
			// the centres break a tie
			const score = gap + side * 2 + ahead * 0.01;
			if (score < bestScore) {
				bestScore = score;
				best = candidate;
			}
		}
		return best;
	}

	/**
	 * scroll each scrolling panel holding an element to show it, with room
	 * for the ring
	 * @param element - the element
	 */
	private static scrollIntoView(element: UIBaseElement): void {
		let child: Renderable = element;
		for (
			let node = element.ancestor as Renderable | undefined;
			node !== undefined && node !== null;
			node = node.ancestor as Renderable | undefined
		) {
			const panel = node as Renderable & {
				scroll?: string;
				scrollToChild?: (child: Renderable, margin?: number) => unknown;
			};
			if (
				panel.scroll !== undefined &&
				panel.scroll !== "none" &&
				typeof panel.scrollToChild === "function"
			) {
				panel.scrollToChild(child, 10);
			}
			child = node;
		}
	}

	/**
	 * press accept on the focused element: it goes down, as under a pointer
	 * @param source - the input pressing it, so only that one releases it
	 */
	private static acceptDown(source: "key" | "pad"): void {
		UIFocus._ringVisible = true;
		const focused = UIFocus._focused;
		if (
			UIFocus._accept === undefined &&
			focused !== undefined &&
			UIFocus.isCandidate(focused)
		) {
			UIFocus._accept = source;
			focused.focusPress();
		}
	}

	/**
	 * release accept: the widget comes up and acts, as on a click
	 * @param source - the input letting it go
	 */
	private static acceptUp(source: "key" | "pad"): void {
		if (UIFocus._accept === source) {
			UIFocus._accept = undefined;
			UIFocus._focused?.focusRelease();
		}
	}

	private static readonly _onKeyDown = (
		_action: string | undefined,
		keyCode: number,
	): void => {
		if (ACCEPT_KEYS.includes(keyCode)) {
			UIFocus.acceptDown("key");
			return;
		}
		for (const action of Object.keys(KEYS) as UINavAction[]) {
			if (KEYS[action] === keyCode) {
				UIFocus.navigate(action);
			}
		}
	};

	private static readonly _onKeyUp = (
		_action: string | undefined,
		keyCode: number,
	): void => {
		if (ACCEPT_KEYS.includes(keyCode)) {
			UIFocus.acceptUp("key");
		}
	};

	private static readonly _onPointer = (): void => {
		UIFocus._ringVisible = false;
	};

	/**
	 * read the pads once a frame: a D-pad press moves once, A presses
	 */
	private static readonly _onFrame = (): void => {
		const B = GAMEPAD.BUTTONS;
		let held = "";
		let accept = false;
		for (const pad of readGamepads()) {
			if (pad === null) {
				continue;
			}
			const pressed = (code: number) => {
				return pad.buttons[code]?.pressed ?? false;
			};
			if (pressed(B.UP)) {
				held = "up";
			} else if (pressed(B.DOWN)) {
				held = "down";
			} else if (pressed(B.LEFT)) {
				held = "left";
			} else if (pressed(B.RIGHT)) {
				held = "right";
			}
			accept ||= pressed(B.FACE_1);
		}
		const pad = UIFocus._pad;
		if (held !== "" && held !== pad.held) {
			UIFocus.navigate(held as UINavAction);
		}
		pad.held = held;
		if (accept && !pad.accept) {
			UIFocus.acceptDown("pad");
		} else if (!accept && pad.accept) {
			UIFocus.acceptUp("pad");
		}
		pad.accept = accept;
	};
}
