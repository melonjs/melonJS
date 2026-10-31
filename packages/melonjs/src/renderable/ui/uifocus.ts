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
 * What the player asks of the focused widget: move the focus, or act on it.
 * @category UI
 */
export type UINavAction =
	| "up"
	| "down"
	| "left"
	| "right"
	| "accept"
	| "cancel";

/** an element that keeps focus inside itself while it is up */
interface FocusScope {
	ancestor?: unknown;
}

/** the directions, for the spatial search */
const DIRECTIONS: Record<"up" | "down" | "left" | "right", [number, number]> = {
	up: [0, -1],
	down: [0, 1],
	left: [-1, 0],
	right: [1, 0],
};

/**
 * Keyboard and gamepad navigation for UI elements: one widget at a time has
 * the focus, the arrows or the D-pad move it to the nearest widget that way,
 * and Enter or the pad's A button acts on it, as a click would.
 *
 * Off until {@link UIFocus.enable} is called, so a game that steers with the
 * arrow keys does not find them moving a focus it never asked for.
 *
 * Any {@link UIBaseElement} can take part: it sets `focusable`, and answers
 * the player through {@link UIBaseElement#onNavigate}. Buttons, checkboxes
 * and sliders already do: a button clicks, a checkbox toggles, a slider
 * steps on left and right. Nothing needs setting up per screen:
 *
 * - the next widget in a direction is found from where the widgets are,
 *   and one that should go somewhere else names it in `focusNeighbors`;
 * - a {@link UIPanel} with `trapFocus` keeps the focus inside itself while
 *   it is up, as a dialog should, and gives it back when it goes;
 * - a focused widget inside a scrolling panel is scrolled into view;
 * - the focus ring only shows once the keyboard or a pad is used, and the
 *   mouse moving hides it again, as in a web page.
 * @category UI
 * @example
 * UIFocus.enable();
 * // start on the first button, rather than on the first arrow press
 * UIFocus.focus(playButton);
 */
// one focus per page: a class of statics, documented as one API like `state`
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export default class UIFocus {
	/**
	 * The keys for each action, by `input.KEY` code. Change them before or
	 * after {@link UIFocus.enable}.
	 */
	static keys: Record<UINavAction, number[]> = {
		up: [KEY.UP],
		down: [KEY.DOWN],
		left: [KEY.LEFT],
		right: [KEY.RIGHT],
		accept: [KEY.ENTER, KEY.SPACE],
		cancel: [KEY.ESC],
	};

	/**
	 * Whether a gamepad navigates too: its D-pad or left stick moves the
	 * focus, its A (FACE_1) button accepts and its B (FACE_2) button cancels.
	 * Read straight from the pad, so the game's own pad bindings are left as
	 * they are.
	 * @default true
	 */
	static gamepad = true;

	/** the focus ring's colour */
	static ringColor = "#ffcc33";
	/** the focus ring's thickness, in pixels */
	static ringWidth = 3;
	/** how far outside the widget the ring is drawn, in pixels */
	static ringPadding = 3;
	/** the focus ring's corner radius */
	static ringRadius = 6;

	/** whether navigation is on */
	private static _enabled = false;
	/** the focusable elements in the scene */
	private static readonly _elements = new Set<UIBaseElement>();
	/** the panels keeping the focus in, the innermost last */
	private static readonly _scopes: {
		scope: FocusScope;
		restore: UIBaseElement | undefined;
	}[] = [];
	/** the focused element */
	private static _focused: UIBaseElement | undefined;
	/** whether the ring shows: after keyboard or pad input, until the mouse */
	private static _ringVisible = false;
	/** whether accept is held, and by which input */
	private static _acceptHeld: string | undefined;
	/** the pad's directions and buttons as last read, and the repeat clock */
	private static readonly _pad = {
		held: "" as string,
		next: 0,
		accept: false,
		cancel: false,
	};

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
	 * Give an element the focus, or take it away with `undefined`.
	 *
	 * The element is told through `onFocus`, the one before it through
	 * `onBlur`, and a scrolling panel holding it scrolls it into view.
	 * @param element - the element to focus
	 */
	static focus(element: UIBaseElement | undefined): void {
		const previous = UIFocus._focused;
		if (previous === element) {
			return;
		}
		UIFocus._focused = element;
		if (previous !== undefined) {
			previous.isDirty = true;
			previous.onBlur();
		}
		if (element !== undefined) {
			element.isDirty = true;
			element.onFocus();
			UIFocus.scrollIntoView(element);
		}
	}

	/**
	 * Act as if the player asked for something: move the focus, accept or
	 * cancel. For input of the game's own, such as a touch D-pad of its own
	 * or a remote.
	 * @param action - what to do
	 */
	static navigate(action: UINavAction): void {
		const wasVisible = UIFocus._ringVisible;
		UIFocus._ringVisible = true;
		let focused = UIFocus._focused;
		if (focused !== undefined && !UIFocus.isCandidate(focused)) {
			UIFocus.focus(undefined);
			focused = undefined;
		}
		if (focused === undefined) {
			if (action !== "cancel" && action !== "accept") {
				UIFocus.focus(UIFocus.first());
			}
			return;
		}
		// the first key after the mouse shows where the focus is, rather
		// than moving it from a place the player could not see
		if (!wasVisible && action in DIRECTIONS) {
			return;
		}
		// the focused widget first, then the ones holding it, for a slider
		// stepping, or a panel answering cancel
		for (
			let node: Renderable | undefined = focused;
			node !== undefined;
			node = node.ancestor as Renderable | undefined
		) {
			const element = node as unknown as Partial<UIBaseElement>;
			if (
				typeof element.onNavigate === "function" &&
				element.onNavigate(action)
			) {
				return;
			}
		}
		if (action in DIRECTIONS) {
			const next = UIFocus.next(focused, action as keyof typeof DIRECTIONS);
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
	 * A panel that keeps the focus in comes up: the focus moves into it.
	 * @param scope - the panel
	 * @ignore
	 * @internal
	 */
	static _pushScope(scope: FocusScope): void {
		UIFocus._scopes.push({ scope, restore: UIFocus._focused });
		if (UIFocus._focused !== undefined && !UIFocus.inScope(UIFocus._focused)) {
			UIFocus.focus(UIFocus.first());
		}
	}

	/**
	 * That panel goes: the focus goes back where it was.
	 * @param scope - the panel
	 * @ignore
	 * @internal
	 */
	static _popScope(scope: FocusScope): void {
		const index = UIFocus._scopes.findIndex((entry) => {
			return entry.scope === scope;
		});
		if (index === -1) {
			return;
		}
		const [entry] = UIFocus._scopes.splice(index, 1);
		if (
			UIFocus._focused === undefined ||
			UIFocus.isInside(UIFocus._focused, scope)
		) {
			const restore = entry.restore;
			UIFocus.focus(
				restore !== undefined && UIFocus.isCandidate(restore)
					? restore
					: undefined,
			);
		}
	}

	/**
	 * Hover moves the focus along, so the keyboard picks up where the mouse
	 * was. The ring stays hidden.
	 * @param element - the element under the pointer
	 * @ignore
	 * @internal
	 */
	static _hovered(element: UIBaseElement): void {
		if (
			UIFocus._enabled &&
			UIFocus._focused !== undefined &&
			UIFocus.isCandidate(element)
		) {
			UIFocus.focus(element);
		}
	}

	/**
	 * whether an element can take the focus now
	 * @param element - the element
	 * @returns true when it is focusable, enabled, shown and in scope
	 */
	private static isCandidate(element: UIBaseElement): boolean {
		return (
			element.focusable &&
			element.enabled &&
			element.isRenderable &&
			UIFocus._elements.has(element) &&
			UIFocus.inScope(element)
		);
	}

	/**
	 * whether an element is inside the panel keeping the focus, if any
	 * @param element - the element
	 * @returns true when no panel keeps the focus, or it is inside that one
	 */
	private static inScope(element: UIBaseElement): boolean {
		const top = UIFocus._scopes[UIFocus._scopes.length - 1];
		return top === undefined || UIFocus.isInside(element, top.scope);
	}

	/**
	 * whether an element is held, at any depth, by another
	 * @param element - the element
	 * @param scope - the one that may hold it
	 * @returns true when `scope` is one of its ancestors
	 */
	private static isInside(element: Renderable, scope: FocusScope): boolean {
		for (
			let node = element.ancestor as FocusScope | undefined;
			node != null;
			node = node.ancestor as FocusScope | undefined
		) {
			if (node === scope) {
				return true;
			}
		}
		return false;
	}

	/**
	 * the elements that can take the focus now
	 * @returns them, in no particular order
	 */
	private static candidates(): UIBaseElement[] {
		const list: UIBaseElement[] = [];
		for (const element of UIFocus._elements) {
			if (UIFocus.isCandidate(element)) {
				list.push(element);
			}
		}
		return list;
	}

	/**
	 * Where the focus starts: the first in reading order, row by row, left
	 * to right. Two widgets whose tops are within half a height of each
	 * other are on the same row, so a widget a few pixels higher on the
	 * right does not come before the one on the left.
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
	 * The nearest candidate in a direction: a named neighbour if it can
	 * take the focus, else the closest one that way, edge to edge, a step
	 * sideways counting double.
	 * @param from - the focused element
	 * @param direction - which way
	 * @returns the next element, or undefined when there is none that way
	 */
	private static next(
		from: UIBaseElement,
		direction: keyof typeof DIRECTIONS,
	): UIBaseElement | undefined {
		const named = from.focusNeighbors?.[direction];
		if (named !== undefined && UIFocus.isCandidate(named)) {
			return named;
		}
		const [dx, dy] = DIRECTIONS[direction];
		const origin = from.getBounds();
		let best: UIBaseElement | undefined;
		let bestScore = Infinity;
		for (const candidate of UIFocus.candidates()) {
			if (candidate === from) {
				continue;
			}
			const bounds = candidate.getBounds();
			// past the focused one, centre to centre, in that direction
			const ahead =
				(bounds.centerX - origin.centerX) * dx +
				(bounds.centerY - origin.centerY) * dy;
			if (ahead <= 1) {
				continue;
			}
			// edge to edge: the gap ahead, and how far off to the side, 0
			// when the two overlap that way, so a narrow widget right below
			// a wide one beats a wide one further down
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
			// a step sideways counts double; the centres break a tie
			const score = gap + side * 2 + ahead * 0.01;
			if (score < bestScore) {
				bestScore = score;
				best = candidate;
			}
		}
		return best;
	}

	/**
	 * scroll each scrolling panel holding an element to show it
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
				// with room for the ring and a bounce around it
				panel.scrollToChild(child, UIFocus.ringPadding + UIFocus.ringWidth + 4);
			}
			child = node;
		}
	}

	/**
	 * the action a key code stands for, if any
	 * @param keyCode - the key
	 * @returns the action, or undefined
	 */
	private static actionOf(keyCode: number): UINavAction | undefined {
		for (const action of Object.keys(UIFocus.keys) as UINavAction[]) {
			if (UIFocus.keys[action].includes(keyCode)) {
				return action;
			}
		}
		return undefined;
	}

	/**
	 * press accept on the focused element: its press look, then the act
	 * @param source - the input pressing it, so only that one releases it
	 */
	private static acceptDown(source: string): void {
		UIFocus._ringVisible = true;
		const focused = UIFocus._focused;
		if (
			UIFocus._acceptHeld !== undefined ||
			focused === undefined ||
			!UIFocus.isCandidate(focused)
		) {
			return;
		}
		UIFocus._acceptHeld = source;
		focused.focusPress();
	}

	/**
	 * release accept: the act completes, as a click does
	 * @param source - the input letting it go
	 */
	private static acceptUp(source: string): void {
		if (UIFocus._acceptHeld !== source) {
			return;
		}
		UIFocus._acceptHeld = undefined;
		UIFocus._focused?.focusRelease();
	}

	private static readonly _onKeyDown = (
		_action: string | undefined,
		keyCode: number,
	): void => {
		const action = UIFocus.actionOf(keyCode);
		if (action === "accept") {
			UIFocus.acceptDown("key");
		} else if (action !== undefined) {
			UIFocus.navigate(action);
		}
	};

	private static readonly _onKeyUp = (
		_action: string | undefined,
		keyCode: number,
	): void => {
		if (UIFocus.actionOf(keyCode) === "accept") {
			UIFocus.acceptUp("key");
		}
	};

	private static readonly _onPointer = (): void => {
		UIFocus._ringVisible = false;
	};

	/**
	 * read the pads once a frame: directions repeat while held
	 * @param time - the frame time, in milliseconds
	 */
	private static readonly _onFrame = (time: number): void => {
		if (!UIFocus.gamepad) {
			return;
		}
		const B = GAMEPAD.BUTTONS;
		const A = GAMEPAD.AXES;
		let held = "";
		let accept = false;
		let cancel = false;
		for (const pad of readGamepads()) {
			if (pad === null) {
				continue;
			}
			const button = (code: number) => {
				return pad.buttons[code]?.pressed ?? false;
			};
			const x = pad.axes[A.LX] ?? 0;
			const y = pad.axes[A.LY] ?? 0;
			if (button(B.UP) || y < -0.5) {
				held = "up";
			} else if (button(B.DOWN) || y > 0.5) {
				held = "down";
			} else if (button(B.LEFT) || x < -0.5) {
				held = "left";
			} else if (button(B.RIGHT) || x > 0.5) {
				held = "right";
			}
			accept ||= button(B.FACE_1);
			cancel ||= button(B.FACE_2);
		}
		const pad = UIFocus._pad;
		if (held !== "") {
			// a step on the press, then a repeat while it is held
			if (held !== pad.held) {
				pad.next = time + 400;
				UIFocus.navigate(held as UINavAction);
			} else if (time >= pad.next) {
				pad.next = time + 120;
				UIFocus.navigate(held as UINavAction);
			}
		}
		pad.held = held;
		if (accept && !pad.accept) {
			UIFocus.acceptDown("pad");
		} else if (!accept && pad.accept) {
			UIFocus.acceptUp("pad");
		}
		pad.accept = accept;
		if (cancel && !pad.cancel) {
			UIFocus.navigate("cancel");
		}
		pad.cancel = cancel;
	};
}
